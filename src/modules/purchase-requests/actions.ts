"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { allocateNumber, yymmFromDate } from "@/kernel/numbering/series";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { devContext } from "@/lib/dev-context";

export interface ActionResult<T = unknown> {
  ok: boolean; data?: T; error?: string; fieldErrors?: Record<string, string>;
}

const SELL_UNITS = ["METRE", "ROLL", "SQFT", "SQM", "PIECE", "SET", "BOX", "RUNNING_FT"] as const;

const requestLineInput = z.object({
  colourwayId:  z.string().cuid().optional(),
  freeTextItem: z.string().trim().max(300).optional(),
  quantity:     z.number().positive("Quantity must be > 0"),
  unit:         z.enum(SELL_UNITS),
}).refine((d) => d.colourwayId || d.freeTextItem, {
  message: "Either pick a colourway or enter a description",
});

const createRequestSchema = z.object({
  projectId: z.string().cuid().optional(),
  reason:    z.string().trim().min(3, "Reason is required").max(500),
  neededBy:  z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  lines:     z.array(requestLineInput).min(1, "Add at least one line"),
});

const approveSchema = z.object({
  id: z.string().cuid(),
});

const rejectSchema = z.object({
  id:     z.string().cuid(),
  reason: z.string().trim().min(3, "Reason is required").max(500),
});

export async function createPurchaseRequest(
  input: unknown,
): Promise<ActionResult<{ id: string; number: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "requisition.create");

  const parsed = createRequestSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const created = await withTransaction(async (tx: TxClient) => {
    const number = await allocateNumber(tx, {
      orgId:  ctx.orgId,
      series: "REQ",
      yymm:   yymmFromDate(new Date()),
      prefix: "MDV",
    });

    const req = await tx.purchaseRequest.create({
      data: {
        organizationId: ctx.orgId,
        number,
        projectId:   d.projectId ?? null,
        raisedById:  ctx.userId,
        reason:      d.reason,
        neededBy:    d.neededBy ? new Date(d.neededBy) : null,
        status:      "SUBMITTED",
      },
      select: { id: true, number: true },
    });

    await tx.purchaseRequestLine.createMany({
      data: d.lines.map((l) => ({
        organizationId: ctx.orgId,
        requestId:      req.id,
        colourwayId:    l.colourwayId ?? null,
        freeTextItem:   l.freeTextItem ?? null,
        quantity:       new Decimal(l.quantity),
        unit:           l.unit,
      })),
    });

    return req;
  });

  revalidatePath("/purchase/requests");
  return { ok: true, data: created };
}

export async function approvePurchaseRequest(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "requisition.approve");

  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const { id } = parsed.data;

  const db = scoped(ctx);
  const req = await db.purchaseRequest.findUnique({ where: { id }, select: { status: true } });
  if (!req) return { ok: false, error: "Request not found" };
  if (req.status !== "SUBMITTED") {
    return { ok: false, error: "Only submitted requests can be approved" };
  }

  await db.purchaseRequest.update({
    where: { id },
    data: { status: "APPROVED", approvedById: ctx.userId, approvedAt: new Date() },
  });

  revalidatePath("/purchase/requests");
  revalidatePath(`/purchase/requests/${id}`);
  return { ok: true, data: { id } };
}

export async function rejectPurchaseRequest(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "requisition.approve");

  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id, reason } = parsed.data;

  const db = scoped(ctx);
  const req = await db.purchaseRequest.findUnique({ where: { id }, select: { status: true } });
  if (!req) return { ok: false, error: "Request not found" };
  if (req.status !== "SUBMITTED") {
    return { ok: false, error: "Only submitted requests can be rejected" };
  }

  await db.purchaseRequest.update({
    where: { id },
    data: { status: "REJECTED", rejectionReason: reason },
  });

  revalidatePath("/purchase/requests");
  revalidatePath(`/purchase/requests/${id}`);
  return { ok: true, data: { id } };
}

function zodError<T = unknown>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path.filter((s): s is string | number => typeof s === "string" || typeof s === "number").join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}

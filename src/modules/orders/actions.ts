"use server";

import type { z } from "zod";
import { revalidatePath } from "next/cache";
import { withTransaction } from "@/kernel/db/transaction";
import type { TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { parseINR } from "@/kernel/money/format";
import { allocateNumber, yymmFromDate } from "@/kernel/numbering/series";
import { devContext } from "@/lib/dev-context";
import { convertQuotationSchema, setOrderStatusSchema } from "./schema";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createOrderFromQuotation(
  input: unknown,
): Promise<ActionResult<{ id: string; number: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "order.create");

  const parsed = convertQuotationSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const q = await db.quotation.findUniqueOrThrow({
    where: { id: d.quotationId },
    select: {
      id: true, branchId: true, projectId: true, clientId: true,
      status: true, total: true,
      lines: {
        orderBy: { lineNo: "asc" },
        select: {
          lineNo: true, measurementItemId: true, colourwayId: true, serviceRateId: true,
          description: true, quantity: true, unit: true, rate: true, amount: true,
        },
      },
    },
  });

  if (q.status !== "ACCEPTED") {
    return {
      ok: false,
      error: `Quotation must be ACCEPTED to convert (currently ${q.status})`,
    };
  }
  // Orders require a project + client. Lead-scoped quotations (§5.1) don't
  // have those yet — must run convertLead first.
  if (!q.projectId || !q.clientId) {
    return {
      ok: false,
      error: "This is a lead-scoped quotation. Convert the lead to a client first, then raise the order.",
    };
  }
  const projectId = q.projectId;
  const clientId = q.clientId;

  const branch = await db.branch.findUniqueOrThrow({
    where: { id: q.branchId },
    select: { invoicePrefix: true },
  });

  const now = new Date();
  const advanceRequired =
    d.advanceRequired && d.advanceRequired.trim() ? parseINR(d.advanceRequired) : 0n;

  const created = await withTransaction(async (tx: TxClient) => {
    const number = await allocateNumber(tx, {
      orgId:  ctx.orgId,
      series: "SO",
      yymm:   yymmFromDate(now),
      prefix: branch.invoicePrefix,
    });
    const order = await tx.order.create({
      data: {
        organizationId:   ctx.orgId,
        branchId:         q.branchId,
        number,
        projectId,
        clientId,
        quotationId:      q.id,
        date:             now,
        status:           "CONFIRMED",
        totalValue:       q.total,
        advanceRequired,
      },
      select: { id: true, number: true },
    });
    await tx.orderLine.createMany({
      data: q.lines.map((l) => ({
        organizationId:    ctx.orgId,
        orderId:           order.id,
        lineNo:            l.lineNo,
        measurementItemId: l.measurementItemId ?? null,
        colourwayId:       l.colourwayId ?? null,
        serviceRateId:     l.serviceRateId ?? null,
        description:       l.description,
        quantity:          l.quantity,
        unit:              l.unit,
        rate:              l.rate,
        amount:            l.amount,
      })),
    });
    return order;
  }, { orgId: ctx.orgId });

  revalidatePath("/orders");
  revalidatePath("/quotations");
  revalidatePath(`/quotations/${q.id}`);
  return { ok: true, data: created };
}

export async function setOrderStatus(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  const parsed = setOrderStatusSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id, status } = parsed.data;

  requirePermission(ctx, status === "CANCELLED" ? "order.cancel" : "order.amend");

  const db = scoped(ctx);
  await db.order.update({ where: { id }, data: { status } });

  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
  return { ok: true, data: { id } };
}

// ── helpers ──────────────────────────────────────────────────────────────────

function zodError<T = unknown>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path
      .filter((seg): seg is string | number => typeof seg === "string" || typeof seg === "number")
      .join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}

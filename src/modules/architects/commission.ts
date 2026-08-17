"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

const createCommissionSchema = z.object({
  architectId: z.string().cuid(),
  projectId:   z.string().cuid(),
  baseAmount:  z.string().regex(/^\d+$/, "baseAmount must be a positive integer (paise)"),
});

export async function createArchitectCommission(
  input: unknown,
): Promise<ActionResult<{ id: string; amount: bigint }>> {
  const ctx = await devContext();
  requirePermission(ctx, "project.update");

  const parsed = createCommissionSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);

  const architect = await db.architect.findUnique({
    where: { id: d.architectId },
    select: { id: true, commissionPct: true },
  });
  if (!architect) return { ok: false, error: "Architect not found." };

  const existing = await db.architectCommission.findFirst({
    where: {
      organizationId: ctx.orgId,
      projectId:      d.projectId,
      architectId:    d.architectId,
    },
    select: { id: true },
  });
  if (existing) {
    return {
      ok: false,
      error: "A commission record already exists for this architect on this project.",
    };
  }

  const baseAmount = BigInt(d.baseAmount);
  const pct        = architect.commissionPct;
  const amount     = BigInt(
    new Decimal(baseAmount.toString())
      .mul(pct.toString())
      .div(100)
      .toDecimalPlaces(0)
      .toString(),
  );

  const commission = await db.architectCommission.create({
    data: {
      organizationId: ctx.orgId,
      architectId:    d.architectId,
      projectId:      d.projectId,
      baseAmount,
      pct,
      amount,
    },
    select: { id: true, amount: true },
  });

  revalidatePath(`/projects/${d.projectId}`);
  return { ok: true, data: { id: commission.id, amount: commission.amount } };
}

const markPaidSchema = z.object({
  id:         z.string().cuid(),
  paymentRef: z.string().min(1).max(120),
  paidAt:     z.string().datetime(),
});

export async function markCommissionPaid(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "invoice.create");

  const parsed = markPaidSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);

  const commission = await db.architectCommission.findUnique({
    where: { id: d.id },
    select: { id: true, paidAt: true, projectId: true },
  });
  if (!commission) return { ok: false, error: "Commission record not found." };
  if (commission.paidAt) {
    return { ok: false, error: "Commission is already marked as paid." };
  }

  await db.architectCommission.update({
    where: { id: d.id },
    data:  { paidAt: new Date(d.paidAt), paymentRef: d.paymentRef },
  });

  if (commission.projectId) revalidatePath(`/projects/${commission.projectId}`);
  return { ok: true, data: { id: d.id } };
}

// ── helpers ──────────────────────────────────────────────────────────────────

function zodError<T = unknown>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path
      .filter((s): s is string | number => typeof s === "string" || typeof s === "number")
      .join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}

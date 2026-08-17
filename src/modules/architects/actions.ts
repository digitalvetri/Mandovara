"use server";

// Architect + commission server actions.
// Owns: Architect CRUD, recordCommissionPayment, cancelCommission.
// Commissions are stamped at order-creation time by modules/orders/actions.ts.

import type { z } from "zod";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import {
  createArchitectSchema, updateArchitectSchema,
  recordCommissionPaymentSchema, cancelCommissionSchema,
} from "./schema";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

function safeRevalidate(path: string): void {
  try { revalidatePath(path); } catch { /* not in a Next request */ }
}

export async function createArchitect(
  input: unknown,
): Promise<ActionResult<{ id: string; code: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "architect.create");

  const parsed = createArchitectSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const existing = await db.architect.findFirst({
    where: { code: d.code }, select: { id: true },
  });
  if (existing) {
    return {
      ok: false, error: "Code already exists",
      fieldErrors: { code: `Code "${d.code}" is already used` },
    };
  }

  const row = await db.architect.create({
    data: {
      organizationId: ctx.orgId,
      code:           d.code,
      firmName:       d.firmName,
      contactName:    d.contactName,
      mobile:         d.mobile,
      email:          d.email && d.email.length > 0 ? d.email : null,
      commissionPct:  new Decimal(d.commissionPct),
    },
    select: { id: true, code: true },
  });

  safeRevalidate("/architects");
  return { ok: true, data: row };
}

export async function updateArchitect(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "architect.update");

  const parsed = updateArchitectSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id, firmName, contactName, mobile, email, commissionPct, isActive } = parsed.data;

  const db = scoped(ctx);
  const exists = await db.architect.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return { ok: false, error: "Architect not found" };

  await db.architect.update({
    where: { id },
    data: {
      ...(firmName      != null && { firmName }),
      ...(contactName   != null && { contactName }),
      ...(mobile        != null && { mobile }),
      ...(email         != null && { email: email.length > 0 ? email : null }),
      ...(commissionPct != null && { commissionPct: new Decimal(commissionPct) }),
      ...(isActive      != null && { isActive }),
    },
  });

  safeRevalidate("/architects");
  safeRevalidate(`/architects/${id}`);
  return { ok: true, data: { id } };
}

export async function recordCommissionPayment(
  input: unknown,
): Promise<ActionResult<{ commissionId: string; paidAt: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "architect.commission.pay");

  const parsed = recordCommissionPaymentSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { commissionId, paymentRef, paidAt } = parsed.data;

  const db = scoped(ctx);
  const c = await db.architectCommission.findUnique({
    where: { id: commissionId },
    select: { id: true, paidAt: true, cancelledAt: true, architectId: true },
  });
  if (!c) return { ok: false, error: "Commission not found" };
  if (c.cancelledAt != null) return { ok: false, error: "Commission is cancelled" };
  if (c.paidAt != null) {
    return { ok: false, error: `Already marked paid on ${c.paidAt.toISOString().slice(0, 10)}` };
  }

  const paidAtDate = paidAt != null ? new Date(paidAt) : new Date();

  await withTransaction(async (tx: TxClient) => {
    await tx.architectCommission.update({
      where: { id: commissionId },
      data:  { paidAt: paidAtDate, paymentRef },
    });
    await tx.auditLog.create({
      data: {
        organizationId: ctx.orgId, actorId: ctx.userId,
        entityType: "ArchitectCommission", entityId: commissionId,
        action: "RECORD_PAYMENT",
        after: { paidAt: paidAtDate.toISOString(), paymentRef },
      },
    });
  });

  safeRevalidate("/architects");
  safeRevalidate(`/architects/${c.architectId}`);
  return { ok: true, data: { commissionId, paidAt: paidAtDate.toISOString() } };
}

export async function cancelCommission(
  input: unknown,
): Promise<ActionResult<{ commissionId: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "architect.commission.cancel");

  const parsed = cancelCommissionSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { commissionId, reason } = parsed.data;

  const db = scoped(ctx);
  const c = await db.architectCommission.findUnique({
    where: { id: commissionId },
    select: { id: true, paidAt: true, cancelledAt: true, architectId: true },
  });
  if (!c) return { ok: false, error: "Commission not found" };
  if (c.cancelledAt != null) return { ok: false, error: "Already cancelled" };
  if (c.paidAt != null) {
    return { ok: false, error: "Cannot cancel a paid commission — issue a debit note instead" };
  }

  await withTransaction(async (tx: TxClient) => {
    await tx.architectCommission.update({
      where: { id: commissionId },
      data:  { cancelledAt: new Date(), cancelReason: reason },
    });
    await tx.auditLog.create({
      data: {
        organizationId: ctx.orgId, actorId: ctx.userId,
        entityType: "ArchitectCommission", entityId: commissionId,
        action: "CANCEL_COMMISSION",
        after: { reason },
      },
    });
  });

  safeRevalidate("/architects");
  safeRevalidate(`/architects/${c.architectId}`);
  return { ok: true, data: { commissionId } };
}

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

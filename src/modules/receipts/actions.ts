"use server";

// Receipt server actions.
//
// createReceipt (inside a transaction):
//   - allocateNumber (RCPT), create Receipt with amount + unallocated
//   - for each allocation: validate it doesn't exceed that invoice's
//     current outstanding (server-side, per line — over-allocation is
//     always rejected)
//   - create ReceiptAllocation rows
//   - for each affected invoice: recompute paidTotal from all allocations
//     (including this one) and set status → PAID if fully covered,
//     PARTIALLY_PAID otherwise
//   - unallocated residual = receipt.amount − Σ allocations (stored on the
//     receipt so downstream credits/on-account can pick it up)

import type { z } from "zod";
import { revalidatePath } from "next/cache";

// revalidatePath throws "static generation store missing" outside a
// Next request context (smoke scripts, integration tests). Wrap so
// the action is callable from both surfaces. Mirrors modules/*.
function safeRevalidate(path: string): void {
  try { revalidatePath(path); } catch { /* not in a Next request */ }
}
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { parseINR } from "@/kernel/money/format";
import { allocateNumber } from "@/kernel/numbering/series";
import { financialYear } from "@/kernel/datetime";
import { devContext } from "@/lib/dev-context";
import { createReceiptSchema, bounceReceiptSchema } from "./schema";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createReceipt(
  input: unknown,
): Promise<ActionResult<{ id: string; number: string; unallocated: bigint }>> {
  const ctx = await devContext();
  requirePermission(ctx, "receipt.create");

  const parsed = createReceiptSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const totalPaise = parsePaise(d.amount);
  if (totalPaise == null || totalPaise <= 0n) {
    return { ok: false, error: "Validation failed",
             fieldErrors: { amount: "Receipt amount must be > 0" } };
  }
  const allocationPairs = d.allocations
    .map((a) => ({ invoiceId: a.invoiceId, amount: parsePaise(a.amount) }))
    .filter((a): a is { invoiceId: string; amount: bigint } =>
      a.amount != null && a.amount > 0n);
  if (allocationPairs.length === 0) {
    return { ok: false, error: "Validation failed",
             fieldErrors: { allocations: "At least one allocation must have a positive amount" } };
  }
  const allocatedTotal = allocationPairs.reduce((s, a) => s + a.amount, 0n);
  if (allocatedTotal > totalPaise) {
    return {
      ok: false,
      error: `Allocated ₹${asRupees(allocatedTotal)} exceeds receipt total ₹${asRupees(totalPaise)}`,
    };
  }
  const unallocated = totalPaise - allocatedTotal;

  const db = scoped(ctx);

  // Pre-tx: pull each invoice's outstanding to bounds-check server-side.
  const invoiceIds = allocationPairs.map((a) => a.invoiceId);
  const invoices = await db.invoice.findMany({
    where: { id: { in: invoiceIds } },
    select: {
      id: true, number: true, total: true, advanceAdjusted: true,
      clientId: true, status: true,
      allocations: { select: { amount: true } },
    },
  });
  const invById = new Map(invoices.map((i) => [i.id, i]));
  const fieldErrors: Record<string, string> = {};

  for (const p of allocationPairs) {
    const inv = invById.get(p.invoiceId);
    if (!inv) {
      fieldErrors[`allocations.${p.invoiceId}`] = "Invoice not found";
      continue;
    }
    if (inv.clientId !== d.clientId) {
      fieldErrors[`allocations.${p.invoiceId}`] = `Invoice ${inv.number} belongs to another client`;
      continue;
    }
    if (inv.status === "CANCELLED" || inv.status === "PAID") {
      fieldErrors[`allocations.${p.invoiceId}`] = `Invoice ${inv.number} is ${inv.status}`;
      continue;
    }
    const paid = inv.allocations.reduce((s, a) => s + a.amount, 0n);
    const outstanding = inv.total - inv.advanceAdjusted - paid;
    if (p.amount > outstanding) {
      fieldErrors[`allocations.${p.invoiceId}`] =
        `Over-allocated: only ₹${asRupees(outstanding)} outstanding on ${inv.number}`;
    }
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "Validation failed", fieldErrors };
  }

  const receiptDate = new Date(d.date);
  const branch = await db.branch.findUniqueOrThrow({
    where: { id: d.branchId },
    select: { invoicePrefix: true },
  });

  const created = await withTransaction(async (tx: TxClient) => {
    const number = await allocateNumber(tx, {
      orgId:         ctx.orgId,
      branchId:      d.branchId,
      docType:       "RECEIPT",
      financialYear: financialYear(receiptDate),
      prefix:        `${branch.invoicePrefix}/RCPT`,
    });
    const receipt = await tx.receipt.create({
      data: {
        orgId:       ctx.orgId,
        branchId:    d.branchId,
        number,
        clientId:    d.clientId,
        date:        receiptDate,
        mode:        d.mode,
        reference:   (d.reference ?? "").trim() || null,
        amount:      totalPaise,
        unallocated,
        createdById: ctx.userId,
      },
      select: { id: true, number: true },
    });
    await tx.receiptAllocation.createMany({
      data: allocationPairs.map((a) => ({
        receiptId: receipt.id,
        invoiceId: a.invoiceId,
        amount:    a.amount,
      })),
    });

    // Roll each affected invoice to PARTIALLY_PAID or PAID.
    for (const p of allocationPairs) {
      const inv = invById.get(p.invoiceId)!;
      const previouslyPaid = inv.allocations.reduce((s, a) => s + a.amount, 0n);
      const newPaid = previouslyPaid + p.amount;
      const remaining = inv.total - inv.advanceAdjusted - newPaid;
      const nextStatus = remaining <= 0n ? "PAID" : "PARTIALLY_PAID";
      if (nextStatus !== inv.status) {
        await tx.invoice.update({
          where: { id: inv.id },
          data:  { status: nextStatus },
        });
      }
    }
    return receipt;
  });

  safeRevalidate("/accounts");
  safeRevalidate("/invoicing");
  for (const p of allocationPairs) safeRevalidate(`/invoicing/${p.invoiceId}`);

  return { ok: true, data: { ...created, unallocated } };
}

// ── bounceReceipt — §14 Phase 6 gate #3 ──────────────────────────
//
// Bouncing a cheque means the funds never actually cleared. We:
//   1. Verify mode=CHEQUE and not already BOUNCED (idempotent guard).
//   2. Delete every ReceiptAllocation for this receipt.
//   3. For each affected invoice: re-sum remaining allocations from
//      OTHER receipts, then set status to PAID (fully covered),
//      PARTIALLY_PAID (some remaining), or ISSUED (nothing left).
//      SELECT FOR UPDATE on the invoice inside the tx so a concurrent
//      allocation of a different receipt can't race.
//   4. Zero out Receipt.unallocated + flip chequeStatus to BOUNCED.
//   5. AuditLog row with the reason.
//
// Cancelled invoices are skipped (they carry their own reversal
// paperwork). If an invoice reverts from PAID → PARTIALLY_PAID the
// caller sees this via the query-layer status flip and outstanding
// automatically restores in the /accounts view.

export async function bounceReceipt(
  input: unknown,
): Promise<ActionResult<{ receiptId: string; affectedInvoices: string[] }>> {
  const ctx = await devContext();
  requirePermission(ctx, "receipt.reverse");

  const parsed = bounceReceiptSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { receiptId, reason } = parsed.data;

  const db = scoped(ctx);
  const r = await db.receipt.findUnique({
    where: { id: receiptId },
    select: {
      id: true, mode: true, chequeStatus: true, amount: true, unallocated: true,
      allocations: { select: { id: true, invoiceId: true, amount: true } },
    },
  });
  if (!r) return { ok: false, error: "Receipt not found" };
  if (r.mode !== "CHEQUE") {
    return { ok: false, error: `Only CHEQUE receipts can be bounced (mode=${r.mode})` };
  }
  if (r.chequeStatus === "BOUNCED") {
    return { ok: false, error: "Receipt is already marked BOUNCED" };
  }

  const invoiceIds = [...new Set(r.allocations.map((a) => a.invoiceId))];

  const result = await withTransaction(async (tx: TxClient) => {
    // Drop every allocation from this receipt.
    await tx.receiptAllocation.deleteMany({ where: { receiptId: r.id } });

    // Recompute each affected invoice's status from remaining
    // allocations (across OTHER receipts). SELECT FOR UPDATE keeps
    // parallel bounces/create-receipts from racing on the same row.
    for (const invId of invoiceIds) {
      const locked = await tx.$queryRaw<{
        id: string; total: string; advanceAdjusted: string; status: string;
      }[]>`
        SELECT id, total::text, "advanceAdjusted"::text, status::text
          FROM "Invoice" WHERE id = ${invId} FOR UPDATE
      `;
      const inv = locked[0];
      if (!inv) continue;
      if (inv.status === "CANCELLED") continue;
      const remaining = await tx.receiptAllocation.aggregate({
        where:  { invoiceId: invId },
        _sum:   { amount: true },
      });
      const paid = remaining._sum.amount ?? 0n;
      const outstanding = BigInt(inv.total) - BigInt(inv.advanceAdjusted) - paid;
      const nextStatus = paid === 0n
        ? "ISSUED"
        : outstanding <= 0n ? "PAID" : "PARTIALLY_PAID";
      if (nextStatus !== inv.status) {
        await tx.invoice.update({ where: { id: invId }, data: { status: nextStatus } });
      }
    }

    // Flip the receipt: BOUNCED, unallocated → 0 (funds gone).
    await tx.receipt.update({
      where: { id: r.id },
      data:  { chequeStatus: "BOUNCED", unallocated: 0n },
    });
    await tx.auditLog.create({
      data: {
        orgId: ctx.orgId, actorId: ctx.userId,
        entityType: "Receipt", entityId: r.id,
        action: "BOUNCE_CHEQUE",
        before: {
          chequeStatus: r.chequeStatus,
          allocationCount: r.allocations.length,
          allocatedTotal: (r.amount - r.unallocated).toString(),
        },
        after: {
          chequeStatus: "BOUNCED",
          reason,
          affectedInvoices: invoiceIds,
        },
      },
    });
    return { affectedInvoices: invoiceIds };
  });

  safeRevalidate("/accounts");
  safeRevalidate(`/accounts/${r.id}`);
  safeRevalidate("/invoicing");
  for (const i of invoiceIds) safeRevalidate(`/invoicing/${i}`);
  return { ok: true, data: { receiptId: r.id, affectedInvoices: result.affectedInvoices } };
}

// ── helpers ──────────────────────────────────────────────────────

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
function parsePaise(v: string): bigint | null {
  try { return parseINR(v); } catch { return null; }
}
function asRupees(paise: bigint): string {
  return (Number(paise) / 100).toFixed(2);
}

"use server";

// Cheque lifecycle on a receipt: bounce and clear.
//
// Split out of actions.ts to stay under the §10 300-line limit.
//
// A bounce is the one place money can go backwards. It deletes the
// receipt's allocations, restores the whole amount to `unallocated` and
// recomputes each affected invoice's status — so a payment that never
// really arrived stops counting everywhere at once, including against the
// project balance, which reads `unallocated` for money held against a job.
// getProjectReceivable excludes BOUNCED receipts outright for the same
// reason.

import type { z } from "zod";
import { revalidatePath } from "next/cache";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { computeOutstanding } from "@/kernel/money/outstanding";
import { devContext } from "@/lib/dev-context";
import { bounceReceiptSchema, clearChequeSchema } from "./schema";
import type { ActionResult } from "./actions";

export async function bounceReceipt(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "receipt.reverse");

  const parsed = bounceReceiptSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id } = parsed.data;

  const db  = scoped(ctx);
  const row = await db.receipt.findUnique({
    where: { id },
    select: {
      id: true, number: true, chequeStatus: true, amount: true,
      allocations: { select: { id: true, invoiceId: true, amount: true } },
    },
  });
  if (!row) return { ok: false, error: "Receipt not found." };
  if (row.chequeStatus === "BOUNCED") return { ok: false, error: "Already bounced." };
  if (row.chequeStatus !== "PENDING") {
    return { ok: false, error: "Only PENDING cheques can be bounced." };
  }

  await withTransaction(async (tx: TxClient) => {
    // Lock affected invoices, then delete allocations
    const invoiceIds = [...new Set(row.allocations.map((a) => a.invoiceId))];
    if (invoiceIds.length > 0) {
      await tx.$queryRaw`
        SELECT id FROM "Invoice"
        WHERE id = ANY(${invoiceIds}::text[])
        FOR UPDATE
      `;
    }

    // Delete all ReceiptAllocations for this receipt
    if (row.allocations.length > 0) {
      await tx.receiptAllocation.deleteMany({
        where: { receiptId: id },
      });
    }

    // Mark receipt as bounced, restore unallocated to full amount
    await tx.receipt.update({
      where: { id },
      data: { chequeStatus: "BOUNCED", unallocated: row.amount },
    });

    // Recompute invoice statuses — outstanding restores automatically (computed)
    for (const invId of invoiceIds) {
      const allSum = await tx.receiptAllocation.aggregate({
        where: { invoiceId: invId },
        _sum:  { amount: true },
      });
      const inv = await tx.invoice.findUniqueOrThrow({
        where: { id: invId },
        select: { total: true, advanceAdjusted: true, status: true },
      });
      const outstanding = computeOutstanding(inv.total, inv.advanceAdjusted, allSum._sum.amount ?? 0n);
      const nextStatus  = outstanding <= 0n ? "PAID"
        : (allSum._sum.amount ?? 0n) > 0n   ? "PARTIALLY_PAID"
        :                                      "ISSUED";
      if (nextStatus !== inv.status) {
        await tx.invoice.update({ where: { id: invId }, data: { status: nextStatus } });
      }
    }
  }, { orgId: ctx.orgId });

  revalidatePath("/accounts");
  revalidatePath("/invoicing");
  return { ok: true, data: { id } };
}

export async function clearCheque(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "receipt.reverse");

  const parsed = clearChequeSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id } = parsed.data;

  const db  = scoped(ctx);
  const row = await db.receipt.findUnique({
    where:  { id },
    select: { id: true, chequeStatus: true },
  });
  if (!row) return { ok: false, error: "Receipt not found." };
  if (row.chequeStatus === "CLEARED")  return { ok: false, error: "Already cleared." };
  if (row.chequeStatus !== "PENDING") {
    return { ok: false, error: "Only PENDING cheques can be marked cleared." };
  }

  await db.receipt.update({
    where: { id },
    data:  { chequeStatus: "CLEARED" },
  });

  revalidatePath("/accounts");
  return { ok: true, data: { id } };
}

// ── helpers ─────────────────────────────────────────────────────────────────

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

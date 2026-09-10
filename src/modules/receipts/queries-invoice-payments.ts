// Payments against one invoice — the invoice detail page's Payment Details
// card. Split out of queries.ts to stay under the §10 300-line limit.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface InvoicePaymentRow {
  receiptId: string;
  number:    string;
  date:      Date;
  mode:      string;
  reference: string | null;
  /** Amount of this receipt allocated to the invoice asked about — not
   *  the receipt's full value, which may be spread across several. */
  applied:   bigint;
}

/**
 * Transaction detail for the invoice detail page's Payment Details card
 * (owner, 2026-08-29): payment mode, date and reference number.
 *
 * ReceiptAllocation is the join — a receipt can settle several invoices,
 * so `applied` is the slice belonging to this one. Receipt has no Prisma
 * relation to the allocation (flat schema), hence the two-step read.
 */
export async function listPaymentsForInvoice(
  ctx: RequestContext,
  invoiceId: string,
): Promise<InvoicePaymentRow[]> {
  requirePermission(ctx, "receipt.view");
  const db = scoped(ctx);

  const allocations = await db.receiptAllocation.findMany({
    where:  { invoiceId },
    select: { receiptId: true, amount: true },
  });
  if (allocations.length === 0) return [];

  const receipts = await db.receipt.findMany({
    where:   { id: { in: [...new Set(allocations.map((a) => a.receiptId))] } },
    select:  { id: true, number: true, date: true, mode: true, reference: true },
    orderBy: { date: "desc" },
  });
  const byId = new Map(receipts.map((r) => [r.id, r]));

  return allocations
    .map((a) => {
      const r = byId.get(a.receiptId);
      if (!r) return null;
      return {
        receiptId: r.id,
        number:    r.number,
        date:      r.date,
        mode:      r.mode as string,
        reference: r.reference,
        applied:   a.amount,
      };
    })
    .filter((r): r is InvoicePaymentRow => r !== null)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

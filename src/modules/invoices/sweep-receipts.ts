// Move a project's already-received money onto the invoice that finally
// bills for it.
//
// Under the quotation-first flow the client pays against the accepted
// quotation, long before a tax invoice exists. Those receipts carry
// Receipt.projectId and sit with their full value in `unallocated`. When the
// invoice is raised at the end of the job, the money has to stop being
// "against the project" and become "against this bill" — otherwise the same
// rupees would be counted twice: once by loadProjectReceivables (via
// Receipt.unallocated) and once by computeOutstanding (which would show the
// whole invoice unpaid).
//
// Doing it as real ReceiptAllocation rows, rather than stamping
// Invoice.advanceAdjusted, keeps ONE definition of "paid" in the system: the
// allocation table. The invoice detail page's payment list, the ledger, the
// chase list and the GST reports all read allocations, and they all keep
// working with no special case for money that arrived early.

import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { allocateReceiptToInvoice } from "@/kernel/accounts/allocate";
import { computeOutstanding } from "@/kernel/money/outstanding";

export interface SweepResult {
  /** Paise moved from "against the project" to "against this invoice". */
  applied:      bigint;
  receiptCount: number;
  /** What is still owed on the invoice after the sweep. */
  outstanding:  bigint;
}

export async function sweepProjectReceiptsOntoInvoice(
  opts: { orgId: string; invoiceId: string },
): Promise<SweepResult> {
  return withTransaction(async (tx: TxClient) => {
    const invoice = await tx.invoice.findUnique({
      where:  { id: opts.invoiceId },
      select: { id: true, projectId: true, total: true, advanceAdjusted: true, status: true },
    });
    if (!invoice || !invoice.projectId || invoice.status === "CANCELLED") {
      return { applied: 0n, receiptCount: 0, outstanding: 0n };
    }

    const existing = await tx.receiptAllocation.aggregate({
      where: { invoiceId: invoice.id },
      _sum:  { amount: true },
    });
    let remaining = computeOutstanding(
      invoice.total, invoice.advanceAdjusted, existing._sum.amount ?? 0n,
    );

    // Oldest money first, so the ledger reads in the order it happened.
    const receipts = await tx.receipt.findMany({
      where:   {
        projectId:   invoice.projectId,
        unallocated: { gt: 0n },
        // chequeStatus is nullable — set only on cheques. `{ not: "BOUNCED" }`
        // alone is UNKNOWN for NULL and would skip every cash and UPI
        // payment, leaving the invoice showing its full value unpaid on a
        // job that had already been settled.
        OR: [{ chequeStatus: null }, { chequeStatus: { not: "BOUNCED" } }],
      },
      orderBy: { date: "asc" },
      select:  { id: true, unallocated: true },
    });

    let applied = 0n;
    let receiptCount = 0;
    for (const r of receipts) {
      if (remaining <= 0n) break;
      const take = r.unallocated < remaining ? r.unallocated : remaining;
      if (take <= 0n) continue;

      await allocateReceiptToInvoice(tx, {
        receiptId:      r.id,
        invoiceId:      invoice.id,
        amount:         take,
        organizationId: opts.orgId,
      });
      await tx.receipt.update({
        where: { id: r.id },
        data:  { unallocated: { decrement: take } },
      });

      applied   += take;
      remaining -= take;
      receiptCount += 1;
    }

    if (applied > 0n) {
      await tx.invoice.update({
        where: { id: invoice.id },
        data:  { status: remaining <= 0n ? "PAID" : "PARTIALLY_PAID" },
      });
    }

    return { applied, receiptCount, outstanding: remaining };
  }, { orgId: opts.orgId });
}

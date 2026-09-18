// An invoice's status after money has been taken OFF it.
//
// Used by deleteReceipt: once a payment's allocations are removed, each
// touched invoice goes back to whatever its remaining payments justify.
// Call inside the transaction, after the allocations are gone.
//
// Close to the rule bounceReceipt applies inline, with one deliberate
// difference: CANCELLED and DRAFT invoices are left alone rather than
// being set to ISSUED.

import type { TxClient } from "@/kernel/db/transaction";
import { computeOutstanding } from "@/kernel/money/outstanding";

export async function recomputeInvoiceStatuses(
  tx:         TxClient,
  invoiceIds: readonly string[],
): Promise<void> {
  for (const invId of invoiceIds) {
    const allSum = await tx.receiptAllocation.aggregate({
      where: { invoiceId: invId },
      _sum:  { amount: true },
    });
    const inv = await tx.invoice.findUniqueOrThrow({
      where:  { id: invId },
      select: { total: true, advanceAdjusted: true, status: true },
    });
    // Cancelled and draft invoices are not in the paid/unpaid cycle.
    if (inv.status === "CANCELLED" || inv.status === "DRAFT") continue;
    const paid        = allSum._sum.amount ?? 0n;
    const outstanding = computeOutstanding(inv.total, inv.advanceAdjusted, paid);
    const nextStatus  = outstanding <= 0n ? "PAID"
      : paid > 0n                         ? "PARTIALLY_PAID"
      :                                     "ISSUED";
    if (nextStatus !== inv.status) {
      await tx.invoice.update({ where: { id: invId }, data: { status: nextStatus } });
    }
  }
}

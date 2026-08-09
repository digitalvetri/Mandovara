// Minimal receipt-allocation service for the Session 6 concurrency test.
// Full accounts module lands in Session 17. Behaviour we lock in here:
//
//   1. SELECT ... FOR UPDATE on the target Invoice row → serialises
//      concurrent allocations against the same invoice.
//   2. Aggregate existing allocations INSIDE the same tx (safe because of
//      the invoice row lock).
//   3. Reject if new amount would overshoot invoice total.
//   4. Insert ReceiptAllocation atomically inside the same tx.

import type { TxClient } from "@/kernel/db/transaction";

export interface AllocateReceiptParams {
  receiptId: string;
  invoiceId: string;
  amount: bigint;   // paise
  organizationId: string;
}

export class OverAllocationError extends Error {
  constructor(readonly invoiceId: string, readonly attempted: bigint, readonly remaining: bigint) {
    super(
      `Cannot allocate ${attempted.toString()} paise to invoice ${invoiceId}: ` +
        `only ${remaining.toString()} paise remaining`,
    );
    this.name = "OverAllocationError";
  }
}

export async function allocateReceiptToInvoice(
  tx: TxClient,
  params: AllocateReceiptParams,
): Promise<void> {
  if (params.amount <= 0n) throw new Error(`allocateReceipt: amount must be positive`);

  // Lock the invoice row. Concurrent txns allocating to the same invoice
  // queue behind us.
  const rows = await tx.$queryRaw<{ id: string; total: bigint; advanceAdjusted: bigint }[]>`
    SELECT "id", "total", "advanceAdjusted"
    FROM "Invoice"
    WHERE "id" = ${params.invoiceId}
    FOR UPDATE
  `;
  const invoice = rows[0];
  if (!invoice) throw new Error(`allocateReceipt: invoice ${params.invoiceId} not found`);

  // Sum existing allocations against this invoice — safe inside the lock.
  const sum = await tx.receiptAllocation.aggregate({
    where: { invoiceId: params.invoiceId },
    _sum: { amount: true },
  });
  const alreadyAllocated = sum._sum.amount ?? 0n;
  // outstanding = total − advanceAdjusted − Σ allocations (mirrors computeOutstanding)
  const remaining = invoice.total - invoice.advanceAdjusted - alreadyAllocated;

  if (params.amount > remaining) {
    throw new OverAllocationError(params.invoiceId, params.amount, remaining);
  }

  await tx.receiptAllocation.create({
    data: {
      organizationId: params.organizationId,
      receiptId: params.receiptId,
      invoiceId: params.invoiceId,
      amount: params.amount,
    },
  });
}

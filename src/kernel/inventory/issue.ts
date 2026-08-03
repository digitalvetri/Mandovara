// Minimal stock-issue service — just enough for the Session 6 concurrency test.
// The full inventory module lands in Session 14. Keep this file's behaviour
// aligned with what Session 14 will implement:
//
//   1. SELECT ... FOR UPDATE on the StockBalance row → serialises concurrent
//      issues of the same SKU.
//   2. Reject if requested qty > available qty (NegativeStockError).
//   3. Append a StockLedgerEntry (OUT direction).
//   4. Update StockBalance atomically inside the same transaction.
//
// StockLedgerEntry is DB-immutable (Session 3 trigger), so there is no
// UPDATE / DELETE path here — reversals in Session 14 will be new IN rows.

import { Prisma } from "@prisma/client";
import type { TxClient } from "@/kernel/db/transaction";

export interface IssueParams {
  orgId: string;
  warehouseId: string;
  productId: string;
  quantity: string | number;   // Decimal-compatible
  rate: bigint;                // valuation rate in paise
  refType: string;             // "DISPATCH" | "PROJECT_ISSUE" | ...
  refId: string;
  occurredAt?: Date;
}

export class NegativeStockError extends Error {
  constructor(readonly productId: string, readonly requested: string, readonly available: string) {
    super(`Cannot issue ${requested} of product ${productId}: only ${available} available`);
    this.name = "NegativeStockError";
  }
}

export async function issueStock(tx: TxClient, params: IssueParams): Promise<void> {
  const qty = new Prisma.Decimal(params.quantity.toString());
  if (qty.isNegative() || qty.isZero()) {
    throw new Error(`issueStock: quantity must be positive, got ${qty.toString()}`);
  }

  // Lock the balance row for the duration of this transaction. Any concurrent
  // txn issuing the same SKU + warehouse queues until we commit or roll back.
  const rows = await tx.$queryRaw<{ id: string; quantity: string }[]>`
    SELECT "id", "quantity"::text AS "quantity"
    FROM "StockBalance"
    WHERE "orgId" = ${params.orgId}
      AND "warehouseId" = ${params.warehouseId}
      AND "productId" = ${params.productId}
    FOR UPDATE
  `;
  const row = rows[0];
  const available = new Prisma.Decimal(row?.quantity ?? "0");

  if (available.lessThan(qty)) {
    throw new NegativeStockError(params.productId, qty.toString(), available.toString());
  }

  await tx.stockLedgerEntry.create({
    data: {
      orgId: params.orgId,
      warehouseId: params.warehouseId,
      productId: params.productId,
      direction: "OUT",
      quantity: qty,
      rate: params.rate,
      refType: params.refType,
      refId: params.refId,
      occurredAt: params.occurredAt ?? new Date(),
    },
  });

  const newQty = available.minus(qty);
  if (row) {
    await tx.stockBalance.update({
      where: { id: row.id },
      data: {
        quantity: newQty,
        // value adjusted proportionally; full FIFO/weighted-avg in Session 14
        value: BigInt(newQty.mul(params.rate.toString()).toFixed(0)),
      },
    });
  } else {
    // No prior balance — creating with zero net after issue means the
    // check above should have thrown. This path is unreachable.
    throw new NegativeStockError(params.productId, qty.toString(), "0");
  }
}

// allocateStockBalance — reserve stock for an order line.
//
// Mirrors the receipt-allocation kernel (src/kernel/accounts/allocate.ts):
//   1. Check existing allocations for this order line — detect mixed-lot conflict.
//   2. SELECT ... FOR UPDATE on StockBalance → serialises concurrent allocations.
//   3. Compute available = quantity − reserved; reject if insufficient.
//   4. Increment reserved, insert Allocation and StockMove(ALLOCATE) atomically.
//
// The caller is responsible for opening the transaction (withTransaction).
// NEVER call this outside a transaction.

import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import type { TxClient } from "@/kernel/db/transaction";
import { InsufficientStockError, MixedLotError } from "@/modules/stock/lib";

export interface AllocateStockParams {
  organizationId:   string;
  orderLineId:      string;
  colourwayId:      string;
  dyeLot:           string | null;
  quantity:         Decimal;
  rate:             bigint;
  createdById:      string;
  mixedLotOverride?: boolean;
  overrideReason?:   string;
  overrideById?:     string;
}

export async function allocateStockBalance(
  tx: TxClient,
  params: AllocateStockParams,
): Promise<void> {
  const {
    organizationId, orderLineId, colourwayId, dyeLot, quantity,
    rate, createdById, mixedLotOverride, overrideReason, overrideById,
  } = params;

  // Mixed-lot guard: existing allocations for this order line must share the same lot
  const existing = await tx.allocation.findMany({
    where: { organizationId, orderLineId },
    select: { dyeLot: true },
  });
  if (existing.length > 0) {
    const existingLot = existing[0]!.dyeLot ?? null;
    if (existingLot !== (dyeLot ?? null) && !mixedLotOverride) {
      throw new MixedLotError(orderLineId, existingLot, dyeLot ?? null);
    }
  }

  // Lock the balance row to serialise concurrent allocation attempts for the same lot
  const lotFilter =
    dyeLot !== null
      ? Prisma.sql`"dyeLot" = ${dyeLot}`
      : Prisma.sql`"dyeLot" IS NULL`;

  const locked = await tx.$queryRaw<{ id: string; quantity: string; reserved: string }[]>(
    Prisma.sql`
      SELECT "id", "quantity"::text, "reserved"::text
      FROM "StockBalance"
      WHERE "organizationId" = ${organizationId}
        AND "colourwayId" = ${colourwayId}
        AND ${lotFilter}
      FOR UPDATE
    `,
  );

  if (locked.length === 0) {
    throw new InsufficientStockError(colourwayId, dyeLot ?? null, quantity, new Decimal(0));
  }

  const row = locked[0]!;
  const available = new Decimal(row.quantity).minus(new Decimal(row.reserved));

  if (quantity.gt(available)) {
    throw new InsufficientStockError(colourwayId, dyeLot ?? null, quantity, available);
  }

  // Increment reserved
  await tx.stockBalance.update({
    where: { id: row.id },
    data:  { reserved: { increment: quantity } },
  });

  // Insert Allocation row (the explicit audit trail for what went where)
  await tx.allocation.create({
    data: {
      organizationId,
      orderLineId,
      colourwayId,
      ...(dyeLot !== null ? { dyeLot } : {}),
      quantity,
      mixedLotOverride: mixedLotOverride ?? false,
      ...(overrideReason ? { overrideReason } : {}),
      ...(overrideById   ? { overrideById }   : {}),
    },
  });

  // Append-only ledger row — DB trigger blocks UPDATE/DELETE on StockMove
  await tx.stockMove.create({
    data: {
      organizationId,
      colourwayId,
      ...(dyeLot !== null ? { dyeLot } : {}),
      type:      "ALLOCATE",
      quantity,
      rate,
      refType:   "ORDER_LINE",
      refId:     orderLineId,
      occurredAt: new Date(),
      createdById,
    },
  });
}

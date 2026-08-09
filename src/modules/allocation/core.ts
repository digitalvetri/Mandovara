// Core dye-lot allocation primitive — the concurrency-critical bit.
// Uses StockBalance (not Batch) and Allocation (not LotAllocation).
// SELECT ... FOR UPDATE on StockBalance ensures no over-allocation under concurrency.

import { Prisma } from "@/kernel/numbering/series";
import type { TxClient } from "@/kernel/db/transaction";

export class AllocationError extends Error {
  fieldKey?: string;
  constructor(msg: string, fieldKey?: string) {
    super(msg);
    this.name = "AllocationError";
    if (fieldKey != null) this.fieldKey = fieldKey;
  }
}

export interface AllocateParams {
  organizationId:   string;
  orderLineId:      string;
  stockBalanceId:   string;   // StockBalance.id — was batchId
  quantity:         number | string | Prisma.Decimal;
  mixedLotOverride: boolean;
  overrideReason:   string | null;
  actorId:          string;
  actorCanOverride: boolean;
}

export interface AllocationResult {
  id:           string;
  wouldBeMixed: boolean;
  dyeLot:       string | null;
}

export async function allocateInTx(
  tx: TxClient,
  p: AllocateParams,
): Promise<AllocationResult> {
  const requested = new Prisma.Decimal(p.quantity);
  if (requested.lte(0)) {
    throw new AllocationError("Quantity must be > 0", "quantity");
  }

  // (1) SELECT FOR UPDATE the StockBalance row — concurrent callers serialise.
  const [locked] = await tx.$queryRaw<
    { id: string; quantity: string; reserved: string; dye_lot: string | null; colourway_id: string }[]
  >(Prisma.sql`
    SELECT id, quantity::text AS quantity, reserved::text AS reserved,
           "dyeLot" AS dye_lot, "colourwayId" AS colourway_id
    FROM "StockBalance"
    WHERE id = ${p.stockBalanceId}
    FOR UPDATE
  `);
  if (!locked) throw new AllocationError("Stock lot not found", "batchId");

  // (2) Verify the order-line colourway matches the stock balance colourway.
  const line = await tx.orderLine.findUnique({
    where:  { id: p.orderLineId },
    select: { id: true, colourwayId: true },
  });
  if (!line) throw new AllocationError("Order line not found", "orderLineId");
  if (line.colourwayId !== locked.colourway_id) {
    throw new AllocationError(
      "Lot colourway does not match order-line colourway",
      "batchId",
    );
  }

  // (3) Available = on-hand − reserved (StockBalance.reserved tracks active allocations).
  const available = new Prisma.Decimal(locked.quantity).minus(locked.reserved);
  if (available.lt(requested)) {
    const lotLabel = locked.dye_lot ?? "(no lot)";
    throw new AllocationError(
      `Only ${available.toString()} available on lot ${lotLabel} — requested ${requested.toString()}`,
      "quantity",
    );
  }

  // (4) Mixed-lot gate — check existing allocations for this line.
  const existingOnLine = await tx.allocation.findMany({
    where:  { orderLineId: p.orderLineId },
    select: { dyeLot: true },
  });
  const wouldBeMixed = existingOnLine.some((a) => a.dyeLot !== locked.dye_lot);
  if (wouldBeMixed) {
    if (!p.mixedLotOverride) {
      throw new AllocationError(
        "Order line already has a different dye-lot allocated. Confirm mixed-lot override with a reason.",
        "mixedLotOverride",
      );
    }
    if (!p.actorCanOverride) {
      throw new AllocationError(
        "You do not have permission to override the mixed-lot rule.",
        "mixedLotOverride",
      );
    }
    const reason = (p.overrideReason ?? "").trim();
    if (reason.length < 4) {
      throw new AllocationError(
        "A reason (at least 4 characters) is required for a mixed-lot override.",
        "overrideReason",
      );
    }
  }

  // (5) Persist — create Allocation + increment StockBalance.reserved.
  const alloc = await tx.allocation.create({
    data: {
      organizationId:   p.organizationId,
      orderLineId:      p.orderLineId,
      colourwayId:      locked.colourway_id,
      dyeLot:           locked.dye_lot,
      quantity:         requested,
      mixedLotOverride: wouldBeMixed,
      ...(wouldBeMixed && p.overrideReason && {
        overrideReason: p.overrideReason.trim(),
        overrideById:   p.actorId,
      }),
    },
    select: { id: true },
  });

  await tx.stockBalance.update({
    where: { id: p.stockBalanceId },
    data:  { reserved: { increment: requested } },
  });

  return { id: alloc.id, wouldBeMixed, dyeLot: locked.dye_lot };
}

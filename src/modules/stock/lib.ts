import { Decimal } from "@prisma/client/runtime/library";

// ── Error classes ─────────────────────────────────────────────────────────────

export class InsufficientStockError extends Error {
  constructor(
    readonly colourwayId: string,
    readonly dyeLot: string | null,
    readonly requested: Decimal,
    readonly available: Decimal,
  ) {
    super(
      `Insufficient stock for colourway ${colourwayId} lot ${dyeLot ?? "(none)"}: ` +
        `requested ${requested.toString()}, available ${available.toString()}`,
    );
    this.name = "InsufficientStockError";
  }
}

export class MixedLotError extends Error {
  constructor(
    readonly orderLineId: string,
    readonly existingLot: string | null,
    readonly requestedLot: string | null,
  ) {
    super(
      `Allocation for order line ${orderLineId} already has lot "${existingLot ?? "(none)"}" — ` +
        `allocating lot "${requestedLot ?? "(none)"}" would mix dye lots`,
    );
    this.name = "MixedLotError";
  }
}

// ── Pure functions ─────────────────────────────────────────────────────────────

export function availableQty(balance: { quantity: Decimal; reserved: Decimal }): Decimal {
  return balance.quantity.minus(balance.reserved);
}

/**
 * Returns true if the incoming dye lot would create a mixed-lot situation
 * on the same order line. Called before any DB writes.
 */
export function detectMixedLot(
  existingDyeLots: (string | null)[],
  incomingDyeLot: string | null,
): boolean {
  if (existingDyeLots.length === 0) return false;
  return (existingDyeLots[0] ?? null) !== (incomingDyeLot ?? null);
}

/**
 * Converts a Decimal quantity and BigInt rate (paise/unit) to total paise.
 * Scales via 1 000 000 to preserve 6 decimal places before integer division.
 */
export function qtyPaise(qty: Decimal, ratePerUnit: bigint): bigint {
  const qtyMicro = BigInt(qty.mul(new Decimal(1_000_000)).round().toNumber());
  return (ratePerUnit * qtyMicro) / 1_000_000n;
}

import { Decimal } from "@prisma/client/runtime/library";

// Pure stock helpers. The mixed-lot machinery that used to live here
// (MixedLotError, InsufficientStockError, detectMixedLot) went with the
// dye-lot allocation console — nothing reserves lots to order lines any more.
// Lot codes are still recorded at goods-receipt, on balances and on install
// lines; they are simply no longer a reservation.

export function availableQty(balance: { quantity: Decimal; reserved: Decimal }): Decimal {
  return balance.quantity.minus(balance.reserved);
}


/**
 * Converts a Decimal quantity and BigInt rate (paise/unit) to total paise.
 * Scales via 1 000 000 to preserve 6 decimal places before integer division.
 */
export function qtyPaise(qty: Decimal, ratePerUnit: bigint): bigint {
  const qtyMicro = BigInt(qty.mul(new Decimal(1_000_000)).round().toNumber());
  return (ratePerUnit * qtyMicro) / 1_000_000n;
}

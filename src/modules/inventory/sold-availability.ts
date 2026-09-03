// How much of a SKU may be sold over the counter right now.
//
// A pure function, deliberately: the rule it encodes is the one thing in
// the counter-sale path that can quietly lose the studio money, and a
// rule worth getting right is worth testing without a database.
//
// A sale has to clear two ceilings:
//
//   · the shelf   — you cannot take 5m off a lot that holds 3m
//   · the promise — you cannot sell what a live quote or a confirmed
//                   order is already counting on
//
// Reservations are tracked per colourway, not per dye lot, which is what
// makes the lot case fiddly. Charging the SKU's whole reservation
// against one lot would refuse sales the studio can genuinely make
// (20m across two lots, 12m committed: either lot can still give up
// some). But ignoring the reservation on a lot sale hands the operator
// a lot dropdown that walks straight past the guard, and a confirmed
// order gets stranded. So a lot's ceiling is the LOWER of what sits on
// that lot and what the SKU as a whole has spare.

import { Decimal } from "@prisma/client/runtime/library";

export interface LotBalance {
  dyeLot:   string | null;
  quantity: Decimal | string | number;
}

export interface SaleCeiling {
  /** The most that may be sold, never below zero. */
  available:      Decimal;
  /** Physical stock across every lot. */
  totalOnHand:    Decimal;
  /** Physical stock on the chosen lot, or totalOnHand when none was chosen. */
  onHand:         Decimal;
  /** totalOnHand − reserved, floored at zero. */
  skuUncommitted: Decimal;
  /** True when the binding limit was live quotes/orders, not the shelf.
   *  Drives which sentence the operator is shown. */
  blockedByCommitment: boolean;
}

/**
 * @param balances every StockBalance row for the colourway — all lots,
 *   not pre-filtered. Both readings are taken from the one list.
 * @param dyeLot   the lot being sold from, or null for the whole SKU.
 * @param reserved units committed to live quotes and non-terminal orders,
 *   as computeReservations reports them (per colourway).
 */
export function saleCeiling(
  balances: readonly LotBalance[],
  dyeLot:   string | null,
  reserved: number,
): SaleCeiling {
  const zero = new Decimal(0);

  const totalOnHand = balances.reduce(
    (sum, b) => sum.plus(new Decimal(b.quantity)), zero);

  const onHand = dyeLot == null
    ? totalOnHand
    : balances
        .filter((b) => b.dyeLot === dyeLot)
        .reduce((sum, b) => sum.plus(new Decimal(b.quantity)), zero);

  const skuUncommitted = Decimal.max(totalOnHand.minus(new Decimal(reserved)), zero);

  const available = Decimal.max(
    dyeLot == null ? skuUncommitted : Decimal.min(onHand, skuUncommitted),
    zero,
  );

  return {
    available,
    totalOnHand,
    onHand,
    skuUncommitted,
    // Only a genuine commitment counts as "spoken for". When nothing is
    // reserved the shelf is always the reason, even though the two
    // numbers happen to be equal.
    blockedByCommitment: reserved > 0 && available.equals(skuUncommitted),
  };
}

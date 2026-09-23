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

/**
 * The ceiling for CORRECTING a sale already recorded.
 *
 * The sale being edited has already come off the shelf, so the stock it
 * took is not "gone" as far as the correction is concerned — it goes
 * back on the lot it came from before the new quantity is measured
 * against the two ceilings. Without that credit, a sale that took the
 * last 5m on a lot could not be re-saved at 5m — the shelf reads zero.
 *
 * @param originalQty what the sale being edited recorded.
 */
export function editSaleCeiling(
  balances:    readonly LotBalance[],
  dyeLot:      string | null,
  reserved:    number,
  originalQty: Decimal | string | number,
): SaleCeiling {
  return saleCeiling([...balances, { dyeLot, quantity: originalQty }], dyeLot, reserved);
}

// ── Baskets ─────────────────────────────────────────────────────────────────
//
// A multi-item sale can put the SAME SKU on two lines — 10 boxes of 1505
// and, three lines later, another 10. Checking each line against
// saleCeiling on its own passes both and oversells the shelf, because
// neither line knows about the other. So the basket is checked with a
// RUNNING draw: line n is measured against what is left after lines
// 1..n−1 have taken theirs.
//
// Two running totals are kept per SKU, because there are two ceilings:
//   · per (SKU, lot)  — against what physically sits on that lot
//   · per SKU         — against on-hand minus what quotes and orders
//                       have already committed
//
// That second one is what catches the case worth having tests for: a
// line on lot A and a line on "any lot" for the same SKU both draw from
// the same uncommitted pool, and only the SKU-wide total sees it.

export interface BasketLine {
  colourwayId: string;
  dyeLot:      string | null;
  quantity:    Decimal | string | number;
}

/** The first line of a basket that cannot be honoured, with the numbers
 *  needed to say why. Null means the whole basket clears. */
export interface BasketBreach {
  /** Index into the basket, so the refusal can name the offending line. */
  lineIndex:   number;
  colourwayId: string;
  dyeLot:      string | null;
  /** What is left for this line after the lines above it took theirs. */
  available:   Decimal;
  requested:   Decimal;
  totalOnHand: Decimal;
  /** True when the binding limit was live quotes/orders, not the shelf. */
  blockedByCommitment: boolean;
}

/**
 * Check a whole basket at once.
 *
 * @param lines    the basket, in the order the operator entered it —
 *   the breach is reported against the first line that cannot be met,
 *   which is the one they can most sensibly be asked to fix.
 * @param balances every StockBalance row per colourway, unfiltered.
 * @param reserved units committed to live quotes and orders, per
 *   colourway, as computeReservations reports them.
 */
export function checkBasket(
  lines:    readonly BasketLine[],
  balances: ReadonlyMap<string, readonly LotBalance[]>,
  reserved: ReadonlyMap<string, number>,
): BasketBreach | null {
  const zero = new Decimal(0);
  /** Running draw per colourway, and per colourway+lot. */
  const drawnBySku = new Map<string, Decimal>();
  const drawnByLot = new Map<string, Decimal>();

  for (const [lineIndex, line] of lines.entries()) {
    const lots    = balances.get(line.colourwayId) ?? [];
    const ceiling = saleCeiling(lots, line.dyeLot, reserved.get(line.colourwayId) ?? 0);
    const qty     = new Decimal(line.quantity);

    const lotKey  = `${line.colourwayId}\u0000${line.dyeLot ?? ""}`;
    const skuDraw = (drawnBySku.get(line.colourwayId) ?? zero).plus(qty);
    const lotDraw = (drawnByLot.get(lotKey) ?? zero).plus(qty);

    // Whichever ceiling bites first. The lot one only applies when a lot
    // was chosen; ceiling.available already folds it in for that line,
    // but the running totals have to be measured against the raw
    // ceilings, not against a single-line "available".
    const skuHeadroom = Decimal.max(ceiling.skuUncommitted.minus(skuDraw.minus(qty)), zero);
    const lotHeadroom = line.dyeLot == null
      ? skuHeadroom
      : Decimal.max(
          Decimal.min(ceiling.onHand.minus(lotDraw.minus(qty)), skuHeadroom),
          zero,
        );

    if (qty.gt(lotHeadroom)) {
      return {
        lineIndex,
        colourwayId: line.colourwayId,
        dyeLot:      line.dyeLot,
        available:   lotHeadroom,
        requested:   qty,
        totalOnHand: ceiling.totalOnHand,
        // Only blame the commitment when it is genuinely what bit: the
        // SKU pool was the tighter of the two AND something is reserved.
        blockedByCommitment:
          (reserved.get(line.colourwayId) ?? 0) > 0 && lotHeadroom.equals(skuHeadroom),
      };
    }

    drawnBySku.set(line.colourwayId, skuDraw);
    drawnByLot.set(lotKey, lotDraw);
  }

  return null;
}

// The basket behind "Record a sale" — what one line of it is, and the
// arithmetic the form does on it before anything is sent.
//
// Kept out of the components so the money rules are readable in one
// place: quantities can carry three decimals and rates are BigInt paise
// (CLAUDE.md #8), so a line's value is multiplied in thousandths and
// divided back down — never through a float, exactly as
// modules/inventory/queries-sold.ts does it server-side.

import { parseINR } from "@/kernel/money/format";
import type { SellableItem } from "@/modules/inventory/queries-sold";

/** One item added to the sale, as the form holds it. */
export interface SaleLine {
  /** Stable key for React and for removal — a SKU can appear twice. */
  key:      string;
  item:     SellableItem;
  /** "" means "any lot". */
  dyeLot:   string;
  /** As typed, so what the operator sees is what is sent. */
  qty:      string;
  rate:     string;
}

/** The quantity as a number, or NaN when the field cannot be read. */
export function lineQty(l: SaleLine): number {
  return Number(l.qty);
}

/** Per-unit price in paise. 0 when blank or unreadable — an unpriced
 *  sample still has to leave the shelf. */
export function lineRatePaise(l: SaleLine): bigint {
  if (!l.rate.trim()) return 0n;
  try {
    return parseINR(l.rate.trim());
  } catch {
    return 0n;
  }
}

/** quantity × rate, in paise. */
export function lineTotalPaise(l: SaleLine): bigint {
  const q = lineQty(l);
  if (!Number.isFinite(q) || q <= 0) return 0n;
  // Thousandths, to match StockBalance.quantity's three decimals.
  return (lineRatePaise(l) * BigInt(Math.round(q * 1000))) / 1000n;
}

export function basketTotalPaise(lines: readonly SaleLine[]): bigint {
  return lines.reduce((sum, l) => sum + lineTotalPaise(l), 0n);
}

/**
 * How much of each SKU the basket has already spoken for.
 *
 * The picker subtracts this from the availability it shows, so adding
 * 10 and then 10 more of a SKU with 15 on the shelf is refused while the
 * operator is still looking at the item, instead of by a server error
 * after the whole basket has been typed. The server re-checks the same
 * rule regardless (CLAUDE.md #11) — this is the courtesy, not the rule.
 *
 * Counted per SKU, not per dye lot, so a basket that takes 8 off lot A
 * shows 8 less on the SKU as a whole even though lot B still holds its
 * own. Conservative in the safe direction — it can only ever offer LESS
 * than checkBasket would allow, never more — and the server's per-lot
 * ceiling is the one that decides.
 */
export function basketDraw(lines: readonly SaleLine[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const l of lines) {
    const q = lineQty(l);
    if (!Number.isFinite(q) || q <= 0) continue;
    out.set(l.item.colourwayId, (out.get(l.item.colourwayId) ?? 0) + q);
  }
  return out;
}

/** The sellable list with what the basket already holds taken off, and
 *  anything fully spoken for dropped — a picker's job is choosing what
 *  can still be sold. */
export function remainingItems(
  items: readonly SellableItem[],
  lines: readonly SaleLine[],
): SellableItem[] {
  const drawn = basketDraw(lines);
  return items
    .map((i) => {
      const taken = drawn.get(i.colourwayId) ?? 0;
      if (taken === 0) return i;
      return { ...i, available: String(Math.max(Number(i.available) - taken, 0)) };
    })
    .filter((i) => Number(i.available) > 0);
}

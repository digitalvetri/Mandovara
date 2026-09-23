// Zod schema for the counter-sale ("Sold out") form.
//
// Separate from ./schema.ts because a sale is not an adjustment. An
// adjustment corrects a count that was wrong; a sale removes stock that
// was right and has now left the building against a customer. They carry
// different fields — a sale has a price and a buyer, an adjustment has a
// reason — and they must stay distinguishable in the StockMove ledger,
// which is why SOLD_OUT exists as its own StockMoveType.

import { z } from "zod";

const idField = z.string().min(20).max(64);

export const recordStockSaleSchema = z.object({
  colourwayId: idField,
  /** Dye lot the pieces came off, when the SKU is lot-tracked. */
  dyeLot:      z.string().trim().max(80).optional().or(z.literal("")),
  /** Pieces / metres sold. Positive — the sign is the action's business,
   *  not the operator's. Three decimals to match StockBalance.quantity. */
  quantity:    z.number().positive("Enter how many were sold"),
  /** Sale price per unit, as typed: "1200", "1,200.50", "1.2k". Parsed
   *  with parseINR into BigInt paise — never a float (CLAUDE.md #8).
   *  Optional: a sample handed over at cost still has to leave stock. */
  rate:        z.string().trim().max(20).optional().or(z.literal("")),
  /** Who bought it. Free text — a counter sale is often a walk-in with
   *  no client record, and forcing one would stop the stock being
   *  written down at all. */
  soldTo:      z.string().trim().max(120).optional().or(z.literal("")),
  soldOn:      z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Must be YYYY-MM-DD"),
  note:        z.string().trim().max(300).optional().or(z.literal("")),
});

export type RecordStockSaleInput = z.infer<typeof recordStockSaleSchema>;

/**
 * One item on a multi-item counter sale.
 *
 * Everything that varies per item and nothing that doesn't — the buyer,
 * the date and the note are typed once for the whole basket and live on
 * the parent (see recordStockSaleBatchSchema).
 */
export const saleLineSchema = z.object({
  colourwayId: idField,
  dyeLot:      z.string().trim().max(80).optional().or(z.literal("")),
  quantity:    z.number().positive("Enter how many were sold"),
  rate:        z.string().trim().max(20).optional().or(z.literal("")),
});

/**
 * A counter sale of one or more items to the same buyer.
 *
 * Owner instruction, 2026-09-23: "a single client can purchase too many
 * items … I need to enter the client name one time and then mark the
 * details of each product."
 *
 * There is no sale-header row in the schema and this does not invent one
 * (CLAUDE.md #14) — a sale IS its StockMove rows. A five-item basket
 * writes five SOLD_OUT moves carrying the same buyer, note and date, so
 * the Sold out list, its totals and the edit pencil keep working
 * unchanged.
 *
 * Cap of 50 lines: past that it is a delivery order, not a counter sale,
 * and one transaction should not be asked to carry it.
 */
export const recordStockSaleBatchSchema = z.object({
  soldTo: z.string().trim().max(120).optional().or(z.literal("")),
  soldOn: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Must be YYYY-MM-DD"),
  note:   z.string().trim().max(300).optional().or(z.literal("")),
  lines:  z.array(saleLineSchema).min(1, "Add at least one item").max(50),
});

export type RecordStockSaleBatchInput = z.infer<typeof recordStockSaleBatchSchema>;

/**
 * Correcting a sale already recorded. The item and the dye lot are
 * fixed: a different item or lot is a different physical movement, and
 * is a new sale, not an edit of this one.
 */
export const updateStockSaleSchema = z.object({
  id:       idField,
  quantity: z.number().positive("Enter how many were sold"),
  rate:     z.string().trim().max(20).optional().or(z.literal("")),
  /** Buyer and note as one line — that is how the ledger row stores them
   *  (StockMove.refId), so the edit shows them the same way. */
  soldTo:   z.string().trim().max(300).optional().or(z.literal("")),
  soldOn:   z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Must be YYYY-MM-DD"),
});

export type UpdateStockSaleInput = z.infer<typeof updateStockSaleSchema>;

/** Zod issues → { "field.path": first message }, for the forms. */
export function fieldErrorsOf(
  issues: readonly { path: PropertyKey[]; message: string }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const iss of issues) {
    const p = iss.path
      .filter((s): s is string | number => typeof s === "string" || typeof s === "number")
      .join(".");
    if (!out[p]) out[p] = iss.message;
  }
  return out;
}

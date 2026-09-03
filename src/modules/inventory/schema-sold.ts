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

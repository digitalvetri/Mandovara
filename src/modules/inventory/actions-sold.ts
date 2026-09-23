"use server";

// Record a counter sale — the "Sold out" tab under Stock.
//
// Owner instruction, 2026-09-04: "select the item from the stock, say
// how many pieces were sold, and that should be reduced from the stock
// list." Until now the only outward path from /inventory was
// adjustStock, whose reasons are STOCK_TAKE, DAMAGE, THEFT, EXPIRY and
// OTHER — so every sale was being filed as a correction or as loss, and
// "what did we sell" could not be answered from the ledger at all.
//
// Shaped deliberately like adjustStock, because it is the same physical
// event with a different meaning: one StockMove row, one StockBalance
// upsert, then a reorder check, all inside one transaction, with the
// domain event published only after it commits.
//
// Two things it does that adjustStock does not:
//   · refuses to sell more than is AVAILABLE (on-hand minus what live
//     quotes and orders have already committed), rather than only
//     refusing to go below zero. Selling stock off the shelf that a
//     confirmed order is waiting on is the expensive mistake here, and
//     the lot dropdown must not be a way around it — see the gate.
//   · records the sale price, so the move carries what the stock left
//     for and not just what it cost.

import { recordStockSaleBatch } from "./actions-sold-batch";
import { fieldErrorsOf, recordStockSaleSchema } from "./schema-sold";
import type { ActionResult } from "./actions";

/**
 * Record a single-item counter sale.
 *
 * Since 2026-09-23 the form records a basket of items against one buyer,
 * and the rules above — the availability gate, the average-cost
 * write-down, the reorder check, the one-transaction guarantee — all
 * live in recordStockSaleBatch, which is the same code applied per line.
 * This stays as the one-line door into it so callers that have exactly
 * one item to sell need not know about baskets.
 */
export async function recordStockSale(
  input: unknown,
): Promise<ActionResult<{ id: string; newOnHand: string }>> {
  const parsed = recordStockSaleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Validation failed",
      fieldErrors: fieldErrorsOf(parsed.error.issues),
    };
  }
  const d = parsed.data;

  const res = await recordStockSaleBatch({
    soldOn: d.soldOn,
    ...(d.soldTo ? { soldTo: d.soldTo } : {}),
    ...(d.note   ? { note:   d.note }   : {}),
    lines: [{
      colourwayId: d.colourwayId,
      quantity:    d.quantity,
      ...(d.dyeLot ? { dyeLot: d.dyeLot } : {}),
      ...(d.rate   ? { rate:   d.rate }   : {}),
    }],
  });

  if (!res.ok) {
    // The basket action reports against "lines.0.x"; a single-item
    // caller only knows about "x".
    const fieldErrors: Record<string, string> = {};
    for (const [k, v] of Object.entries(res.fieldErrors ?? {})) {
      fieldErrors[k.replace(/^lines\.0\./, "")] = v;
    }
    return { ok: false, error: res.error ?? "Could not record the sale", fieldErrors };
  }

  return {
    ok: true,
    data: {
      id:        res.data?.ids[0] ?? "",
      newOnHand: res.data?.newOnHand[d.colourwayId] ?? "",
    },
  };
}

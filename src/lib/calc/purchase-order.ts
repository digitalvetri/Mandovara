// Pure BigInt GST calculation for purchase orders — no floating point money
// (CLAUDE.md rule 8). Shares the per-line split with vendor bills so a PO and
// the bill that follows it can never disagree by a paisa.

import { calcBillLine, calcBillTotals, type BillTotals } from "./vendor-bill";

export interface POLineAmount {
  ratePaise:      bigint;   // ex-GST rate in paise
  quantityScaled: bigint;   // quantity × 10_000, no floats
  gstRatePct:     number;   // 0 | 5 | 12 | 18 | 28
}

/**
 * Ordered value of a purchase order.
 *
 * `total` is GST-inclusive — it is what the vendor will be paid, and it is
 * what `PurchaseOrder.totalValue` stores, matching the sales-side convention
 * on `Order.totalValue`. `taxableAmount` is the pre-tax subtotal.
 */
export function calcPOTotals(lines: POLineAmount[]): BillTotals {
  return calcBillTotals(
    lines.map((l) => calcBillLine(l.ratePaise, l.quantityScaled, l.gstRatePct)),
  );
}

/** Quantity → the ×10_000 scaled BigInt the calculations expect. */
export function scaleQty(quantity: number): bigint {
  return BigInt(Math.round(quantity * 10_000));
}

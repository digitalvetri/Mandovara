// GST computation — pure functions, exhaustively tested.
// docs/BUILD-SPEC.md §10.1:
//   - Same state → CGST + SGST at half rate each. Different state → IGST at full rate.
//   - Computed PER LINE, not per document.
//   - Round half-up to the nearest paisa per line.
//   - Round-off to the nearest rupee applied ONCE at the document total.

import { add, percentage, roundToRupee, type Paise } from "@/kernel/money/paise";

export interface LineTaxInput {
  /** Taxable amount, post-discount, in paise. */
  readonly taxable: Paise;
  /** GST rate as a percentage — 5, 12, 18, 28. */
  readonly gstRate: number;
  /** Supplier's registered state (2-digit numeric code). */
  readonly supplierStateCode: string;
  /** Place-of-supply state code — drives intra vs inter-state. */
  readonly placeOfSupplyCode: string;
}

export interface LineTaxOutput {
  readonly cgst: Paise;
  readonly sgst: Paise;
  readonly igst: Paise;
}

/**
 * Compute CGST/SGST/IGST for one line.
 *   - Exempt (rate = 0)          → all zeroes
 *   - Same state (intra-state)   → CGST + SGST, each at half. Split so they sum to total.
 *   - Different state            → full IGST, no CGST/SGST
 * Rounding: half-up to nearest paisa, per line.
 */
export function computeLineTax(input: LineTaxInput): LineTaxOutput {
  if (input.gstRate === 0) {
    return { cgst: 0n, sgst: 0n, igst: 0n };
  }
  const total = percentage(input.taxable, input.gstRate);
  const sameState = input.supplierStateCode === input.placeOfSupplyCode;
  if (sameState) {
    const cgst = percentage(input.taxable, input.gstRate / 2);
    const sgst = total - cgst;   // ensures cgst + sgst === total, no drift
    return { cgst, sgst, igst: 0n };
  }
  return { cgst: 0n, sgst: 0n, igst: total };
}

export interface DocumentLine {
  readonly taxable: Paise;
  readonly gstRate: number;
}

export interface DocumentTotals {
  readonly taxableAmount: Paise;
  readonly cgst: Paise;
  readonly sgst: Paise;
  readonly igst: Paise;
  /** rounded − unrounded. Bounded to ±₹0.50. */
  readonly roundOff: Paise;
  /** Grand total AFTER round-off to the nearest whole rupee. */
  readonly total: Paise;
}

/**
 * Roll up an array of line tax computations. Freight, packing, installation
 * are just extra lines with their own gstRate. Round-off applied ONCE at the
 * document total per BUILD-SPEC §10.1.
 */
export function computeDocumentTotals(
  lines: readonly DocumentLine[],
  ctx: { supplierStateCode: string; placeOfSupplyCode: string },
): DocumentTotals {
  let taxableAmount: Paise = 0n;
  let cgst: Paise = 0n;
  let sgst: Paise = 0n;
  let igst: Paise = 0n;
  for (const l of lines) {
    taxableAmount = add(taxableAmount, l.taxable);
    const t = computeLineTax({
      taxable: l.taxable,
      gstRate: l.gstRate,
      supplierStateCode: ctx.supplierStateCode,
      placeOfSupplyCode: ctx.placeOfSupplyCode,
    });
    cgst = add(cgst, t.cgst);
    sgst = add(sgst, t.sgst);
    igst = add(igst, t.igst);
  }
  const unrounded = add(taxableAmount, cgst, sgst, igst);
  const { rounded, adjustment } = roundToRupee(unrounded);
  return {
    taxableAmount,
    cgst, sgst, igst,
    roundOff: adjustment,
    total: rounded,
  };
}

/**
 * Apply a percentage discount to a pre-tax amount. Convenience wrapper
 * around percentage() that returns { discount, taxable } — useful when
 * building QuotationLine / InvoiceLine rows.
 */
export function applyLineDiscount(
  grossAmount: Paise,
  discountPct: number,
): { discount: Paise; taxable: Paise } {
  const discount = percentage(grossAmount, discountPct);
  return { discount, taxable: grossAmount - discount };
}

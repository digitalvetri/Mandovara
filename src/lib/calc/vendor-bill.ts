// Pure BigInt GST calculation for vendor bills.
// Uses integer arithmetic throughout — no floating point money (CLAUDE.md rule 8).
// quantity must be passed pre-scaled (× 10_000) to handle 3-decimal precision.

export interface BillLineCalc {
  taxable:   bigint;
  cgst:      bigint;  // SGST absorbs any odd-paise remainder so cgst + sgst = gst total
  sgst:      bigint;
  lineTotal: bigint;
}

export interface BillTotals {
  taxableAmount: bigint;
  cgst:          bigint;
  sgst:          bigint;
  igst:          bigint;  // always 0 for intrastate; reserved for interstate
  roundOff:      bigint;  // positive = rounds up, negative = rounds down
  total:         bigint;
}

/**
 * Compute one vendor bill line's GST split.
 *
 * @param ratePaise       – ex-GST rate in paise (BigInt)
 * @param quantityScaled  – quantity × 10_000 (BigInt), no floats
 * @param gstRatePct      – GST rate as integer % (0 | 5 | 12 | 18 | 28)
 */
export function calcBillLine(
  ratePaise:      bigint,
  quantityScaled: bigint,
  gstRatePct:     number,
): BillLineCalc {
  const taxable  = (ratePaise * quantityScaled) / 10_000n;
  const gstTotal = (taxable * BigInt(gstRatePct)) / 100n;
  const cgst     = gstTotal / 2n;
  const sgst     = gstTotal - cgst;
  return { taxable, cgst, sgst, lineTotal: taxable + gstTotal };
}

/** Aggregate per-line calcs and round the grand total to the nearest rupee. */
export function calcBillTotals(lines: BillLineCalc[]): BillTotals {
  let taxableAmount = 0n;
  let cgst          = 0n;
  let sgst          = 0n;
  for (const l of lines) {
    taxableAmount += l.taxable;
    cgst          += l.cgst;
    sgst          += l.sgst;
  }
  const rawTotal = taxableAmount + cgst + sgst;
  const paise    = rawTotal % 100n;
  const roundOff = paise === 0n ? 0n : paise >= 50n ? 100n - paise : -paise;
  const total    = rawTotal + roundOff;
  return { taxableAmount, cgst, sgst, igst: 0n, roundOff, total };
}

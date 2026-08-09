// GST unit tests for Phase 3 gate (CLAUDE.md §12.1).
// Covers: intra-state, inter-state, exempt, mixed-rate document,
//         discount-before-tax, round-off at document total (not per line).

import { describe, expect, it } from "vitest";
import { computeLineTax, applyLineDiscount, computeDocumentTotals } from "@/kernel/tax/gst";

const TN = "33"; // Tamil Nadu — Mandovara's home state
const KA = "29"; // Karnataka — inter-state reference

// ── computeLineTax ────────────────────────────────────────────────────────────

describe("computeLineTax — intra-state (TN→TN)", () => {
  it("18%: equal CGST+SGST at 9% each, no IGST", () => {
    const t = computeLineTax({ taxable: 10_000n, gstRate: 18, supplierStateCode: TN, placeOfSupplyCode: TN });
    expect(t.igst).toBe(0n);
    expect(t.cgst).toBe(900n);
    expect(t.sgst).toBe(900n);
    expect(t.cgst + t.sgst).toBe(1_800n);
  });

  it("12%: CGST 6% + SGST 6%", () => {
    const t = computeLineTax({ taxable: 10_000n, gstRate: 12, supplierStateCode: TN, placeOfSupplyCode: TN });
    expect(t.cgst).toBe(600n);
    expect(t.sgst).toBe(600n);
    expect(t.igst).toBe(0n);
  });

  it("5%: CGST 2.5% + SGST 2.5%, sum = full 5% (no drift)", () => {
    // 5% of 10_001 paise = 500.05 → rounds to 500
    const t = computeLineTax({ taxable: 10_001n, gstRate: 5, supplierStateCode: TN, placeOfSupplyCode: TN });
    expect(t.igst).toBe(0n);
    // cgst + sgst must equal the full 5% tax (sgst = total − cgst guards against drift)
    const expectedTotal = 500n; // 5% of 10_001 with half-up = 500
    expect(t.cgst + t.sgst).toBe(expectedTotal);
  });

  it("exempt (rate 0): all zeroes regardless of state", () => {
    const t = computeLineTax({ taxable: 50_000n, gstRate: 0, supplierStateCode: TN, placeOfSupplyCode: TN });
    expect(t.cgst).toBe(0n);
    expect(t.sgst).toBe(0n);
    expect(t.igst).toBe(0n);
  });

  it("cgst + sgst never drifts from total (property test)", () => {
    for (const taxable of [1n, 33_333n, 99_999n, 100_001n, 1_000_007n]) {
      const t = computeLineTax({ taxable, gstRate: 18, supplierStateCode: TN, placeOfSupplyCode: TN });
      expect(t.igst).toBe(0n);
      // sgst is set to total−cgst so the sum is always exact
      const combinedTax = t.cgst + t.sgst;
      // verify combined tax is reasonable: 18% of taxable ± 1 paisa
      const approx18 = Number(taxable) * 0.18;
      expect(Math.abs(Number(combinedTax) - approx18)).toBeLessThanOrEqual(1);
    }
  });
});

describe("computeLineTax — inter-state (TN→KA)", () => {
  it("18%: IGST only, no CGST/SGST", () => {
    const t = computeLineTax({ taxable: 10_000n, gstRate: 18, supplierStateCode: TN, placeOfSupplyCode: KA });
    expect(t.cgst).toBe(0n);
    expect(t.sgst).toBe(0n);
    expect(t.igst).toBe(1_800n);
  });

  it("12% inter-state: IGST only", () => {
    const t = computeLineTax({ taxable: 10_000n, gstRate: 12, supplierStateCode: TN, placeOfSupplyCode: KA });
    expect(t.cgst).toBe(0n);
    expect(t.sgst).toBe(0n);
    expect(t.igst).toBe(1_200n);
  });

  it("exempt (rate 0) inter-state: all zeroes", () => {
    const t = computeLineTax({ taxable: 10_000n, gstRate: 0, supplierStateCode: TN, placeOfSupplyCode: KA });
    expect(t.cgst).toBe(0n);
    expect(t.sgst).toBe(0n);
    expect(t.igst).toBe(0n);
  });
});

// ── applyLineDiscount ─────────────────────────────────────────────────────────

describe("applyLineDiscount", () => {
  it("0% discount: taxable equals gross", () => {
    const { discount, taxable } = applyLineDiscount(10_000n, 0);
    expect(discount).toBe(0n);
    expect(taxable).toBe(10_000n);
  });

  it("10% discount: ₹100 off ₹1,000", () => {
    const { discount, taxable } = applyLineDiscount(100_000n, 10);
    expect(discount).toBe(10_000n);
    expect(taxable).toBe(90_000n);
  });

  it("100% discount: taxable is zero", () => {
    const { discount, taxable } = applyLineDiscount(50_000n, 100);
    expect(discount).toBe(50_000n);
    expect(taxable).toBe(0n);
  });

  it("discount applied BEFORE tax (§4): ₹10,000 at 20% off → taxable base ₹8,000", () => {
    const { taxable } = applyLineDiscount(1_000_000n, 20);
    expect(taxable).toBe(800_000n);
  });

  it("discount + taxable always sums to gross", () => {
    for (const [gross, pct] of [[500_000n, 7.5], [1_234_567n, 13], [99_999n, 33]] as const) {
      const { discount, taxable } = applyLineDiscount(gross, pct);
      expect(discount + taxable).toBe(gross);
    }
  });
});

// ── computeDocumentTotals ─────────────────────────────────────────────────────

describe("computeDocumentTotals", () => {
  it("single intra-state line at 18%: totals match, round-off zero", () => {
    const result = computeDocumentTotals(
      [{ taxable: 100_000n, gstRate: 18 }],
      { supplierStateCode: TN, placeOfSupplyCode: TN },
    );
    expect(result.taxableAmount).toBe(100_000n);
    expect(result.cgst).toBe(9_000n);
    expect(result.sgst).toBe(9_000n);
    expect(result.igst).toBe(0n);
    expect(result.roundOff).toBe(0n); // 118 000 paise = ₹1,180 exactly
    expect(result.total).toBe(118_000n);
  });

  it("single inter-state line at 18%: IGST only", () => {
    const result = computeDocumentTotals(
      [{ taxable: 100_000n, gstRate: 18 }],
      { supplierStateCode: TN, placeOfSupplyCode: KA },
    );
    expect(result.cgst).toBe(0n);
    expect(result.sgst).toBe(0n);
    expect(result.igst).toBe(18_000n);
    expect(result.total).toBe(118_000n);
  });

  it("mixed-rate document (12% wallpaper + 18% service): per-rate taxes, one round-off", () => {
    const result = computeDocumentTotals(
      [
        { taxable: 100_000n, gstRate: 12 }, // e.g. wallpaper HSN 4814
        { taxable:  50_000n, gstRate: 18 }, // e.g. installation service
      ],
      { supplierStateCode: TN, placeOfSupplyCode: TN },
    );
    expect(result.taxableAmount).toBe(150_000n);
    // 12% of 100 000 = 12 000 → CGST 6 000, SGST 6 000
    // 18% of 50 000  = 9 000  → CGST 4 500, SGST 4 500
    expect(result.cgst).toBe(6_000n + 4_500n); // 10 500
    expect(result.sgst).toBe(6_000n + 4_500n); // 10 500
    expect(result.igst).toBe(0n);
    // Unrounded grand total = 150 000 + 10 500 + 10 500 = 171 000 → exact rupees
    expect(result.roundOff).toBe(0n);
    expect(result.total).toBe(171_000n);
  });

  it("round-off applied ONCE at document total (§4), never per line", () => {
    // Two lines whose combined taxes don't land on a whole rupee
    const result = computeDocumentTotals(
      [
        { taxable: 33_333n, gstRate: 18 },
        { taxable: 33_334n, gstRate: 18 },
      ],
      { supplierStateCode: TN, placeOfSupplyCode: TN },
    );
    // round-off bounded to ±₹0.50 (±50 paise)
    expect(Math.abs(Number(result.roundOff))).toBeLessThanOrEqual(50);
    // total is always a whole rupee (multiple of 100 paise)
    expect(result.total % 100n).toBe(0n);
    // total = unrounded + roundOff
    const unrounded = result.taxableAmount + result.cgst + result.sgst + result.igst;
    expect(result.total).toBe(unrounded + result.roundOff);
  });

  it("all-exempt lines: total equals taxableAmount, no round-off", () => {
    const result = computeDocumentTotals(
      [{ taxable: 50_000n, gstRate: 0 }],
      { supplierStateCode: TN, placeOfSupplyCode: TN },
    );
    expect(result.cgst).toBe(0n);
    expect(result.sgst).toBe(0n);
    expect(result.igst).toBe(0n);
    expect(result.roundOff).toBe(0n);
    expect(result.total).toBe(50_000n);
  });
});

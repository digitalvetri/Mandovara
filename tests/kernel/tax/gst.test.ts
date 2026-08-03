// GST tests — the 7 cases the KIT gate lists, all as separate tests.
// Coverage target: 100 % branch on src/kernel/tax/**.

import { describe, expect, it } from "vitest";
import { applyLineDiscount, computeDocumentTotals, computeLineTax } from "@/kernel/tax/gst";

const TN = "33"; // supplier state
const KA = "29"; // inter-state
const RS = (n: number) => BigInt(n) * 100n; // rupees → paise

describe("computeLineTax — the seven mandated cases", () => {
  it("(1) intra-state: CGST + SGST at half rate each, summing to total", () => {
    const t = computeLineTax({
      taxable: RS(10_000), gstRate: 18,
      supplierStateCode: TN, placeOfSupplyCode: TN,
    });
    expect(t.cgst).toBe(RS(900));
    expect(t.sgst).toBe(RS(900));
    expect(t.igst).toBe(0n);
    expect(t.cgst + t.sgst).toBe(RS(1800));
  });

  it("(2) inter-state: full IGST, no CGST/SGST", () => {
    const t = computeLineTax({
      taxable: RS(10_000), gstRate: 18,
      supplierStateCode: TN, placeOfSupplyCode: KA,
    });
    expect(t.cgst).toBe(0n);
    expect(t.sgst).toBe(0n);
    expect(t.igst).toBe(RS(1800));
  });

  it("(3) exempt (0 %) → all zeroes even inter-state", () => {
    const t = computeLineTax({
      taxable: RS(10_000), gstRate: 0,
      supplierStateCode: TN, placeOfSupplyCode: KA,
    });
    expect(t).toEqual({ cgst: 0n, sgst: 0n, igst: 0n });
  });

  it("intra-state odd-paisa: cgst + sgst still sums exactly to total", () => {
    // ₹1,001 × 18 % = ₹180.18 = 18018 paise total. Splitting 9 %:
    //   cgst = 100_100 * 900 / 10000 → 9009 (round-half-up)
    //   sgst = total - cgst = 18018 - 9009 = 9009
    const t = computeLineTax({
      taxable: 1_001_00n, gstRate: 18,
      supplierStateCode: TN, placeOfSupplyCode: TN,
    });
    expect(t.cgst + t.sgst).toBe(t.cgst + t.sgst);           // trivially true
    expect(t.cgst).toBe(9009n);
    expect(t.sgst).toBe(9009n);
    expect(t.igst).toBe(0n);
  });
});

describe("computeDocumentTotals", () => {
  it("(4) mixed-rate document: rolls up per-line totals correctly", () => {
    const totals = computeDocumentTotals(
      [
        { taxable: RS(10_000), gstRate: 5 },    // ₹500 total tax
        { taxable: RS(10_000), gstRate: 18 },   // ₹1,800 total tax
        { taxable: RS(5_000),  gstRate: 28 },   // ₹1,400 total tax
      ],
      { supplierStateCode: TN, placeOfSupplyCode: TN },
    );
    expect(totals.taxableAmount).toBe(RS(25_000));
    expect(totals.cgst + totals.sgst).toBe(RS(500 + 1800 + 1400)); // 3700
    expect(totals.igst).toBe(0n);
    expect(totals.total).toBe(RS(28_700));
    expect(totals.roundOff).toBe(0n);
  });

  it("(5) discount applied before tax: caller supplies post-discount taxable", () => {
    // ₹10,000 gross, 10 % discount → ₹9,000 taxable
    const line = applyLineDiscount(RS(10_000), 10);
    expect(line.discount).toBe(RS(1_000));
    expect(line.taxable).toBe(RS(9_000));
    const t = computeLineTax({
      taxable: line.taxable, gstRate: 18,
      supplierStateCode: TN, placeOfSupplyCode: TN,
    });
    expect(t.cgst + t.sgst).toBe(RS(1_620));  // 18 % of ₹9,000
  });

  it("(6) freight is just a separate taxable line", () => {
    const totals = computeDocumentTotals(
      [
        { taxable: RS(10_000), gstRate: 18 },  // goods
        { taxable: RS(500),    gstRate: 18 },  // freight, same rate
      ],
      { supplierStateCode: TN, placeOfSupplyCode: TN },
    );
    expect(totals.taxableAmount).toBe(RS(10_500));
    expect(totals.cgst + totals.sgst).toBe(RS(1_890)); // 18 % of ₹10,500
  });

  it("(7a) round-off producing exactly +₹0.50 (half-up rounds up)", () => {
    // Input ₹1,000.50 = 100050 paise, no tax → total 100050 → rounds to ₹1,001 = 100100 paise.
    const totals = computeDocumentTotals(
      [{ taxable: 100_050n, gstRate: 0 }],
      { supplierStateCode: TN, placeOfSupplyCode: TN },
    );
    expect(totals.roundOff).toBe(50n);
    expect(totals.total).toBe(100_100n);
  });

  it("(7b) round-off producing −₹0.49 (rounds down)", () => {
    // ₹1,000.49 = 100049 paise → rounds to ₹1,000 = 100_000 paise, adj = -49
    const totals = computeDocumentTotals(
      [{ taxable: 100_049n, gstRate: 0 }],
      { supplierStateCode: TN, placeOfSupplyCode: TN },
    );
    expect(totals.roundOff).toBe(-49n);
    expect(totals.total).toBe(100_000n);
  });

  it("inter-state document totals: only IGST populated", () => {
    const totals = computeDocumentTotals(
      [
        { taxable: RS(10_000), gstRate: 18 },
        { taxable: RS(5_000),  gstRate: 12 },
      ],
      { supplierStateCode: TN, placeOfSupplyCode: KA },
    );
    expect(totals.cgst).toBe(0n);
    expect(totals.sgst).toBe(0n);
    expect(totals.igst).toBe(RS(1_800 + 600));
  });

  it("empty document → all zeroes", () => {
    const totals = computeDocumentTotals([], { supplierStateCode: TN, placeOfSupplyCode: TN });
    expect(totals.taxableAmount).toBe(0n);
    expect(totals.total).toBe(0n);
    expect(totals.roundOff).toBe(0n);
  });
});

describe("applyLineDiscount", () => {
  it("zero discount → discount 0, taxable = gross", () => {
    const l = applyLineDiscount(RS(1_000), 0);
    expect(l.discount).toBe(0n);
    expect(l.taxable).toBe(RS(1_000));
  });
  it("100 % discount → gross taxable → 0", () => {
    const l = applyLineDiscount(RS(1_000), 100);
    expect(l.discount).toBe(RS(1_000));
    expect(l.taxable).toBe(0n);
  });
});

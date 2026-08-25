import { describe, expect, it } from "vitest";
import { calcBillLine, calcBillTotals } from "./vendor-bill";

describe("calcBillLine", () => {
  it("computes taxable, CGST, SGST for 18%", () => {
    // ₹1000 × 1 metre × 18%
    const r = calcBillLine(100_000n, 10_000n, 18);
    expect(r.taxable).toBe(100_000n);
    expect(r.cgst).toBe(9_000n);
    expect(r.sgst).toBe(9_000n);
    expect(r.cgst + r.sgst).toBe(18_000n);
    expect(r.lineTotal).toBe(118_000n);
  });

  it("handles 0% GST", () => {
    const r = calcBillLine(50_000n, 20_000n, 0);
    expect(r.taxable).toBe(100_000n);
    expect(r.cgst).toBe(0n);
    expect(r.sgst).toBe(0n);
    expect(r.lineTotal).toBe(100_000n);
  });

  it("handles fractional quantity without floating point", () => {
    // ₹500 × 2.5 m = ₹1250 taxable
    const r = calcBillLine(50_000n, 25_000n, 12);
    expect(r.taxable).toBe(125_000n);
    expect(r.cgst + r.sgst).toBe(15_000n); // 12% of 1250 = 150
  });

  it("5% GST — CGST+SGST always equals computed gst total", () => {
    // ₹1000.50 × 1 m × 5%: taxable = 100_050, gst = 5002 (5002/2 = 2501, odd case)
    const r = calcBillLine(100_050n, 10_000n, 5);
    expect(r.taxable).toBe(100_050n);
    const gstTotal = (100_050n * 5n) / 100n;
    expect(r.cgst + r.sgst).toBe(gstTotal);
  });
});

describe("calcBillTotals", () => {
  it("sums lines and round-offs to nearest rupee", () => {
    // ₹1000 + 5% = ₹1050 — already whole rupee
    const line = calcBillLine(100_000n, 10_000n, 5);
    const t    = calcBillTotals([line]);
    expect(t.taxableAmount).toBe(100_000n);
    expect(t.cgst + t.sgst).toBe(5_000n);
    expect(t.roundOff).toBe(0n);
    expect(t.total).toBe(105_000n);
  });

  it("round-off is positive when paise >= 50 (rounds up)", () => {
    // ₹333 × 1 m × 5%: taxable=33300, gst=1665, raw=34965 → paise=65 → roundOff=+35
    const r = calcBillLine(33_300n, 10_000n, 5);
    const t = calcBillTotals([r]);
    expect(t.roundOff).toBe(35n);   // +35 paise to reach ₹350.00
    expect(t.total).toBe(35_000n);
  });

  it("round-off is negative when paise < 50 (rounds down)", () => {
    // ₹100.33 × 1 m × 5%: taxable=10033, gst=501 (10033*5/100=501), raw=10534 → paise=34 → roundOff=-34
    const r = calcBillLine(10_033n, 10_000n, 5);
    const t = calcBillTotals([r]);
    expect(t.roundOff).toBe(-34n);  // -34 paise to reach ₹105.00
    expect(t.total).toBe(10_500n);
  });

  it("igst is always 0 for intrastate", () => {
    const line = calcBillLine(100_000n, 10_000n, 18);
    const t    = calcBillTotals([line]);
    expect(t.igst).toBe(0n);
  });
});

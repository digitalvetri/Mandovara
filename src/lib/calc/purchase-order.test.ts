import { describe, it, expect } from "vitest";
import { calcPOTotals, scaleQty } from "./purchase-order";

describe("calcPOTotals", () => {
  it("includes GST in the ordered total", () => {
    // 3 metres @ ₹2,100 with 18% GST → ₹6,300 taxable + ₹1,134 GST = ₹7,434
    const t = calcPOTotals([
      { ratePaise: 210_000n, quantityScaled: scaleQty(3), gstRatePct: 18 },
    ]);
    expect(t.taxableAmount).toBe(630_000n);
    expect(t.cgst + t.sgst).toBe(113_400n);
    expect(t.total).toBe(743_400n);
  });

  it("leaves a zero-rated line untaxed", () => {
    const t = calcPOTotals([
      { ratePaise: 50_000n, quantityScaled: scaleQty(2), gstRatePct: 0 },
    ]);
    expect(t.taxableAmount).toBe(100_000n);
    expect(t.total).toBe(100_000n);
  });

  it("adds up a mixed-rate order", () => {
    const t = calcPOTotals([
      { ratePaise: 210_000n, quantityScaled: scaleQty(3),  gstRatePct: 18 },
      { ratePaise: 100_000n, quantityScaled: scaleQty(2),  gstRatePct: 12 },
      { ratePaise:  40_000n, quantityScaled: scaleQty(10), gstRatePct: 0  },
    ]);
    expect(t.taxableAmount).toBe(630_000n + 200_000n + 400_000n);
    expect(t.cgst + t.sgst).toBe(113_400n + 24_000n);
    expect(t.total).toBe(1_367_400n);
  });

  it("handles fractional quantities without floating-point drift", () => {
    // 2.375 metres @ ₹1,000.50 with 5% GST
    const t = calcPOTotals([
      { ratePaise: 100_050n, quantityScaled: scaleQty(2.375), gstRatePct: 5 },
    ]);
    expect(t.taxableAmount).toBe(237_618n);
    expect(t.cgst + t.sgst).toBe(11_880n);
    // 249,498 paise rounds to the nearest rupee
    expect(t.roundOff).toBe(2n);
    expect(t.total).toBe(249_500n);
  });

  it("is zero for an order with no lines", () => {
    expect(calcPOTotals([]).total).toBe(0n);
  });
});

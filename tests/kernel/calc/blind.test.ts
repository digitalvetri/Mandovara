// Blind calculator tests — §7.3 + 100% branch coverage.
import { describe, it, expect } from "vitest";
import { calcBlind } from "@/kernel/calc/blind";

describe("calcBlind — §7.3", () => {
  it("INSIDE mount — clears 6mm each side", () => {
    // 1000×1200 INSIDE → adjW=988, adjH=1200
    // rounded to 25mm grid: W=1000, H=1200
    // area = 1000*1200/92903.04 = 12.917 sqft
    const r = calcBlind({
      widthMm: 1000, heightMm: 1200, quantity: 1,
      mountType: "INSIDE", minChargeSqft: 10,
      insideClearanceMm: 6,
    });
    expect(r.adjustedWidthMm).toBe(1000); // ceil(988/25)*25 = 1000
    expect(r.adjustedHeightMm).toBe(1200);
    expect(r.billableAreaSqft).toBeGreaterThan(10); // actual > min charge
    expect(r.warnings).toHaveLength(0);
  });

  it("OUTSIDE mount — adds overlap on sides and top", () => {
    // 1000×1200 OUTSIDE → adjW=1000+75*2=1150, adjH=1200+100=1300
    // round: W=1150, H=1300
    const r = calcBlind({
      widthMm: 1000, heightMm: 1200, quantity: 1,
      mountType: "OUTSIDE", minChargeSqft: 10,
      outsideOverlapSideMm: 75,
      outsideOverlapTopMm: 100,
    });
    expect(r.adjustedWidthMm).toBe(1150); // ceil(1150/25)*25=1150
    expect(r.adjustedHeightMm).toBe(1300);
    expect(r.warnings).toHaveLength(0);
  });

  it("CEILING mount — deducts clearance from height", () => {
    // 800×1500 CEILING → adjW=800, adjH=1500-12=1488 → round: 1500
    const r = calcBlind({
      widthMm: 800, heightMm: 1500, quantity: 1,
      mountType: "CEILING", minChargeSqft: 10,
      ceilingClearanceMm: 12,
    });
    expect(r.adjustedWidthMm).toBe(800);
    expect(r.adjustedHeightMm).toBe(1500); // ceil(1488/25)*25=1500
  });

  it("min charge applied when actual area < minChargeSqft → warning", () => {
    // 300×300 INSIDE → adjW=288, round=300; adjH=300
    // area = 300*300/92903.04 ≈ 0.97 sqft < 10 sqft
    const r = calcBlind({
      widthMm: 300, heightMm: 300, quantity: 1,
      mountType: "INSIDE", minChargeSqft: 10,
    });
    expect(r.billableAreaSqft).toBeCloseTo(10, 0); // min charge applied
    expect(r.warnings.some((w) => w.includes("Minimum charge"))).toBe(true);
  });

  it("quantity multiplies billable area", () => {
    const r = calcBlind({
      widthMm: 1000, heightMm: 1200, quantity: 3,
      mountType: "INSIDE", minChargeSqft: 10,
    });
    const single = calcBlind({
      widthMm: 1000, heightMm: 1200, quantity: 1,
      mountType: "INSIDE", minChargeSqft: 10,
    });
    expect(r.billableAreaSqft).toBeCloseTo(single.billableAreaSqft * 3, 2);
  });

  it("custom roundToMm grid respected", () => {
    // 1010×1210 with roundToMm=50 → adjW=1050, adjH=1250
    const r = calcBlind({
      widthMm: 1010, heightMm: 1210, quantity: 1,
      mountType: "INSIDE", minChargeSqft: 10,
      roundToMm: 50, insideClearanceMm: 6,
    });
    // adjW = 1010-12=998, ceil(998/50)*50=1000; adjH=1210, ceil(1210/50)*50=1250
    expect(r.adjustedWidthMm).toBe(1000);
    expect(r.adjustedHeightMm).toBe(1250);
  });

  it("area calculation is correct", () => {
    const r = calcBlind({
      widthMm: 1000, heightMm: 1000, quantity: 1,
      mountType: "INSIDE", minChargeSqft: 5,
      insideClearanceMm: 0,
    });
    // adjW=1000, adjH=1000, area=1000000/92903.04≈10.764 sqft
    expect(r.areaSqft).toBeCloseTo(10.764, 1);
    expect(r.billableAreaSqft).toBeCloseTo(10.764, 1);
  });
});

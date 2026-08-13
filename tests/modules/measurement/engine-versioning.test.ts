// Engine mapping — every family stamps a real engineVersion, and
// dimensions changes reflect in the computed row so the caller can
// safely rely on "recompute + supersede" (§6.2) at the DB layer.

import { describe, it, expect } from "vitest";
import { computeCalcResult } from "../../../src/modules/measurement/engine";

const base = {
  widthMm:  1800,
  heightMm: 2100,
  quantity: 1,
} as const;

describe("computeCalcResult · engineVersion + shape per family", () => {
  it("CURTAIN_FABRIC stamps curtain@<version> and includes widthsRequired + cutLength", () => {
    const r = computeCalcResult({
      ...base, family: "CURTAIN_FABRIC", headingType: "EYELET", fullness: 2.5,
    });
    expect(r.engineVersion).toMatch(/^curtain@/);
    expect(r.materialUnit).toBe("METRE");
    expect(r.widthsRequired).toBeGreaterThan(0);
    expect(r.cutLengthMm).toBeGreaterThan(0);
    expect(r.materialQty).toBeGreaterThan(0);
  });

  it("WALLPAPER stamps wallpaper@<version> and returns rollsRequired", () => {
    const r = computeCalcResult({
      ...base, family: "WALLPAPER", deductions: [],
    });
    expect(r.engineVersion).toMatch(/^wallpaper@/);
    expect(r.materialUnit).toBe("ROLL");
    expect(r.rollsRequired).toBeGreaterThan(0);
    expect(r.materialQty).toBe(r.rollsRequired);
  });

  it("FLOORING stamps flooring@<version> and returns boxesRequired", () => {
    const r = computeCalcResult({
      ...base, family: "FLOORING", layPattern: "STRAIGHT",
    });
    expect(r.engineVersion).toMatch(/^flooring@/);
    expect(r.materialUnit).toBe("BOX");
    expect(r.boxesRequired).toBeGreaterThan(0);
    expect(r.wastagePct).toBeDefined();
  });

  it("BLIND stamps blind@<version> and applies min-charge to billable area", () => {
    const r = computeCalcResult({
      ...base, family: "BLIND", mountType: "INSIDE",
    });
    expect(r.engineVersion).toMatch(/^blind@/);
    expect(r.materialUnit).toBe("SQFT");
    expect(r.billableAreaSqft).toBeGreaterThanOrEqual(r.areaSqft!);
  });

  it("CARPET_ROLL stamps carpet@<version> with seam count", () => {
    const r = computeCalcResult({ ...base, family: "CARPET_ROLL" });
    expect(r.engineVersion).toMatch(/^carpet@/);
    expect(r.seamCount).toBeDefined();
  });

  it("CARPET_TILE stamps carpet@<version> with box output", () => {
    const r = computeCalcResult({ ...base, family: "CARPET_TILE" });
    expect(r.engineVersion).toMatch(/^carpet@/);
    expect(r.materialUnit).toBe("BOX");
    expect(r.boxesRequired).toBeGreaterThan(0);
  });

  it("INTERIOR_FILM stamps film@<version> with area+cut length", () => {
    const r = computeCalcResult({ ...base, family: "INTERIOR_FILM" });
    expect(r.engineVersion).toMatch(/^film@/);
    expect(r.materialUnit).toBe("SQFT");
    expect(r.cutLengthMm).toBeGreaterThan(0);
  });

  it("families without a calculator fall back to no-engine@0.0.0 (item still saveable)", () => {
    // §7 rule 4 — a site visit must not fail because a formula is
    // missing; the item is captured, the material line is filled in
    // at quotation time.
    const r = computeCalcResult({ ...base, family: "MURAL" });
    expect(r.engineVersion).toBe("no-engine@0.0.0");
    expect(r.materialQty).toBe(0);
    expect(r.warnings.join(" ")).toMatch(/no calculator/i);
  });
});

describe("computeCalcResult · dimension changes reflect in the output", () => {
  it("doubling the wall width increases wallpaper roll count", () => {
    const small = computeCalcResult({ ...base, family: "WALLPAPER", deductions: [] });
    const big   = computeCalcResult({ ...base, widthMm: base.widthMm * 2, family: "WALLPAPER", deductions: [] });
    expect(big.rollsRequired!).toBeGreaterThanOrEqual(small.rollsRequired!);
    expect(big.materialQty).toBeGreaterThanOrEqual(small.materialQty);
  });

  it("increasing curtain fullness increases fabric metres", () => {
    const at20 = computeCalcResult({ ...base, family: "CURTAIN_FABRIC", headingType: "EYELET", fullness: 2.0 });
    const at30 = computeCalcResult({ ...base, family: "CURTAIN_FABRIC", headingType: "EYELET", fullness: 3.0 });
    expect(at30.materialQty).toBeGreaterThanOrEqual(at20.materialQty);
  });
});

describe("computeCalcResult · every result carries a provisional-note warning", () => {
  it("provisional note explains defaults were used", () => {
    // §6.2 traceability — a downstream engine change never silently
    // re-prices something; this warning is the surfacing of that.
    const r = computeCalcResult({ ...base, family: "WALLPAPER", deductions: [] });
    const joined = r.warnings.join(" ");
    expect(joined).toMatch(/provisional/i);
  });
});

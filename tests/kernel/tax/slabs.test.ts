import { describe, expect, it } from "vitest";
import { DEFAULT_GST_RATE, getGstRate, GST_SLABS } from "@/kernel/tax/slabs";

describe("getGstRate", () => {
  it("cement HSN 2523 → 28 %", () => {
    expect(getGstRate("2523")).toBe(28);
    expect(getGstRate("252399")).toBe(28);
  });
  it("TMT HSN 7214 → 18 %", () => {
    expect(getGstRate("7214")).toBe(18);
  });
  it("safety helmet HSN 6506 → 12 %", () => {
    expect(getGstRate("6506")).toBe(12);
  });
  it("books HSN 4901 → 0 %", () => {
    expect(getGstRate("4901")).toBe(0);
  });
  it("unknown HSN → DEFAULT_GST_RATE (18 %)", () => {
    expect(getGstRate("9999")).toBe(DEFAULT_GST_RATE);
  });
  it("effective-dated: date before regime → falls to default", () => {
    expect(getGstRate("2523", new Date("2016-01-01"))).toBe(DEFAULT_GST_RATE);
  });
  it("effective-dated: date after regime → correct rate", () => {
    expect(getGstRate("2523", new Date("2026-01-01"))).toBe(28);
  });
  it("effective-dated: date at boundary (regime start) is inclusive", () => {
    expect(getGstRate("2523", new Date("2017-07-01"))).toBe(28);
  });
  it("effective-dated: tiles pre-July 2018 → old 28% rate", () => {
    expect(getGstRate("6907", new Date("2018-01-01"))).toBe(28);
  });
  it("effective-dated: tiles post-July 2018 → new 18% rate", () => {
    expect(getGstRate("6907", new Date("2020-01-01"))).toBe(18);
  });
});

describe("GST_SLABS shape", () => {
  it("every slab has a plausible rate", () => {
    for (const s of GST_SLABS) {
      expect([0, 5, 12, 18, 28]).toContain(s.rate);
    }
  });
  it("no duplicate hsnPrefix + effectiveFrom pair", () => {
    const keys = GST_SLABS.map((s) => `${s.hsnPrefix}::${s.effectiveFrom.toISOString()}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

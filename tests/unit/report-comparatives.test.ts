// The percentage the Reports dashboard prints.
//
// Pure and worth pinning: a wrong sign or a divide-by-zero here is a
// number an owner makes decisions on.

import { describe, it, expect } from "vitest";
import { pctChange } from "../../src/modules/reports/comparatives";

describe("pctChange", () => {
  it("reports growth", () => {
    expect(pctChange(150, 100)).toBeCloseTo(50);
  });

  it("reports decline as negative", () => {
    expect(pctChange(80, 100)).toBeCloseTo(-20);
  });

  it("is zero when nothing moved", () => {
    expect(pctChange(100, 100)).toBe(0);
  });

  it("returns null rather than a fiction when the previous period was zero", () => {
    // Growth from nothing is not a percentage. Printing +100% would
    // understate a first month of trading; printing 0% would hide it.
    expect(pctChange(50_000, 0)).toBeNull();
    expect(pctChange(0, 0)).toBeNull();
  });

  it("handles a fall to zero", () => {
    expect(pctChange(0, 100)).toBeCloseTo(-100);
  });

  it("uses the magnitude of the previous period, so a negative base does not flip the sign", () => {
    // A refund-heavy month can leave collections negative. Growth from
    // -100 to -50 is an improvement and must not read as -50%.
    expect(pctChange(-50, -100)).toBeCloseTo(50);
  });
});

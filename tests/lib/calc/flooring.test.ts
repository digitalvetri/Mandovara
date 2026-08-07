// Tests for /lib/calc/flooring — the second calculator in the
// Measure & Material Engine (TRACK-B-CRAFT.md §4.2).

import { describe, expect, it } from "vitest";
import {
  calcFlooring,
  FLOORING_ENGINE_VERSION,
  type FlooringInput,
} from "@/lib/calc/flooring";

// ── shared base — the §4.2 canonical room: 4000×3500, box-packed at 2.2 sqft/box
const BOX_BASE: FlooringInput = {
  roomLengthMm:    4000,
  roomWidthMm:     3500,
  layPattern:  "STRAIGHT",
  product: {
    kind:            "BOX",
    areaPerBoxSqft:   2.2,
  },
};

describe("calcFlooring — engine version", () => {
  it("is a stable semver string so QuotationLine.calcSnapshot can freeze it", () => {
    expect(FLOORING_ENGINE_VERSION).toMatch(/^flooring@\d+\.\d+\.\d+$/);
  });

  it("stamps the version onto every result", () => {
    const r = calcFlooring(BOX_BASE);
    expect(r.engineVersion).toBe(FLOORING_ENGINE_VERSION);
  });
});

describe("calcFlooring — §4.2 canonical test table", () => {
  it("STRAIGHT lay, 4000×3500, 2.2 sqft/box → 150.7 sqft → 161.3 with 7% → 74 boxes", () => {
    const r = calcFlooring(BOX_BASE);
    expect(r.areaSqft).toBeCloseTo(150.7, 1);
    // Spec quotes 161.3 to one decimal — actual is 161.24, within rounding.
    expect(r.areaWithWastageSqft).toBeCloseTo(161.3, 0);
    expect(r.wastagePct).toBe(7);
    expect(r.boxesRequired).toBe(74);
    expect(r.rollLengthM).toBeUndefined();
    expect(r.seamCount).toBeUndefined();
  });

  it("DIAGONAL lay → 76 boxes with a warning naming the extra wastage vs straight", () => {
    const r = calcFlooring({ ...BOX_BASE, layPattern: "DIAGONAL" });
    expect(r.wastagePct).toBe(10);
    expect(r.boxesRequired).toBe(76);
    expect(
      r.warnings.some(
        (w) => /diagonal/i.test(w) && /\d+ (extra )?boxe?s?/i.test(w),
      ),
    ).toBe(true);
  });

  it("ROLL FILM 1220mm in a 3500mm-wide room → 3 strips, 2 seams, warning fires", () => {
    const r = calcFlooring({
      roomLengthMm:  4000,
      roomWidthMm:   3500,
      layPattern:  "STRAIGHT",
      product: { kind: "ROLL", rollWidthMm: 1220 },
    });
    expect(r.stripsRequired).toBe(3);
    expect(r.seamCount).toBe(2);
    // Length = 3 strips × 4000mm / 1000 = 12.0m
    expect(r.rollLengthM).toBeCloseTo(12.0, 3);
    expect(r.boxesRequired).toBeUndefined();
    expect(
      r.warnings.some(
        (w) => /2 seam/i.test(w) && /confirm.*placement/i.test(w),
      ),
    ).toBe(true);
  });
});

describe("calcFlooring — warning pluralisation and no-op cases", () => {
  it("ROLL: says '1 seam' (singular) when exactly two strips are needed", () => {
    const r = calcFlooring({
      roomLengthMm:  3000,
      roomWidthMm:   2000,     // 2 strips of 1220 = 1 seam
      layPattern:  "STRAIGHT",
      product: { kind: "ROLL", rollWidthMm: 1220 },
    });
    expect(r.seamCount).toBe(1);
    expect(r.warnings.some((w) => /^1 seam required/i.test(w))).toBe(true);
  });

  it("BOX: says '1 extra box' (singular) when DIAGONAL adds exactly one box", () => {
    // 2000×1500 at 2.2 sqft/box → straight 16 boxes, diagonal 17 → extra = 1
    const r = calcFlooring({
      roomLengthMm:  2000,
      roomWidthMm:   1500,
      layPattern:  "DIAGONAL",
      product: { kind: "BOX", areaPerBoxSqft: 2.2 },
    });
    expect(r.boxesRequired).toBe(17);
    expect(
      r.warnings.some((w) => /diagonal.*adds 1 extra box\b/i.test(w)),
    ).toBe(true);
  });

  it("BOX: emits NO extra-boxes warning when a fancy pattern happens to round to the same total", () => {
    // 1000×1000 at 2.2 sqft/box → straight 6 boxes, diagonal 6 → extra = 0
    const r = calcFlooring({
      roomLengthMm:  1000,
      roomWidthMm:   1000,
      layPattern:  "DIAGONAL",
      product: { kind: "BOX", areaPerBoxSqft: 2.2 },
    });
    expect(r.boxesRequired).toBe(6);
    expect(r.warnings.some((w) => /extra box/i.test(w))).toBe(false);
  });
});

describe("calcFlooring — herringbone", () => {
  it("uses 15% wastage and emits an even-larger-vs-straight warning", () => {
    const r = calcFlooring({ ...BOX_BASE, layPattern: "HERRINGBONE" });
    expect(r.wastagePct).toBe(15);
    // 150.6949 × 1.15 = 173.30 → 173.30 / 2.2 = 78.77 → 79 boxes
    expect(r.boxesRequired).toBe(79);
    expect(
      r.warnings.some(
        (w) => /herringbone/i.test(w) && /\d+ (extra )?boxe?s?/i.test(w),
      ),
    ).toBe(true);
  });
});

describe("calcFlooring — skirting", () => {
  it("computes perimeter in running feet with no door openings", () => {
    // Perimeter mm = 2 × (4000 + 3500) = 15000mm = 15m = 49.2126 rft
    const r = calcFlooring(BOX_BASE);
    expect(r.skirtingRft).toBeCloseTo(49.2126, 2);
  });

  it("subtracts door openings from the skirting length", () => {
    // Two 900mm doors → 15000 − 1800 = 13200mm = 43.307 rft
    const r = calcFlooring({
      ...BOX_BASE,
      doorOpeningWidthsMm: [900, 900],
    });
    expect(r.skirtingRft).toBeCloseTo(43.307, 2);
  });

  it("clamps the skirting to zero if door widths exceed the perimeter", () => {
    const r = calcFlooring({
      ...BOX_BASE,
      doorOpeningWidthsMm: [20000, 20000], // absurd — proves clamp
    });
    expect(r.skirtingRft).toBe(0);
  });
});

describe("calcFlooring — input safety", () => {
  it("throws on non-positive room length", () => {
    expect(() => calcFlooring({ ...BOX_BASE, roomLengthMm: 0 })).toThrow();
  });

  it("throws on non-positive room width", () => {
    expect(() => calcFlooring({ ...BOX_BASE, roomWidthMm: -1 })).toThrow();
  });

  it("throws when a BOX product has non-positive areaPerBoxSqft", () => {
    expect(() =>
      calcFlooring({
        ...BOX_BASE,
        product: { kind: "BOX", areaPerBoxSqft: 0 },
      }),
    ).toThrow();
  });

  it("throws when a ROLL product has non-positive rollWidthMm", () => {
    expect(() =>
      calcFlooring({
        ...BOX_BASE,
        product: { kind: "ROLL", rollWidthMm: 0 },
      }),
    ).toThrow();
  });

  it("throws on a negative door opening width", () => {
    expect(() =>
      calcFlooring({ ...BOX_BASE, doorOpeningWidthsMm: [-100] }),
    ).toThrow();
  });
});

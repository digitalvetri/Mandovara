// Flooring calculator tests — §7.4 + 100% branch coverage.
import { describe, it, expect } from "vitest";
import { calcFlooring } from "@/kernel/calc/flooring";

describe("calcFlooring — §7.4", () => {
  // Standard laminate: 2.2 sqft/box
  const BOX_AREA = 2.2;

  it("STRAIGHT lay, 7% wastage — compute boxes from room dimensions", () => {
    // 4000×3000mm = 12 sqm = 129.167 sqft, +7% = 138.21, /2.2 = ceil(62.8) = 63 boxes
    const r = calcFlooring({
      roomLengthMm:  4000,
      roomWidthMm:   3000,
      areaPerBoxSqft: BOX_AREA,
      layPattern:    "STRAIGHT",
    });
    expect(r.wastagePct).toBe(7);
    const expectedSqft = (4000 * 3000) / 92_903.04;
    expect(r.areaSqft).toBeCloseTo(expectedSqft, 1);
    expect(r.boxesRequired).toBe(Math.ceil(expectedSqft * 1.07 / BOX_AREA));
  });

  it("DIAGONAL lay → 10% wastage", () => {
    const r = calcFlooring({
      roomLengthMm:  4000,
      roomWidthMm:   3000,
      areaPerBoxSqft: BOX_AREA,
      layPattern:    "DIAGONAL",
    });
    expect(r.wastagePct).toBe(10);
    const expected = Math.ceil((4000 * 3000) / 92_903.04 * 1.10 / BOX_AREA);
    expect(r.boxesRequired).toBe(expected);
  });

  it("HERRINGBONE lay → 15% wastage", () => {
    const r = calcFlooring({
      roomLengthMm:  4000,
      roomWidthMm:   3000,
      areaPerBoxSqft: BOX_AREA,
      layPattern:    "HERRINGBONE",
    });
    expect(r.wastagePct).toBe(15);
  });

  it("area provided directly as sqft (no room dimensions)", () => {
    const r = calcFlooring({
      areaSqft:       100,
      areaPerBoxSqft: BOX_AREA,
      layPattern:     "STRAIGHT",
    });
    expect(r.areaSqft).toBeCloseTo(100, 1);
    expect(r.boxesRequired).toBe(Math.ceil(100 * 1.07 / BOX_AREA));
    expect(r.skirtingRft).toBeNull(); // no room dims → no skirting
  });

  it("skirting computed from room dimensions minus door openings", () => {
    // 4000×3000mm room, 2 door openings × 900mm = 5.91 rft
    const r = calcFlooring({
      roomLengthMm:   4000,
      roomWidthMm:    3000,
      areaPerBoxSqft: BOX_AREA,
      layPattern:     "STRAIGHT",
      doorOpeningsRft: 5.91,
    });
    const perimeterMm = 2 * (4000 + 3000); // 14000mm = 45.93 rft
    const perimeterRft = perimeterMm / 304.8;
    expect(r.skirtingRft).toBeCloseTo(perimeterRft - 5.91, 1);
  });

  it("neither dimensions nor area → warning, boxes = 0", () => {
    const r = calcFlooring({
      areaPerBoxSqft: BOX_AREA,
      layPattern:     "STRAIGHT",
    });
    expect(r.areaSqft).toBe(0);
    expect(r.boxesRequired).toBe(0);
    expect(r.warnings.some((w) => w.includes("Neither"))).toBe(true);
  });

  it("custom wastage percentages are respected", () => {
    const r = calcFlooring({
      areaSqft:               100,
      areaPerBoxSqft:         BOX_AREA,
      layPattern:             "DIAGONAL",
      diagonalWastagePct:     12,
    });
    expect(r.wastagePct).toBe(12);
    expect(r.boxesRequired).toBe(Math.ceil(100 * 1.12 / BOX_AREA));
  });

  // ── Roll goods (sheet vinyl / SPC roll), absorbed from the former
  //    /lib/calc/flooring.ts so one calculator serves both product kinds.
  describe("roll goods", () => {
    it("multiple drops report strips, roll length and seams", () => {
      const r = calcFlooring({
        roomLengthMm:   4000,
        roomWidthMm:    3500,
        layPattern:     "STRAIGHT",
        areaPerBoxSqft: BOX_AREA,
        rollWidthMm:    1220,
      });
      expect(r.materialUnit).toBe("ROLL");
      expect(r.stripsRequired).toBe(3);          // ceil(3500/1220)
      expect(r.rollLengthM).toBe(12);            // 3 × 4000mm
      expect(r.seamCount).toBe(2);
      expect(r.warnings.some((w) => w.includes("2 seams required"))).toBe(true);
    });

    it("a single seam is reported in the singular", () => {
      const r = calcFlooring({
        roomLengthMm:   4000,
        roomWidthMm:    3500,
        layPattern:     "STRAIGHT",
        areaPerBoxSqft: BOX_AREA,
        rollWidthMm:    2000,
      });
      expect(r.seamCount).toBe(1);
      expect(r.warnings.some((w) => w.includes("1 seam required"))).toBe(true);
    });

    it("a room narrower than the roll is a single seamless drop", () => {
      const r = calcFlooring({
        roomLengthMm:   4000,
        roomWidthMm:    3500,
        layPattern:     "STRAIGHT",
        areaPerBoxSqft: BOX_AREA,
        rollWidthMm:    3660,
      });
      expect(r.stripsRequired).toBe(1);
      expect(r.seamCount).toBe(0);
      expect(r.warnings.some((w) => w.includes("seam"))).toBe(false);
    });

    it("rejects a non-positive roll width", () => {
      expect(() => calcFlooring({
        roomLengthMm: 4000, roomWidthMm: 3500,
        layPattern: "STRAIGHT", areaPerBoxSqft: BOX_AREA, rollWidthMm: 0,
      })).toThrow(/rollWidthMm must be > 0/);
    });

    it("warns when roll goods are requested without room dimensions", () => {
      const r = calcFlooring({
        areaSqft:       100,
        layPattern:     "STRAIGHT",
        areaPerBoxSqft: BOX_AREA,
        rollWidthMm:    1220,
      });
      expect(r.stripsRequired).toBeNull();
      expect(r.warnings.some((w) => w.includes("need room dimensions"))).toBe(true);
    });

    it("box-packed product leaves the roll fields null", () => {
      const r = calcFlooring({
        roomLengthMm: 4000, roomWidthMm: 3500,
        layPattern: "STRAIGHT", areaPerBoxSqft: BOX_AREA,
      });
      expect(r.materialUnit).toBe("BOX");
      expect(r.stripsRequired).toBeNull();
      expect(r.rollLengthM).toBeNull();
      expect(r.seamCount).toBeNull();
    });
  });
});

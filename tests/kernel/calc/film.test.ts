// Film & vertical garden calculator tests — §7.6 + 100% branch coverage.
import { describe, it, expect } from "vitest";
import { calcFilm, calcVerticalGarden } from "@/kernel/calc/film";

describe("calcFilm — §7.6", () => {
  it("basic area + 8% wastage", () => {
    // 2000×1500mm, roll 1220mm, FREE match
    // area = 2000*1500/92903.04 = 32.29 sqft, +8% = 34.87
    const r = calcFilm({
      surfaceWidthMm:  2000,
      surfaceHeightMm: 1500,
      quantity:        1,
      rollWidthMm:     1220,
      wastagePct:      8,
    });
    const expected = (2000 * 1500) / 92_903.04;
    expect(r.areaSqft).toBeCloseTo(expected, 1);
    expect(r.materialQty).toBeCloseTo(expected * 1.08, 1);
    expect(r.stripsRequired).toBe(2); // ceil(2000/1220)=2
    expect(r.cutLengthMm).toBe(1500); // no repeat = height
    expect(r.warnings).toHaveLength(0);
  });

  it("pattern repeat extends cut length, warning fires", () => {
    const r = calcFilm({
      surfaceWidthMm:  2000,
      surfaceHeightMm: 1500,
      quantity:        1,
      rollWidthMm:     1220,
      patternRepeatMm: 400,
    });
    // cutLength = ceil(1500/400)*400=ceil(3.75)*400=4*400=1600mm
    expect(r.cutLengthMm).toBe(1600);
    expect(r.warnings.some((w) => w.includes("Pattern repeat"))).toBe(true);
  });

  it("quantity scales area and material", () => {
    const single = calcFilm({
      surfaceWidthMm: 1000, surfaceHeightMm: 1000, quantity: 1,
      rollWidthMm: 1220,
    });
    const triple = calcFilm({
      surfaceWidthMm: 1000, surfaceHeightMm: 1000, quantity: 3,
      rollWidthMm: 1220,
    });
    expect(triple.areaSqft).toBeCloseTo(single.areaSqft * 3, 2);
    expect(triple.stripsRequired).toBe(single.stripsRequired * 3);
  });

  it("no pattern repeat → cutLength = surfaceHeight", () => {
    const r = calcFilm({
      surfaceWidthMm: 1000, surfaceHeightMm: 1200, quantity: 1,
      rollWidthMm: 1220, patternRepeatMm: 0,
    });
    expect(r.cutLengthMm).toBe(1200);
    expect(r.warnings).toHaveLength(0);
  });
});

describe("calcVerticalGarden — §7.6", () => {
  it("computes panels, plant count, irrigation", () => {
    // 3000×2000mm surface, 500×500 panels, 4 plants/sqft
    // area = 3000*2000/92903.04 = 64.58 sqft
    // panelArea = 500*500/92903.04 = 2.69 sqft
    // panels = ceil(64.58/2.69) = 25
    // plants = ceil(64.58*4) = 259
    const r = calcVerticalGarden({
      surfaceWidthMm:  3000,
      surfaceHeightMm: 2000,
      panelWidthMm:    500,
      panelHeightMm:   500,
      plantsPerSqft:   4,
    });
    const areaSqft = (3000 * 2000) / 92_903.04;
    expect(r.areaSqft).toBeCloseTo(areaSqft, 1);
    expect(r.panelsRequired).toBeGreaterThan(0);
    expect(r.plantCount).toBe(Math.ceil(areaSqft * 4));
    expect(r.irrigationRft).toBeCloseTo((2 * (3000 + 2000)) / 304.8, 1);
    expect(r.warnings).toHaveLength(0);
  });

  it("low plant density → warning", () => {
    const r = calcVerticalGarden({
      surfaceWidthMm:  3000,
      surfaceHeightMm: 2000,
      panelWidthMm:    500,
      panelHeightMm:   500,
      plantsPerSqft:   1, // low
    });
    expect(r.warnings.some((w) => w.includes("Low plant density"))).toBe(true);
  });
});

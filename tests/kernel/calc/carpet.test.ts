// Carpet calculator tests — §7.5 + 100% branch coverage.
import { describe, it, expect } from "vitest";
import { calcCarpet } from "@/kernel/calc/carpet";

describe("calcCarpet — §7.5", () => {
  // ── Wall-to-wall (ROLL mode) ──────────────────────────────────────────────

  it("room width ≤ rollWidth → single drop, 0 seams", () => {
    // 3000×4000mm room, roll 3660mm wide → 1 drop, no seams
    const r = calcCarpet({
      mode:          "ROLL",
      roomLengthMm:  4000,
      roomWidthMm:   3000,
      rollWidthMm:   3660,
      wastagePct:    10,
    });
    expect(r.mode).toBe("ROLL");
    if (r.mode !== "ROLL") return;
    expect(r.drops).toBe(1);
    expect(r.seams).toBe(0);
    expect(r.warnings).toHaveLength(0);
    // length = 1 drop × 4000mm = 4m + 10% = 4.4m
    expect(r.lengthM).toBeCloseTo(4.4, 2);
  });

  it("room width > rollWidth → multiple drops, seam warning fires", () => {
    // 5000×4000mm room, roll 3660mm wide → drops=ceil(5000/3660)=2, seams=1
    const r = calcCarpet({
      mode:         "ROLL",
      roomLengthMm: 4000,
      roomWidthMm:  5000,
      rollWidthMm:  3660,
      wastagePct:   0,
    });
    if (r.mode !== "ROLL") return;
    expect(r.drops).toBe(2);
    expect(r.seams).toBe(1);
    // length = 2×4000/1000 = 8m (no wastage)
    expect(r.lengthM).toBeCloseTo(8.0, 2);
    expect(r.warnings.some((w) => w.includes("seam"))).toBe(true);
  });

  it("multiple seams produce plural warning", () => {
    // 9000mm room, 3660mm roll → 3 drops, 2 seams
    const r = calcCarpet({
      mode: "ROLL", roomLengthMm: 4000, roomWidthMm: 9000,
      rollWidthMm: 3660, wastagePct: 0,
    });
    if (r.mode !== "ROLL") return;
    expect(r.seams).toBe(2);
    expect(r.warnings.some((w) => w.includes("2 seams"))).toBe(true);
  });

  it("pattern repeat extends drop length", () => {
    // 4000mm room, 600mm repeat → dropLength=ceil(4000/600)*600=ceil(6.67)*600=7*600=4200mm
    const r = calcCarpet({
      mode: "ROLL", roomLengthMm: 4000, roomWidthMm: 3000,
      rollWidthMm: 3660, patternRepeatMm: 600, wastagePct: 0,
    });
    if (r.mode !== "ROLL") return;
    expect(r.lengthM).toBeCloseTo(4.2, 2); // 4200/1000
  });

  it("areaSqft = room area (not with wastage or drops)", () => {
    const r = calcCarpet({
      mode: "ROLL", roomLengthMm: 4000, roomWidthMm: 3000,
      rollWidthMm: 3660, wastagePct: 0,
    });
    if (r.mode !== "ROLL") return;
    const expected = (4000 * 3000) / 92_903.04;
    expect(r.areaSqft).toBeCloseTo(expected, 1);
  });

  // ── Carpet tiles (TILE mode) ──────────────────────────────────────────────

  it("carpet tiles → boxes required from tiles per box", () => {
    // 4000×3000mm room, 500×500 tiles (0.25m²/tile = 2.691sqft/tile), 25 tiles/box
    // area = 12.903sqm ≈ 138.88sqft, tile area = 0.25m²/92903.04mm² = 2.691 sqft
    // With 10% wastage: tiles = ceil((138.88/2.691)*1.10)=ceil(56.75)=57, boxes=ceil(57/25)=3
    const r = calcCarpet({
      mode:          "TILE",
      roomLengthMm:  4000,
      roomWidthMm:   3000,
      tileSizeMm:    500,
      tilesPerBox:   25,
      wastagePct:    10,
    });
    if (r.mode !== "TILE") return;
    expect(r.mode).toBe("TILE");
    expect(r.tilesNeeded).toBeGreaterThan(0);
    expect(r.boxesRequired).toBeGreaterThan(0);
    expect(r.warnings).toHaveLength(0);
  });

  it("TILE mode returns materialUnit BOX", () => {
    const r = calcCarpet({
      mode: "TILE", roomLengthMm: 4000, roomWidthMm: 3000,
      tileSizeMm: 500, tilesPerBox: 25,
    });
    expect(r.materialUnit).toBe("BOX");
  });

  it("ROLL mode returns materialUnit SQFT", () => {
    const r = calcCarpet({
      mode: "ROLL", roomLengthMm: 4000, roomWidthMm: 3000, rollWidthMm: 3660,
    });
    expect(r.materialUnit).toBe("SQFT");
  });
});

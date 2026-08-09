// Wallpaper engine tests — §7.2 worked examples + 100% branch coverage.
import { describe, it, expect } from "vitest";
import { calcWallpaper } from "@/kernel/calc/wallpaper";

const ROLL = { rollWidthMm: 530, rollLengthM: 10.05 };

describe("calcWallpaper — §7.2", () => {
  // §7.2 Test 1: 4000×2700 FREE match, 530×10.05m → 3 strips/roll, 8 strips, 3 rolls
  it("4000×2700 FREE match → 3 strips/roll, 8 strips, 3 rolls", () => {
    const r = calcWallpaper({
      ...ROLL,
      wallWidthMm:     4000,
      wallHeightMm:    2700,
      patternRepeatMm: 0,
      patternMatch:    "FREE",
      wastagePct:      0,
    });
    expect(r.stripsPerRoll).toBe(3);    // floor(10050/2700) = 3
    expect(r.stripsNeeded).toBe(8);     // ceil(4000/530) = 8
    expect(r.rollsRequired).toBe(3);    // ceil(8/3) = 3
    expect(r.cutLengthMm).toBe(2700);
    expect(r.warnings).toHaveLength(0);
  });

  // §7.2 Test 2: same with 640mm STRAIGHT repeat
  it("same wall with 640mm STRAIGHT repeat → cutLength=3200mm, 3 strips/roll", () => {
    // cutLength = ceil(2700/640)*640 = ceil(4.22)*640 = 5*640 = 3200mm
    // stripsPerRoll = floor(10050/3200) = 3
    const r = calcWallpaper({
      ...ROLL,
      wallWidthMm:     4000,
      wallHeightMm:    2700,
      patternRepeatMm: 640,
      patternMatch:    "STRAIGHT",
      wastagePct:      0,
    });
    expect(r.cutLengthMm).toBe(3200);
    expect(r.stripsPerRoll).toBe(3);
    expect(r.stripsNeeded).toBe(8);
    expect(r.rollsRequired).toBe(3);
  });

  // §7.2 Test 3: OFFSET repeat that reduces strips per roll → more rolls, warning fires
  // Using 700mm repeat where offset gives 3500mm cut length:
  // cutLength = ceil((2700+350)/700)*700 = ceil(3050/700)*700 = ceil(4.36)*700 = 5*700 = 3500mm
  // stripsPerRoll = floor(10050/3500) = 2 → rolls = ceil(8/2) = 4
  it("700mm OFFSET repeat → fewer strips per roll, more rolls, warning fires", () => {
    const r = calcWallpaper({
      ...ROLL,
      wallWidthMm:     4000,
      wallHeightMm:    2700,
      patternRepeatMm: 700,
      patternMatch:    "OFFSET",
      wastagePct:      0,
    });
    expect(r.cutLengthMm).toBe(3500);
    expect(r.stripsPerRoll).toBe(2);
    expect(r.rollsRequired).toBe(4);
    expect(r.warnings.some((w) => w.includes("Half-drop"))).toBe(true);
  });

  // §7.2 Test 4: 900×2100 door inside 4000×2700 wall → NOT deducted, warning explains
  it("900×2100 door in 4000×2700 wall → not deducted, warning fires", () => {
    // door area = 900*2100=1.89m² > 1.5m² BUT height 2100 < wallHeight 2700 → skip
    const r = calcWallpaper({
      ...ROLL,
      wallWidthMm:     4000,
      wallHeightMm:    2700,
      patternRepeatMm: 0,
      patternMatch:    "FREE",
      wastagePct:      0,
      deductions: [
        { label: "Main door", widthMm: 900, heightMm: 2100 },
      ],
    });
    // stripsNeeded unchanged — door not deducted
    expect(r.stripsNeeded).toBe(8);
    expect(r.warnings.some((w) => w.includes("not deducted"))).toBe(true);
  });

  // ── Additional branch coverage ────────────────────────────────────────────

  it("wastage % increases roll count", () => {
    const noWaste = calcWallpaper({
      ...ROLL,
      wallWidthMm: 4000, wallHeightMm: 2700,
      patternRepeatMm: 0, patternMatch: "FREE", wastagePct: 0,
    });
    const withWaste = calcWallpaper({
      ...ROLL,
      wallWidthMm: 4000, wallHeightMm: 2700,
      patternRepeatMm: 0, patternMatch: "FREE", wastagePct: 10,
    });
    // effectiveStrips = ceil(8*1.1)=9, rolls=ceil(9/3)=3 — same in this case;
    // use a case where it bumps:
    const withWaste2 = calcWallpaper({
      rollWidthMm: 530, rollLengthM: 10.05,
      wallWidthMm: 3700, wallHeightMm: 2700, // stripsNeeded=ceil(3700/530)=7, rolls=ceil(7/3)=3
      patternRepeatMm: 0, patternMatch: "FREE", wastagePct: 30,
      // effectiveStrips=ceil(7*1.3)=ceil(9.1)=10, rolls=ceil(10/3)=4
    });
    expect(withWaste2.rollsRequired).toBe(4);
    expect(noWaste.rollsRequired).toBeLessThanOrEqual(withWaste.rollsRequired);
  });

  it("deduction spanning full wall height is applied", () => {
    // Opening 1100×2700 (full height) with area=2.97m²>1.5m²: deduct floor(1100/530)=2 strips
    const r = calcWallpaper({
      ...ROLL,
      wallWidthMm:     4000,
      wallHeightMm:    2700,
      patternRepeatMm: 0,
      patternMatch:    "FREE",
      wastagePct:      0,
      deductions: [
        { label: "Full-height recess", widthMm: 1100, heightMm: 2700 },
      ],
    });
    // effectiveStrips = 8 - 2 = 6, rolls = ceil(6/3) = 2
    expect(r.rollsRequired).toBe(2);
    expect(r.warnings).toHaveLength(0);
  });

  it("opening < 1.5 sqm → not deducted, warning fires", () => {
    // 500×2700 = 1.35 sqm < 1.5
    const r = calcWallpaper({
      ...ROLL,
      wallWidthMm: 4000, wallHeightMm: 2700,
      patternRepeatMm: 0, patternMatch: "FREE", wastagePct: 0,
      deductions: [{ label: "Small vent", widthMm: 500, heightMm: 2700 }],
    });
    expect(r.stripsNeeded).toBe(8);
    expect(r.warnings.some((w) => w.includes("not deducted"))).toBe(true);
  });

  it("deductions with qty > 1 multiply correctly", () => {
    // 1100×2700 full-height, qty=2 → 4 strips deducted
    const r = calcWallpaper({
      ...ROLL,
      wallWidthMm: 6000, wallHeightMm: 2700,
      patternRepeatMm: 0, patternMatch: "FREE", wastagePct: 0,
      deductions: [{ label: "Bay window", widthMm: 1100, heightMm: 2700, qty: 2 }],
    });
    // wallStrips = ceil(6000/530)=12, deducted=2*2=4, effective=8, rolls=ceil(8/3)=3
    expect(r.stripsNeeded).toBe(12);
    expect(r.rollsRequired).toBe(3);
  });

  it("areaSqft computed correctly", () => {
    const r = calcWallpaper({
      ...ROLL,
      wallWidthMm: 4000, wallHeightMm: 2700,
      patternRepeatMm: 0, patternMatch: "FREE", wastagePct: 0,
    });
    const expected = (4000 * 2700) / (0.09290304 * 1_000_000);
    expect(r.areaSqft).toBeCloseTo(expected, 2);
  });

  it("deduction with no label → warning shows 'unnamed' (line 81 branch)", () => {
    // area = 500×2700 = 1.35 m² < 1.5 m² → deduction not applied, warning fires
    // label is omitted → hits the `?? "unnamed"` fallback
    const r = calcWallpaper({
      ...ROLL,
      wallWidthMm: 4000, wallHeightMm: 2700,
      patternRepeatMm: 0, patternMatch: "FREE", wastagePct: 0,
      deductions: [{ widthMm: 500, heightMm: 2700 }],
    });
    expect(r.warnings.some((w) => w.includes("unnamed"))).toBe(true);
    expect(r.rollsRequired).toBe(3); // strip count unchanged — no deduction applied
  });
});

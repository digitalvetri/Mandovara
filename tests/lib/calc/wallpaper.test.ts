// Tests for /lib/calc/wallpaper — the Measure & Material Engine
// (see TRACK-B-CRAFT.md §4.1).
//
// Tests-first per the spec:
//   "Write the tests first, covering every case in the table including the
//    deduction rule and the offset-repeat warning. Then implement until they
//    pass. Anything below 100% branch coverage is not done."

import { describe, expect, it } from "vitest";
import {
  calcWallpaper,
  WALLPAPER_ENGINE_VERSION,
  type WallpaperInput,
} from "@/lib/calc/wallpaper";

// ── shared base — the §4.1 canonical wall: 4000×2700, 530mm × 10.05m roll
const BASE: WallpaperInput = {
  wallWidthMm:     4000,
  wallHeightMm:    2700,
  rollWidthMm:      530,
  rollLengthM:    10.05,
  patternMatch:  "FREE",
  patternRepeatMm:    0,
  deductions:        [],
};

describe("calcWallpaper — engine version", () => {
  it("is a stable semver string so QuotationLine.calcSnapshot can freeze it", () => {
    expect(WALLPAPER_ENGINE_VERSION).toMatch(/^wallpaper@\d+\.\d+\.\d+$/);
  });

  it("stamps the version onto every result", () => {
    const r = calcWallpaper(BASE);
    expect(r.engineVersion).toBe(WALLPAPER_ENGINE_VERSION);
  });
});

describe("calcWallpaper — §4.1 canonical test table", () => {
  it("FREE match, 4000×2700, 530×10.05m → 3 strips/roll, 8 strips, 3 rolls", () => {
    const r = calcWallpaper(BASE);
    expect(r.patternMatchApplied).toBe("FREE");
    expect(r.cutLengthMm).toBe(2700);
    expect(r.stripsPerRoll).toBe(3);
    expect(r.stripsNeeded).toBe(8);
    expect(r.rollsRequired).toBe(3);
  });

  it("STRAIGHT 640mm repeat → cut 3200mm, 3 strips/roll, 3 rolls", () => {
    const r = calcWallpaper({
      ...BASE,
      patternMatch:   "STRAIGHT",
      patternRepeatMm: 640,
    });
    expect(r.patternMatchApplied).toBe("STRAIGHT");
    expect(r.cutLengthMm).toBe(3200);
    expect(r.stripsPerRoll).toBe(3);
    expect(r.stripsNeeded).toBe(8);
    expect(r.rollsRequired).toBe(3);
  });

  it("OFFSET (half-drop) 640mm repeat → cut 3520mm, 2 strips/roll, 4 rolls + warning", () => {
    const r = calcWallpaper({
      ...BASE,
      patternMatch:   "OFFSET",
      patternRepeatMm: 640,
    });
    expect(r.patternMatchApplied).toBe("OFFSET");
    expect(r.cutLengthMm).toBe(3520);
    expect(r.stripsPerRoll).toBe(2);
    expect(r.stripsNeeded).toBe(8);
    expect(r.rollsRequired).toBe(4);
    // Warning names the extra roll a half-drop pattern costs.
    expect(r.warnings.some((w) => /half-drop.*adds.*1 roll/i.test(w))).toBe(true);
  });
});

describe("calcWallpaper — deductions", () => {
  it("does NOT deduct a 900×2100 door in a 2700 wall (does not span full height), and warns why", () => {
    const r = calcWallpaper({
      ...BASE,
      deductions: [{ widthMm: 900, heightMm: 2100, label: "Door" }],
    });
    // Same roll count as the no-deduction case
    expect(r.rollsRequired).toBe(3);
    // Explicit warning explains why the door was ignored
    expect(
      r.warnings.some((w) => /door/i.test(w) && /not deducted/i.test(w)),
    ).toBe(true);
  });

  it("does NOT deduct an opening smaller than 1.5 m²", () => {
    // 1000×1000 = 1 m² — below the 1.5 m² threshold
    const r = calcWallpaper({
      ...BASE,
      deductions: [{ widthMm: 1000, heightMm: 1000, label: "Small window" }],
    });
    expect(r.rollsRequired).toBe(3);
    expect(
      r.warnings.some((w) => /small window/i.test(w) && /not deducted/i.test(w)),
    ).toBe(true);
  });

  it("does NOT deduct an opening narrower than one roll width, and warns why", () => {
    // 400mm wide × 4000mm tall = 1.6 m² (> threshold), fits full wall height,
    // but narrower than the 530mm strip so no whole strip can be skipped.
    const r = calcWallpaper({
      ...BASE,
      wallHeightMm: 4000,
      deductions: [{ widthMm: 400, heightMm: 4000, label: "Narrow slot" }],
    });
    expect(
      r.warnings.some((w) => /narrow slot/i.test(w) && /narrower.*roll width/i.test(w)),
    ).toBe(true);
  });

  it("DOES deduct an opening that is > 1.5 m², spans full wall height, and is at least one strip wide", () => {
    // 1600mm wide (> 530 strip) × 2700mm high (== full wall) = 4.32 m²  → skips 3 strips
    // Base needs 8 strips; deducting 3 leaves 5 strips → still 2 rolls at 3 strips/roll
    const r = calcWallpaper({
      ...BASE,
      deductions: [{ widthMm: 1600, heightMm: 2700, label: "Full opening" }],
    });
    expect(r.stripsNeeded).toBe(5);
    expect(r.rollsRequired).toBe(2);
    // No "not deducted" warning for this one
    expect(r.warnings.some((w) => /not deducted/i.test(w))).toBe(false);
  });
});

describe("calcWallpaper — half-drop warning pluralisation", () => {
  it("says 'rolls' (plural) when the offset match adds more than one extra roll", () => {
    // Deliberately extreme case: half-drop cuts strips/roll from 5 → 2,
    // buying 2 extra rolls instead of 1.
    const r = calcWallpaper({
      wallWidthMm:     4000,
      wallHeightMm:    1000,
      rollWidthMm:      530,
      rollLengthM:        5,     // 5000mm
      patternMatch:  "OFFSET",
      patternRepeatMm:  800,
      deductions:        [],
    });
    expect(r.rollsRequired).toBeGreaterThan(2);
    expect(
      r.warnings.some((w) => /half-drop.*adds \d+ rolls\b/i.test(w)),
    ).toBe(true);
  });
});

describe("calcWallpaper — repeat taller than the wall", () => {
  it("falls back to FREE match with a warning when patternRepeatMm > wallHeightMm", () => {
    const r = calcWallpaper({
      ...BASE,
      patternMatch:  "STRAIGHT",
      patternRepeatMm: 3000,     // > 2700 wall
    });
    expect(r.patternMatchApplied).toBe("FREE");
    expect(r.cutLengthMm).toBe(2700);   // FREE cut
    expect(
      r.warnings.some((w) => /repeat.*taller than.*wall/i.test(w)),
    ).toBe(true);
  });
});

describe("calcWallpaper — input safety", () => {
  it("throws on non-positive wall width", () => {
    expect(() => calcWallpaper({ ...BASE, wallWidthMm: 0 })).toThrow();
  });

  it("throws on non-positive wall height", () => {
    expect(() => calcWallpaper({ ...BASE, wallHeightMm: -1 })).toThrow();
  });

  it("throws on non-positive roll width", () => {
    expect(() => calcWallpaper({ ...BASE, rollWidthMm: 0 })).toThrow();
  });

  it("throws on non-positive roll length", () => {
    expect(() => calcWallpaper({ ...BASE, rollLengthM: 0 })).toThrow();
  });

  it("throws when STRAIGHT/OFFSET is chosen but patternRepeatMm is 0", () => {
    expect(() =>
      calcWallpaper({ ...BASE, patternMatch: "STRAIGHT", patternRepeatMm: 0 }),
    ).toThrow();
    expect(() =>
      calcWallpaper({ ...BASE, patternMatch: "OFFSET", patternRepeatMm: 0 }),
    ).toThrow();
  });

  it("throws if the cutLength would exceed the roll length (impossible to cut)", () => {
    // 2700mm wall but only a 2m roll → cannot cut even one strip
    expect(() => calcWallpaper({ ...BASE, rollLengthM: 2 })).toThrow();
  });
});

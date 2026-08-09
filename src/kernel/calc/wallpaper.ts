// Wallpaper roll calculator — §7.2.
// Pure: no I/O, no side-effects.

import type { Deduction, PatternMatch } from "./types";

export interface WallpaperInput {
  wallWidthMm:      number;
  wallHeightMm:     number;
  deductions?:      Deduction[];  // door/window openings
  rollWidthMm:      number;       // typically 530
  rollLengthM:      number;       // typically 10.05
  patternRepeatMm:  number;       // 0 = FREE
  patternMatch:     PatternMatch;
  wastagePct:       number;       // e.g. 10 for 10 %
}

export interface WallpaperResult {
  readonly engineVersion: "wallpaper@1.2.0";
  rollsRequired:  number;
  stripsPerRoll:  number;
  stripsNeeded:   number;
  cutLengthMm:    number;
  areaSqft:       number;
  warnings:       string[];
}

const ENGINE_VERSION = "wallpaper@1.2.0" as const;
const SQM_PER_SQFT   = 0.09290304;  // 1 sqft in m²

export function calcWallpaper(input: WallpaperInput): WallpaperResult {
  const {
    wallWidthMm,
    wallHeightMm,
    deductions = [],
    rollWidthMm,
    rollLengthM,
    patternRepeatMm,
    patternMatch,
    wastagePct,
  } = input;

  const warnings: string[] = [];

  // ── Cut length per strip ──────────────────────────────────────────────────
  let cutLengthMm: number;
  if (patternRepeatMm > 0 && patternMatch !== "FREE") {
    if (patternMatch === "STRAIGHT") {
      cutLengthMm = Math.ceil(wallHeightMm / patternRepeatMm) * patternRepeatMm;
    } else {
      // OFFSET (half-drop): each alternate strip needs a half-repeat shift.
      cutLengthMm =
        Math.ceil((wallHeightMm + patternRepeatMm / 2) / patternRepeatMm) *
        patternRepeatMm;
      warnings.push(
        `Half-drop match (${patternRepeatMm}mm repeat): cut length extended to ` +
        `${cutLengthMm}mm to allow for offset alignment.`,
      );
    }
  } else {
    cutLengthMm = wallHeightMm;
  }

  // ── Strips per roll and strips needed ─────────────────────────────────────
  const rollLengthMm  = rollLengthM * 1000;
  const stripsPerRoll = Math.floor(rollLengthMm / cutLengthMm);
  const stripsNeeded  = Math.ceil(wallWidthMm / rollWidthMm);

  // ── Deductions (strict: area > 1.5 sqm AND opening spans full wall height) ─
  // Partial strips cannot be reused — only deduct openings that consume a
  // complete, otherwise-wasted strip from top to bottom.
  let deductedStrips = 0;
  for (const d of deductions) {
    const qty  = d.qty ?? 1;
    const area = (d.widthMm * d.heightMm * qty) / 1_000_000; // m²
    if (area > 1.5 && d.heightMm >= wallHeightMm) {
      const openingStrips = Math.floor(d.widthMm / rollWidthMm);
      deductedStrips += openingStrips * qty;
    } else {
      const areaSqm = ((d.widthMm * d.heightMm) / 1_000_000).toFixed(2);
      warnings.push(
        `Opening "${d.label ?? "unnamed"}" (${areaSqm} m²) not deducted — ` +
        `partial strips cannot be reused; wallpaper above/below opening is still required.`,
      );
    }
  }
  const effectiveStrips = Math.max(stripsNeeded - deductedStrips, 0);

  // ── Wastage and final roll count ──────────────────────────────────────────
  const stripsWithWastage = effectiveStrips * (1 + wastagePct / 100);
  const rollsRequired     = Math.ceil(Math.ceil(stripsWithWastage) / stripsPerRoll);

  const areaSqft = parseFloat(
    ((wallWidthMm * wallHeightMm) / (SQM_PER_SQFT * 1_000_000)).toFixed(3),
  );

  return {
    engineVersion: ENGINE_VERSION,
    rollsRequired,
    stripsPerRoll,
    stripsNeeded,
    cutLengthMm,
    areaSqft,
    warnings,
  };
}

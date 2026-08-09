// Blind area calculator — §7.3.
// Pure: no I/O, no side-effects.

import type { MountType } from "./types";

export interface BlindInput {
  widthMm:         number;
  heightMm:        number;
  quantity:        number;
  mountType:       MountType;
  minChargeSqft:   number;           // minimum billable area per blind
  roundToMm?:      number;           // rounding grid, default 25
  // ── mount clearances / overrides (mm) — org-configurable
  insideClearanceMm?:    number;     // deducted each side for INSIDE mount, default 6
  outsideOverlapSideMm?: number;     // added each side for OUTSIDE mount, default 75
  outsideOverlapTopMm?:  number;     // added at top for OUTSIDE mount, default 100
  ceilingClearanceMm?:   number;     // deducted from bottom for CEILING mount, default 12
}

export interface BlindResult {
  readonly engineVersion: "blind@1.2.0";
  adjustedWidthMm:   number;
  adjustedHeightMm:  number;
  areaSqft:          number;   // actual area
  billableAreaSqft:  number;   // max(area, minCharge) × quantity
  materialUnit:      "SQFT";
  warnings:          string[];
}

const ENGINE_VERSION    = "blind@1.2.0" as const;
const MM2_PER_SQFT      = 92_903.04; // 1 sqft = 92903.04 mm²

export function calcBlind(input: BlindInput): BlindResult {
  const {
    widthMm,
    heightMm,
    quantity,
    mountType,
    minChargeSqft,
    roundToMm             = 25,
    insideClearanceMm     = 6,
    outsideOverlapSideMm  = 75,
    outsideOverlapTopMm   = 100,
    ceilingClearanceMm    = 12,
  } = input;

  const warnings: string[] = [];

  // ── Apply mount adjustments ───────────────────────────────────────────────
  let adjW = widthMm;
  let adjH = heightMm;

  if (mountType === "INSIDE") {
    adjW = widthMm - insideClearanceMm * 2;
    adjH = heightMm; // height stays as measured
  } else if (mountType === "OUTSIDE") {
    adjW = widthMm + outsideOverlapSideMm * 2;
    adjH = heightMm + outsideOverlapTopMm;
  } else {
    // CEILING: width as given, height to floor minus small clearance
    adjW = widthMm;
    adjH = heightMm - ceilingClearanceMm;
  }

  // ── Round to grid ─────────────────────────────────────────────────────────
  const roundedW = Math.ceil(adjW / roundToMm) * roundToMm;
  const roundedH = Math.ceil(adjH / roundToMm) * roundToMm;

  // ── Area ─────────────────────────────────────────────────────────────────
  const areaSqftEach    = (roundedW * roundedH) / MM2_PER_SQFT;
  const billableEach    = Math.max(areaSqftEach, minChargeSqft);
  const billableAreaSqft = parseFloat((billableEach * quantity).toFixed(3));
  const areaSqft         = parseFloat((areaSqftEach * quantity).toFixed(3));

  if (areaSqftEach < minChargeSqft) {
    warnings.push(
      `Minimum charge applied: ${minChargeSqft} sqft per blind vs actual ` +
      `${areaSqftEach.toFixed(2)} sqft.`,
    );
  }

  return {
    engineVersion:    ENGINE_VERSION,
    adjustedWidthMm:  roundedW,
    adjustedHeightMm: roundedH,
    areaSqft,
    billableAreaSqft,
    materialUnit:     "SQFT",
    warnings,
  };
}

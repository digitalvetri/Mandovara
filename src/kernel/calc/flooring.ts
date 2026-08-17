// Flooring box calculator — §7.4.
// Pure: no I/O, no side-effects.

import type { LayPattern } from "./types";

export interface FlooringInput {
  // Provide either room dimensions (mm) or pre-computed area (sqft):
  roomLengthMm?:   number;
  roomWidthMm?:    number;
  areaSqft?:       number;
  areaPerBoxSqft:  number;   // from Design (e.g. 2.2 for laminate)
  layPattern:      LayPattern;
  // ── wastage rates (org-configurable, defaults from §4)
  straightWastagePct?:    number;  // default 7
  diagonalWastagePct?:    number;  // default 10
  herringboneWastagePct?: number;  // default 15
  // ── door openings to subtract from perimeter skirting (running feet)
  doorOpeningsRft?: number;
  // ── roll goods (sheet vinyl / SPC roll). When set, the result is reported
  //    as roll length + seams instead of boxes. Absorbed from the former
  //    /lib/calc/flooring.ts so one calculator serves both (§15.2).
  rollWidthMm?:     number;
}

export interface FlooringResult {
  readonly engineVersion: "flooring@2.0.0";
  areaSqft:       number;
  wastagePct:     number;
  areaWithWastage: number;
  boxesRequired:  number;
  skirtingRft:    number | null;  // null if room dimensions not provided
  materialUnit:   "BOX" | "ROLL";
  // ── roll goods only, null for box-packed product
  stripsRequired: number | null;
  rollLengthM:    number | null;
  seamCount:      number | null;
  warnings:       string[];
}

const ENGINE_VERSION  = "flooring@2.0.0" as const;
const MM2_PER_SQFT    = 92_903.04;

const DEFAULT_WASTAGE: Record<LayPattern, number> = {
  STRAIGHT:    7,
  DIAGONAL:    10,
  HERRINGBONE: 15,
};

export function calcFlooring(input: FlooringInput): FlooringResult {
  const {
    roomLengthMm,
    roomWidthMm,
    areaSqft: providedSqft,
    areaPerBoxSqft,
    layPattern,
    straightWastagePct    = DEFAULT_WASTAGE.STRAIGHT,
    diagonalWastagePct    = DEFAULT_WASTAGE.DIAGONAL,
    herringboneWastagePct = DEFAULT_WASTAGE.HERRINGBONE,
    doorOpeningsRft       = 0,
    rollWidthMm,
  } = input;

  const warnings: string[] = [];

  // ── Area ─────────────────────────────────────────────────────────────────
  let areaSqft: number;
  let skirtingRft: number | null = null;

  if (providedSqft !== undefined) {
    areaSqft = providedSqft;
  } else if (roomLengthMm !== undefined && roomWidthMm !== undefined) {
    areaSqft = (roomLengthMm * roomWidthMm) / MM2_PER_SQFT;
    // Perimeter in running feet: 2 × (L + W) in mm → / 304.8 to convert mm → ft
    const perimeterRft = (2 * (roomLengthMm + roomWidthMm)) / 304.8;
    skirtingRft = parseFloat(Math.max(perimeterRft - doorOpeningsRft, 0).toFixed(2));
  } else {
    warnings.push("Neither room dimensions nor area provided — returning 0.");
    areaSqft = 0;
  }

  // ── Wastage ───────────────────────────────────────────────────────────────
  const wastagePct =
    layPattern === "STRAIGHT"
      ? straightWastagePct
      : layPattern === "DIAGONAL"
        ? diagonalWastagePct
        : herringboneWastagePct;

  const areaWithWastage = areaSqft * (1 + wastagePct / 100);
  const boxesRequired   = Math.ceil(areaWithWastage / areaPerBoxSqft);

  // ── Roll goods: strips across the room width, seams between them ─────────
  let stripsRequired: number | null = null;
  let rollLengthM:    number | null = null;
  let seamCount:      number | null = null;

  if (rollWidthMm !== undefined) {
    if (!(rollWidthMm > 0)) {
      throw new Error(`calcFlooring: rollWidthMm must be > 0, got ${rollWidthMm}`);
    }
    if (roomLengthMm === undefined || roomWidthMm === undefined) {
      warnings.push("Roll goods need room dimensions — strip and seam count omitted.");
    } else {
      stripsRequired = Math.ceil(roomWidthMm / rollWidthMm);
      rollLengthM    = parseFloat(((stripsRequired * roomLengthMm) / 1000).toFixed(3));
      seamCount      = stripsRequired - 1;
      if (seamCount > 0) {
        warnings.push(
          `${seamCount} seam${seamCount > 1 ? "s" : ""} required — ` +
          `confirm placement with the client before ordering.`,
        );
      }
    }
  }

  return {
    engineVersion:   ENGINE_VERSION,
    areaSqft:        parseFloat(areaSqft.toFixed(3)),
    wastagePct,
    areaWithWastage: parseFloat(areaWithWastage.toFixed(3)),
    boxesRequired,
    skirtingRft,
    materialUnit:    rollWidthMm !== undefined ? "ROLL" : "BOX",
    stripsRequired,
    rollLengthM,
    seamCount,
    warnings,
  };
}

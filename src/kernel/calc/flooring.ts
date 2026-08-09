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
}

export interface FlooringResult {
  readonly engineVersion: "flooring@1.2.0";
  areaSqft:       number;
  wastagePct:     number;
  areaWithWastage: number;
  boxesRequired:  number;
  skirtingRft:    number | null;  // null if room dimensions not provided
  materialUnit:   "BOX";
  warnings:       string[];
}

const ENGINE_VERSION  = "flooring@1.2.0" as const;
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

  return {
    engineVersion:   ENGINE_VERSION,
    areaSqft:        parseFloat(areaSqft.toFixed(3)),
    wastagePct,
    areaWithWastage: parseFloat(areaWithWastage.toFixed(3)),
    boxesRequired,
    skirtingRft,
    materialUnit:    "BOX",
    warnings,
  };
}

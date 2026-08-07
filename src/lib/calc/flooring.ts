// /lib/calc/flooring.ts — the flooring calculator, second file in the
// Measure & Material Engine (TRACK-B-CRAFT.md §4.2).
//
// Same rules as wallpaper.ts:
//   - Pure function, no I/O.
//   - Versioned (flooring@1.0.0); every result carries the version so a
//     sent QuotationLine.calcSnapshot stays traceable to the exact formula.
//   - Warnings are plain English, rendered in the UI and printed on the
//     quotation notes for Rohit's client to read.
//
// Constants (wastage per lay pattern) will move to Organization.settings
// once that surface exists. Exported here so callers can override for
// tests and so a reviewer can eyeball them in one place.

export const FLOORING_ENGINE_VERSION = "flooring@1.0.0";

export type LayPattern = "STRAIGHT" | "DIAGONAL" | "HERRINGBONE";

export type FlooringProduct =
  | { kind: "BOX";  areaPerBoxSqft: number }
  | { kind: "ROLL"; rollWidthMm: number    };

export interface FlooringInput {
  roomLengthMm:            number;
  roomWidthMm:             number;
  layPattern:              LayPattern;
  product:                 FlooringProduct;
  doorOpeningWidthsMm?:    readonly number[];  // deducted from skirting
}

export interface FlooringResult {
  engineVersion:            string;
  areaSqft:                 number;
  wastagePct:               number;
  areaWithWastageSqft:      number;
  skirtingRft:              number;
  boxesRequired?:           number;   // BOX product
  stripsRequired?:          number;   // ROLL product
  rollLengthM?:             number;   // ROLL product
  seamCount?:               number;   // ROLL product
  warnings:                 string[];
}

// Per §4.2 — wastage default per lay pattern. Org-configurable eventually.
export const WASTAGE_PCT_BY_PATTERN: Record<LayPattern, number> = {
  STRAIGHT:    7,
  DIAGONAL:   10,
  HERRINGBONE: 15,
};

// Conversions
const MM2_PER_SQFT   = 92903.04;   // 1 sqft = 92903.04 mm²
const MM_PER_FT      = 304.8;

export function calcFlooring(input: FlooringInput): FlooringResult {
  assertPositive("roomLengthMm", input.roomLengthMm);
  assertPositive("roomWidthMm",  input.roomWidthMm);

  const warnings: string[] = [];

  // ── 1. Area (raw), wastage %, area-with-wastage.
  const areaSqft            = (input.roomLengthMm * input.roomWidthMm) / MM2_PER_SQFT;
  const wastagePct          = WASTAGE_PCT_BY_PATTERN[input.layPattern];
  const areaWithWastageSqft = areaSqft * (1 + wastagePct / 100);

  // ── 2. Skirting — perimeter in running feet, minus door openings.
  const doorSumMm     = (input.doorOpeningWidthsMm ?? []).reduce((s, w) => {
    if (w < 0) throw new Error(`calcFlooring: door opening width must be >= 0, got ${w}`);
    return s + w;
  }, 0);
  const perimeterMm   = 2 * (input.roomLengthMm + input.roomWidthMm);
  const skirtingMm    = Math.max(0, perimeterMm - doorSumMm);
  const skirtingRft   = skirtingMm / MM_PER_FT;

  // ── 3. Product-specific quantities.
  const base: FlooringResult = {
    engineVersion: FLOORING_ENGINE_VERSION,
    areaSqft,
    wastagePct,
    areaWithWastageSqft,
    skirtingRft,
    warnings,
  };

  if (input.product.kind === "BOX") {
    assertPositive("areaPerBoxSqft", input.product.areaPerBoxSqft);
    const boxesRequired = Math.ceil(areaWithWastageSqft / input.product.areaPerBoxSqft);
    warnAboveStraight(input, warnings, areaSqft, input.product.areaPerBoxSqft, boxesRequired);
    return { ...base, boxesRequired };
  }

  // ROLL
  assertPositive("rollWidthMm", input.product.rollWidthMm);
  const stripsRequired = Math.ceil(input.roomWidthMm / input.product.rollWidthMm);
  const rollLengthM    = (stripsRequired * input.roomLengthMm) / 1000;
  const seamCount      = stripsRequired - 1;
  if (seamCount > 0) {
    warnings.push(
      `${seamCount} seam${seamCount > 1 ? "s" : ""} required — confirm placement with the client before ordering.`,
    );
  }
  return { ...base, stripsRequired, rollLengthM, seamCount };
}

// If the lay pattern is anything but STRAIGHT, tell the client how many
// extra boxes the fancy pattern costs vs a plain straight lay. Same
// spirit as wallpaper's "half-drop adds 1 roll" warning — it makes the
// decision to go diagonal / herringbone an informed one.
function warnAboveStraight(
  input:            FlooringInput,
  warnings:         string[],
  areaSqft:         number,
  areaPerBoxSqft:   number,
  boxesRequired:    number,
): void {
  if (input.layPattern === "STRAIGHT") return;
  const straightPct = WASTAGE_PCT_BY_PATTERN.STRAIGHT;
  const straightBoxes = Math.ceil(
    (areaSqft * (1 + straightPct / 100)) / areaPerBoxSqft,
  );
  const extra = boxesRequired - straightBoxes;
  if (extra <= 0) return;
  warnings.push(
    `${input.layPattern.toLowerCase()} lay adds ${extra} extra box${extra > 1 ? "es" : ""} versus a straight lay.`,
  );
}

function assertPositive(name: string, v: number): void {
  if (!(v > 0)) {
    throw new Error(`calcFlooring: ${name} must be > 0, got ${v}`);
  }
}

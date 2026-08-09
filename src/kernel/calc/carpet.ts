// Carpet calculator — §7.5 — handles both roll goods and tiles.
// Pure: no I/O, no side-effects.

import type { CarpetMode } from "./types";

// ── Wall-to-wall roll goods ───────────────────────────────────────────────

export interface CarpetRollInput {
  mode:             "ROLL";
  roomLengthMm:     number;
  roomWidthMm:      number;
  rollWidthMm:      number;       // typically 3660
  patternRepeatMm?: number;       // 0 / omitted = no repeat
  wastagePct?:      number;       // default 10
}

export interface CarpetRollResult {
  readonly engineVersion: "carpet@1.2.0";
  mode:        "ROLL";
  drops:       number;
  seams:       number;
  lengthM:     number;   // total metres of roll needed
  areaSqft:    number;
  materialUnit: "SQFT";
  warnings:    string[];
}

// ── Carpet tiles ─────────────────────────────────────────────────────────

export interface CarpetTileInput {
  mode:              "TILE";
  roomLengthMm:      number;
  roomWidthMm:       number;
  tileSizeMm:        number;       // assumes square tile
  tilesPerBox:       number;
  wastagePct?:       number;       // default 10
}

export interface CarpetTileResult {
  readonly engineVersion: "carpet@1.2.0";
  mode:         "TILE";
  areaSqft:     number;
  tilesNeeded:  number;
  boxesRequired: number;
  materialUnit: "BOX";
  warnings:     string[];
}

export type CarpetInput  = CarpetRollInput  | CarpetTileInput;
export type CarpetResult = CarpetRollResult | CarpetTileResult;

const ENGINE_VERSION = "carpet@1.2.0" as const;
const MM2_PER_SQFT   = 92_903.04;

export function calcCarpet(input: CarpetInput): CarpetResult {
  if (input.mode === "TILE") {
    return calcCarpetTile(input);
  }
  return calcCarpetRoll(input);
}

function calcCarpetRoll(input: CarpetRollInput): CarpetRollResult {
  const {
    roomLengthMm,
    roomWidthMm,
    rollWidthMm,
    patternRepeatMm = 0,
    wastagePct      = 10,
  } = input;

  const warnings: string[] = [];

  // ── Drops (number of strips of roll across the room width) ───────────────
  const drops = Math.ceil(roomWidthMm / rollWidthMm);
  const seams = drops - 1;

  // ── Length per drop, with pattern repeat if applicable ───────────────────
  let dropLengthMm = roomLengthMm;
  if (patternRepeatMm > 0) {
    dropLengthMm = Math.ceil(roomLengthMm / patternRepeatMm) * patternRepeatMm;
  }

  // Total metres (all drops × length, plus wastage)
  const rawLengthM    = (drops * dropLengthMm) / 1000;
  const lengthM       = parseFloat((rawLengthM * (1 + wastagePct / 100)).toFixed(3));
  const areaSqft      = parseFloat(((roomLengthMm * roomWidthMm) / MM2_PER_SQFT).toFixed(3));

  if (seams > 0) {
    warnings.push(
      `${seams} seam${seams > 1 ? "s" : ""} required — confirm seam placement ` +
      `with client before installation.`,
    );
  }

  return {
    engineVersion: ENGINE_VERSION,
    mode:          "ROLL",
    drops,
    seams,
    lengthM,
    areaSqft,
    materialUnit:  "SQFT",
    warnings,
  };
}

function calcCarpetTile(input: CarpetTileInput): CarpetTileResult {
  const {
    roomLengthMm,
    roomWidthMm,
    tileSizeMm,
    tilesPerBox,
    wastagePct = 10,
  } = input;

  const warnings: string[] = [];
  const tileAreaMm2   = tileSizeMm * tileSizeMm;
  const tileAreaSqft  = tileAreaMm2 / MM2_PER_SQFT;
  const roomAreaSqft  = (roomLengthMm * roomWidthMm) / MM2_PER_SQFT;

  const tilesNeeded   = Math.ceil((roomAreaSqft / tileAreaSqft) * (1 + wastagePct / 100));
  const boxesRequired = Math.ceil(tilesNeeded / tilesPerBox);

  return {
    engineVersion: ENGINE_VERSION,
    mode:          "TILE",
    areaSqft:      parseFloat(roomAreaSqft.toFixed(3)),
    tilesNeeded,
    boxesRequired,
    materialUnit:  "BOX",
    warnings,
  };
}

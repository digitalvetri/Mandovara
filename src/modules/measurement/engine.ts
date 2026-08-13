// Family → calc kernel dispatch, plus mapping from kernel-result shape
// to CalcResult column shape (canonical schema).
//
// The kernel is the source of truth for the maths (§7). This file is a
// thin adapter: it fills in sensible defaults for on-site preview
// (before a Colourway is picked), calls the right kernel function, and
// maps the return into the columns the DB expects.
//
// Every result carries `engineVersion` from the kernel — a downstream
// change to a formula never silently re-prices a MeasurementItem that
// was captured before the change.

import {
  calcCurtain, calcWallpaper, calcFlooring, calcBlind, calcCarpet, calcFilm,
  type CurtainResult, type WallpaperResult, type FlooringResult,
  type BlindResult, type CarpetResult, type FilmResult,
} from "@/kernel/calc";
import type { AddItemInput, DeductionInput } from "./schema";

type EngineItemInput = Pick<
  AddItemInput,
  "family" | "widthMm" | "heightMm" | "quantity" | "deductions"
  | "headingType" | "fullness" | "layPattern" | "mountType"
>;

// The CalcResult column shape as we write it to the DB. Numbers are
// plain JS; the caller converts to Prisma.Decimal at persistence time.
export interface CalcResultRow {
  engineVersion:    string;
  materialQty:      number;
  materialUnit:     "METRE" | "ROLL" | "SQFT" | "SQM" | "PIECE" | "SET" | "BOX" | "RUNNING_FT";
  widthsRequired?:  number;
  cutLengthMm?:     number;
  rollsRequired?:   number;
  boxesRequired?:   number;
  areaSqft?:        number;
  billableAreaSqft?: number;
  wastagePct?:      number;
  fabricRun?:       "VERTICAL" | "RAILROADED";
  seamCount?:       number;
  liningQty?:       number;
  warnings:         string[];
  inputs:           Record<string, unknown>;
}

// Defaults sourced from CLAUDE.md §4. When a Colourway is later linked
// (Phase 3+), the engine reruns with that Colourway's real properties
// and the previous CalcResult is superseded (§6.2).
const DEFAULTS = {
  wallpaperRollWidthMm:   530,
  wallpaperRollLengthM:   10.05,
  wallpaperPatternMatch:  "FREE" as const,
  wallpaperPatternRepeat: 0,
  wallpaperWastagePct:    10,
  curtainFabricWidthMm:   1100,
  curtainPatternMatch:    "FREE" as const,
  curtainPatternRepeat:   0,
  curtainRailroadable:    false,
  flooringAreaPerBoxSqft: 22,   // ~2 sqm per box, typical laminate
  carpetRollWidthMm:      3660,
  carpetTileSizeMm:       500,
  carpetTilesPerBox:      20,   // 20 tiles at 500×500 = 5 sqm/box
  filmRollWidthMm:        1524,
  filmWastagePct:         8,
  blindMinChargeSqft:     10,   // default minimum billable per blind
};

/**
 * Compute a CalcResult row for the given measurement item. Pure: no
 * DB, no fetch. If the family has no calculator yet, returns a
 * zeroed row with a "no calculator" warning so the item is still
 * saveable — a site visit must never fail because a formula is
 * missing (§7 rule 4).
 */
export function computeCalcResult(item: EngineItemInput): CalcResultRow {
  const family = item.family;

  if (family === "CURTAIN_FABRIC" || family === "SHEER")     return fromCurtain(item);
  if (family === "WALLPAPER")                                return fromWallpaper(item);
  if (family === "FLOORING")                                 return fromFlooring(item);
  if (family === "BLIND")                                    return fromBlind(item);
  if (family === "CARPET_ROLL")                              return fromCarpetRoll(item);
  if (family === "CARPET_TILE")                              return fromCarpetTile(item);
  if (family === "INTERIOR_FILM")                            return fromFilm(item);

  return noEngineFallback(item);
}

// Client-callable alias — the field PWA reuses this for live preview
// (spec §5.3 <100ms budget).
export function computeCalcResultPreview(item: EngineItemInput): CalcResultRow {
  return computeCalcResult(item);
}

// ── Family adapters ────────────────────────────────────────────────

function fromCurtain(item: EngineItemInput): CalcResultRow {
  const inputs = {
    windowWidthMm:   item.widthMm,
    windowHeightMm:  item.heightMm,
    quantity:        item.quantity ?? 1,
    fullness:        item.fullness ?? 2.5,
    headingType:     item.headingType ?? "EYELET" as const,
    fabricWidthMm:   DEFAULTS.curtainFabricWidthMm,
    patternMatch:    DEFAULTS.curtainPatternMatch,
    patternRepeatMm: DEFAULTS.curtainPatternRepeat,
    railroadable:    DEFAULTS.curtainRailroadable,
  };
  const r: CurtainResult = calcCurtain(inputs);
  return {
    engineVersion: r.engineVersion,
    materialQty:   r.materialQty,
    materialUnit:  r.materialUnit,
    widthsRequired: r.widthsRequired,
    cutLengthMm:    r.cutLengthMm,
    ...(r.liningQty != null && { liningQty: r.liningQty }),
    fabricRun:      r.fabricRun,
    warnings:       withProvisionalNote(r.warnings),
    inputs:         { ...inputs, __defaults: ["fabricWidthMm", "patternRepeatMm", "railroadable"] },
  };
}

function fromWallpaper(item: EngineItemInput): CalcResultRow {
  const inputs = {
    wallWidthMm:     item.widthMm,
    wallHeightMm:    item.heightMm,
    deductions:      mapDeductions(item.deductions),
    rollWidthMm:     DEFAULTS.wallpaperRollWidthMm,
    rollLengthM:     DEFAULTS.wallpaperRollLengthM,
    patternRepeatMm: DEFAULTS.wallpaperPatternRepeat,
    patternMatch:    DEFAULTS.wallpaperPatternMatch,
    wastagePct:      DEFAULTS.wallpaperWastagePct,
  };
  const r: WallpaperResult = calcWallpaper(inputs);
  const qty = (item.quantity ?? 1) * r.rollsRequired;
  return {
    engineVersion: r.engineVersion,
    materialQty:   qty,
    materialUnit:  "ROLL",
    rollsRequired: qty,
    cutLengthMm:   r.cutLengthMm,
    areaSqft:      r.areaSqft * (item.quantity ?? 1),
    wastagePct:    DEFAULTS.wallpaperWastagePct,
    warnings:      withProvisionalNote(r.warnings),
    inputs:        { ...inputs, __defaults: ["rollWidthMm", "rollLengthM", "patternMatch", "wastagePct"] },
  };
}

function fromFlooring(item: EngineItemInput): CalcResultRow {
  const inputs = {
    roomLengthMm:   item.heightMm,   // treat height as the room's long axis
    roomWidthMm:    item.widthMm,
    layPattern:     item.layPattern ?? "STRAIGHT" as const,
    areaPerBoxSqft: DEFAULTS.flooringAreaPerBoxSqft,
  };
  const r: FlooringResult = calcFlooring(inputs);
  return {
    engineVersion: r.engineVersion,
    materialQty:   r.boxesRequired,
    materialUnit:  r.materialUnit,
    boxesRequired: r.boxesRequired,
    areaSqft:      r.areaSqft,
    wastagePct:    r.wastagePct,
    warnings:      withProvisionalNote(r.warnings),
    inputs:        { ...inputs, __defaults: ["areaPerBoxSqft"] },
  };
}

function fromBlind(item: EngineItemInput): CalcResultRow {
  const inputs = {
    widthMm:       item.widthMm,
    heightMm:      item.heightMm,
    quantity:      item.quantity ?? 1,
    mountType:     item.mountType ?? "INSIDE" as const,
    minChargeSqft: DEFAULTS.blindMinChargeSqft,
  };
  const r: BlindResult = calcBlind(inputs);
  return {
    engineVersion: r.engineVersion,
    materialQty:   r.billableAreaSqft,
    materialUnit:  r.materialUnit,
    areaSqft:      r.areaSqft,
    billableAreaSqft: r.billableAreaSqft,
    warnings:      r.warnings,
    inputs:        { ...inputs, __defaults: ["minChargeSqft"] },
  };
}

function fromCarpetRoll(item: EngineItemInput): CalcResultRow {
  const inputs = {
    mode:         "ROLL" as const,
    roomLengthMm: item.heightMm,
    roomWidthMm:  item.widthMm,
    rollWidthMm:  DEFAULTS.carpetRollWidthMm,
  };
  const r = calcCarpet(inputs) as Extract<CarpetResult, { mode: "ROLL" }>;
  return {
    engineVersion: r.engineVersion,
    materialQty:   r.lengthM,
    materialUnit:  "METRE",
    areaSqft:      r.areaSqft,
    seamCount:     r.seams,
    warnings:      withProvisionalNote(r.warnings),
    inputs:        { ...inputs, __defaults: ["rollWidthMm"] },
  };
}

function fromCarpetTile(item: EngineItemInput): CalcResultRow {
  const inputs = {
    mode:         "TILE" as const,
    roomLengthMm: item.heightMm,
    roomWidthMm:  item.widthMm,
    tileSizeMm:   DEFAULTS.carpetTileSizeMm,
    tilesPerBox:  DEFAULTS.carpetTilesPerBox,
  };
  const r = calcCarpet(inputs) as Extract<CarpetResult, { mode: "TILE" }>;
  return {
    engineVersion: r.engineVersion,
    materialQty:   r.boxesRequired,
    materialUnit:  r.materialUnit,
    boxesRequired: r.boxesRequired,
    areaSqft:      r.areaSqft,
    warnings:      withProvisionalNote(r.warnings),
    inputs:        { ...inputs, __defaults: ["tileSizeMm", "tilesPerBox"] },
  };
}

function fromFilm(item: EngineItemInput): CalcResultRow {
  const inputs = {
    surfaceWidthMm:  item.widthMm,
    surfaceHeightMm: item.heightMm,
    quantity:        item.quantity ?? 1,
    rollWidthMm:     DEFAULTS.filmRollWidthMm,
    wastagePct:      DEFAULTS.filmWastagePct,
  };
  const r: FilmResult = calcFilm(inputs);
  return {
    engineVersion: r.engineVersion,
    materialQty:   r.materialQty,
    materialUnit:  r.materialUnit,
    areaSqft:      r.areaSqft,
    cutLengthMm:   r.cutLengthMm,
    wastagePct:    DEFAULTS.filmWastagePct,
    warnings:      withProvisionalNote(r.warnings),
    inputs:        { ...inputs, __defaults: ["rollWidthMm", "wastagePct"] },
  };
}

function noEngineFallback(item: EngineItemInput): CalcResultRow {
  return {
    engineVersion: "no-engine@0.0.0",
    materialQty:   0,
    materialUnit:  "PIECE",
    warnings: [
      `No calculator available for ${item.family} yet — dimensions are captured but material quantity will be filled in at quotation time.`,
    ],
    inputs: {
      widthMm:  item.widthMm,
      heightMm: item.heightMm,
      quantity: item.quantity,
      family:   item.family,
    },
  };
}

// ── helpers ─────────────────────────────────────────────────────────

function mapDeductions(deductions?: DeductionInput[]): { label?: string; widthMm: number; heightMm: number; qty?: number }[] {
  if (!deductions) return [];
  return deductions.map((d) => ({
    label:    d.label,
    widthMm:  d.widthMm,
    heightMm: d.heightMm,
    qty:      d.qty,
  }));
}

function withProvisionalNote(warnings: readonly string[]): string[] {
  return [
    ...warnings,
    "Provisional — engine used default product properties. Final quantity will be re-computed once a colourway is chosen at quotation time.",
  ];
}

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

import type { AddItemInput } from "./schema";
import { fromBlind, fromCarpetRoll, fromCarpetTile, fromCurtain, fromFilm, fromFlooring, fromVerticalGarden, fromWallpaper, noEngineFallback } from "./engine-part2";

// Engine input requires dimensions; the schema-side widthMm/heightMm are
// now optional (owner redesign 2026-08-26 — office quick-add captures
// qty only), but `computeCalcResult` is only invoked when both are set
// so the engine surface can safely narrow them back to required.
export type EngineItemInput =
  Pick<AddItemInput, "family" | "quantity" | "deductions"
    | "headingType" | "fullness" | "layPattern" | "mountType">
  & { widthMm: number; heightMm: number };

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
export const DEFAULTS = {
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
  vgardenPanelSizeMm:     500,  // 500×500mm is the standard vertical-garden panel size
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
  if (family === "VERTICAL_GARDEN")                          return fromVerticalGarden(item);

  return noEngineFallback(item);
}

// Client-callable alias — the field PWA reuses this for live preview
// (spec §5.3 <100ms budget).

export * from "./engine-part2";

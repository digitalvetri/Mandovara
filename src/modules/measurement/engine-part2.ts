// Split out of engine.ts to stay under the §10 300-line limit.

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
  calcCurtain, calcWallpaper, calcFlooring, calcBlind, calcCarpet, calcFilm, calcVerticalGarden,
  type CurtainResult, type WallpaperResult, type FlooringResult,
  type BlindResult, type CarpetResult, type FilmResult, type VerticalGardenResult,
} from "@/kernel/calc";
import type { DeductionInput } from "./schema";
import { CalcResultRow, DEFAULTS, EngineItemInput, computeCalcResult } from "./engine";

export function computeCalcResultPreview(item: EngineItemInput): CalcResultRow {
  return computeCalcResult(item);
}

// ── Family adapters ────────────────────────────────────────────────

export function fromCurtain(item: EngineItemInput): CalcResultRow {
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

export function fromWallpaper(item: EngineItemInput): CalcResultRow {
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

export function fromFlooring(item: EngineItemInput): CalcResultRow {
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

export function fromBlind(item: EngineItemInput): CalcResultRow {
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

export function fromCarpetRoll(item: EngineItemInput): CalcResultRow {
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

export function fromCarpetTile(item: EngineItemInput): CalcResultRow {
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

export function fromFilm(item: EngineItemInput): CalcResultRow {
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

export function fromVerticalGarden(item: EngineItemInput): CalcResultRow {
  const panelSizeMm = DEFAULTS.vgardenPanelSizeMm;
  const inputs = {
    surfaceWidthMm:  item.widthMm,
    surfaceHeightMm: item.heightMm,
    panelWidthMm:    panelSizeMm,
    panelHeightMm:   panelSizeMm,
  };
  const r: VerticalGardenResult = calcVerticalGarden(inputs);
  return {
    engineVersion: r.engineVersion,
    materialQty:   r.areaSqft,
    materialUnit:  r.materialUnit,
    areaSqft:      r.areaSqft,
    warnings:      withProvisionalNote([
      ...r.warnings,
      `${r.panelsRequired} panels (${panelSizeMm}×${panelSizeMm}mm) · ${r.plantCount} plants · ${r.irrigationRft.toFixed(1)} rft irrigation.`,
    ]),
    inputs:        { ...inputs, __defaults: ["panelWidthMm", "panelHeightMm"] },
  };
}

export function noEngineFallback(item: EngineItemInput): CalcResultRow {
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

export function mapDeductions(deductions?: DeductionInput[]): { label?: string; widthMm: number; heightMm: number; qty?: number }[] {
  if (!deductions) return [];
  return deductions.map((d) => ({
    label:    d.label,
    widthMm:  d.widthMm,
    heightMm: d.heightMm,
    qty:      d.qty,
  }));
}

export function withProvisionalNote(warnings: readonly string[]): string[] {
  return [
    ...warnings,
    "Provisional — engine used default product properties. Final quantity will be re-computed once a colourway is chosen at quotation time.",
  ];
}

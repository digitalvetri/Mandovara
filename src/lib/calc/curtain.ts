// /lib/calc/curtain.ts — the curtain calculator, third file in the
// Measure & Material Engine (TRACK-B-CRAFT.md §4.3).
//
// The hardest of the three because it decides between two geometries:
//
//   VERTICAL RUN — fabric hung the "normal" way. Panels are cut side-by-
//     side across the fabric width; each panel is `fabricWidthMm` wide
//     and `cutLength` tall (drop + hem allowances, extended to a full
//     pattern repeat where applicable). Sewn together, hemmed at the
//     sides, hung on a track.
//
//   RAILROADED  — fabric turned 90°. The bolt's width becomes the
//     curtain's drop, and one long horizontal strip = the full required
//     width. Uses much less fabric when it's legal, but is only legal if
//     the pattern is FREE (repeats can't be turned sideways), the bolt is
//     marked railroadable, AND the drop-with-allowances fits inside the
//     bolt's width.
//
// When both are legal, compute both and pick the cheaper — emit a
// warning naming the metres saved so the estimator can explain the
// choice to Rohit's client on the printed quotation.
//
// Same rules as the sibling calculators:
//   - Pure function, no I/O.
//   - Versioned (curtain@1.0.0) so a sent quotation's frozen calcSnapshot
//     stays traceable to the exact formula that produced it.
//   - Warnings are plain English, rendered in the UI AND on the quote.
//   - 100% branch coverage is a blocking gate.

export const CURTAIN_ENGINE_VERSION = "curtain@1.0.0";

export type PatternMatch = "FREE" | "STRAIGHT" | "OFFSET";
export type HeadingType  =
  | "EYELET" | "PINCH_PLEAT" | "PENCIL_PLEAT"
  | "RIPPLE_FOLD" | "TAB_TOP" | "ROD_POCKET";

export interface CurtainInput {
  windowWidthMm:               number;
  windowHeightMm:              number;
  fullness:                    number;   // e.g. 2.5 for sheer / 2.0 for eyelet
  fabricWidthMm:               number;   // narrow bolt used in the vertical run
  patternMatch:                PatternMatch;
  patternRepeatMm:             number;   // 0 when FREE
  railroadable?:               boolean;  // is a wider bolt available?
  railroadedFabricWidthMm?:    number;   // required if railroadable
  headingType?:                HeadingType;
  headingAllowanceMm?:         number;   // default 150
  bottomHemMm?:                number;   // default 150
  sideHemMm?:                  number;   // default   0
  eyeletSpacingMm?:            number;   // default 150 (used only for EYELET)
  liningRequired?:             boolean;
}

export interface CurtainResult {
  engineVersion:               string;
  fabricRun:                  "VERTICAL" | "RAILROADED";
  panels?:                     number;   // set for VERTICAL
  cutLengthMm?:                number;   // set for VERTICAL
  fabricMetres:                number;
  liningMetres?:               number;
  eyeletCountPerPanel?:        number;
  warnings:                    string[];
}

// Defaults — will move to Organization.settings once that surface exists.
export const DEFAULT_HEADING_ALLOWANCE_MM = 150;
export const DEFAULT_BOTTOM_HEM_MM        = 150;
export const DEFAULT_SIDE_HEM_MM          =   0;
export const DEFAULT_EYELET_SPACING_MM    = 150;

export function calcCurtain(input: CurtainInput): CurtainResult {
  assertPositive("windowWidthMm",  input.windowWidthMm);
  assertPositive("windowHeightMm", input.windowHeightMm);
  assertPositive("fullness",       input.fullness);
  assertPositive("fabricWidthMm",  input.fabricWidthMm);

  if (input.patternMatch !== "FREE" && !(input.patternRepeatMm > 0)) {
    throw new Error(
      `calcCurtain: patternMatch=${input.patternMatch} requires patternRepeatMm > 0`,
    );
  }
  if (input.railroadable === true && !(input.railroadedFabricWidthMm != null && input.railroadedFabricWidthMm > 0)) {
    throw new Error(
      "calcCurtain: railroadable=true requires a positive railroadedFabricWidthMm",
    );
  }

  const warnings:          string[] = [];
  const headingAllowance = input.headingAllowanceMm ?? DEFAULT_HEADING_ALLOWANCE_MM;
  const bottomHem        = input.bottomHemMm        ?? DEFAULT_BOTTOM_HEM_MM;
  const sideHem          = input.sideHemMm          ?? DEFAULT_SIDE_HEM_MM;

  const requiredWidthMm = input.windowWidthMm * input.fullness;
  const rawCutMm        = input.windowHeightMm + headingAllowance + bottomHem;

  // ── VERTICAL run ────────────────────────────────────────────────
  const vertical = computeVertical(input, requiredWidthMm, rawCutMm, sideHem, warnings);

  // ── RAILROADED run (only if legal) ──────────────────────────────
  const railroaded = maybeComputeRailroaded(input, requiredWidthMm, rawCutMm, sideHem);

  // ── DECISION: pick the cheaper, warn about the saving ───────────
  let fabricRun: "VERTICAL" | "RAILROADED" = "VERTICAL";
  let fabricMetres = vertical.fabricMetres;

  if (railroaded && railroaded.fabricMetres < vertical.fabricMetres) {
    const saving = vertical.fabricMetres - railroaded.fabricMetres;
    warnings.push(
      `Railroading saves ${saving.toFixed(1)}m of fabric — order the wide bolt.`,
    );
    fabricRun    = "RAILROADED";
    fabricMetres = railroaded.fabricMetres;
  }

  // ── EYELETS (only when the heading calls for them) ──────────────
  let eyeletCountPerPanel: number | undefined;
  if (input.headingType === "EYELET") {
    const spacing = input.eyeletSpacingMm ?? DEFAULT_EYELET_SPACING_MM;
    assertPositive("eyeletSpacingMm", spacing);
    const raw = Math.round(input.fabricWidthMm / spacing);
    eyeletCountPerPanel = raw % 2 === 0 ? raw : raw + 1;
  }

  // ── LINING (same panels, cut without pattern repeat) ────────────
  let liningMetres: number | undefined;
  if (input.liningRequired === true) {
    liningMetres = (vertical.panels * rawCutMm) / 1000;
  }

  // In VERTICAL mode we expose panels + cutLength so the make module
  // can generate a cut list; in RAILROADED mode neither is meaningful,
  // so we leave them undefined.
  if (fabricRun === "VERTICAL") {
    return {
      engineVersion: CURTAIN_ENGINE_VERSION,
      fabricRun,
      panels: vertical.panels,
      cutLengthMm: vertical.cutLengthMm,
      fabricMetres,
      ...(liningMetres != null      && { liningMetres }),
      ...(eyeletCountPerPanel != null && { eyeletCountPerPanel }),
      warnings,
    };
  }
  return {
    engineVersion: CURTAIN_ENGINE_VERSION,
    fabricRun,
    fabricMetres,
    ...(liningMetres != null      && { liningMetres }),
    ...(eyeletCountPerPanel != null && { eyeletCountPerPanel }),
    warnings,
  };
}

// ── VERTICAL run helpers ──────────────────────────────────────────
interface VerticalRun {
  panels:       number;
  cutLengthMm:  number;
  fabricMetres: number;
}

function computeVertical(
  input:            CurtainInput,
  requiredWidthMm:  number,
  rawCutMm:         number,
  sideHem:          number,
  warnings:         string[],
): VerticalRun {
  const panels = Math.ceil((requiredWidthMm + sideHem * 2) / input.fabricWidthMm);

  let cutLengthMm: number;
  if (input.patternMatch === "FREE") {
    cutLengthMm = rawCutMm;
  } else {
    const repeat = input.patternRepeatMm;
    cutLengthMm = Math.ceil(rawCutMm / repeat) * repeat;
    if (repeat > rawCutMm) {
      warnings.push(
        `Pattern repeat (${repeat}mm) is larger than the drop (${rawCutMm}mm) — each panel wastes ${cutLengthMm - rawCutMm}mm.`,
      );
    }
  }

  const fabricMetres = (panels * cutLengthMm) / 1000;
  return { panels, cutLengthMm, fabricMetres };
}

// ── RAILROADED run helpers ────────────────────────────────────────
interface RailroadedRun {
  fabricMetres: number;
}

function maybeComputeRailroaded(
  input:            CurtainInput,
  requiredWidthMm:  number,
  rawCutMm:         number,
  sideHem:          number,
): RailroadedRun | null {
  if (input.railroadable !== true)     return null;   // no wide bolt available
  if (input.patternMatch !== "FREE")   return null;   // repeats can't be turned sideways
  const wide = input.railroadedFabricWidthMm as number;   // validated above
  if (rawCutMm > wide)                 return null;   // drop won't fit in the bolt

  const fabricMetres = (requiredWidthMm + sideHem * 2) / 1000;
  return { fabricMetres };
}

function assertPositive(name: string, v: number): void {
  if (!(v > 0)) {
    throw new Error(`calcCurtain: ${name} must be > 0, got ${v}`);
  }
}

// Curtain material calculator — §7.1.
// Pure: no I/O, no side-effects. Versioned so CalcResult.engineVersion is meaningful.

import type { PatternMatch, FabricRun, HeadingType } from "./types";

export interface CurtainInput {
  windowWidthMm:       number;
  windowHeightMm:      number;
  quantity:            number;
  fullness:            number;           // e.g. 2.5
  headingType:         HeadingType;
  fabricWidthMm:       number;           // 1100 (standard) or 2800 (wide/railroaded)
  patternRepeatMm:     number;           // 0 = no repeat (treated as FREE)
  patternMatch:        PatternMatch;
  railroadable:        boolean;          // design can run horizontally
  // ── allowances (mm), all optional, defaults from §4
  overlapMm?:           number;          // centre overlap, default 0
  sideHemMm?:           number;          // per side, default 40
  headingAllowanceMm?:  number;          // default 150
  bottomHemMm?:         number;          // default 150 (total heading+bottom = 300mm)
  eyeletSpacingMm?:     number;          // default 160
  liningRequired?:      boolean;
}

export interface CurtainResult {
  readonly engineVersion: "curtain@1.2.0";
  materialQty:    number;   // metres of main fabric, all quantities combined
  materialUnit:   "METRE";
  widthsRequired: number;   // fabric widths (drops) per quantity unit
  cutLengthMm:    number;   // pattern-adjusted cut length per drop
  liningQty:      number | null;  // metres, null if not required
  fabricRun:      FabricRun;
  eyeletCount:    number | null;  // per panel (per width), rounded to even, or null
  warnings:       string[];
}

const ENGINE_VERSION = "curtain@1.2.0" as const;

export function calcCurtain(input: CurtainInput): CurtainResult {
  const {
    windowWidthMm,
    windowHeightMm,
    quantity,
    fullness,
    headingType,
    fabricWidthMm,
    patternRepeatMm,
    patternMatch,
    railroadable,
    overlapMm           = 0,
    sideHemMm           = 40,
    headingAllowanceMm  = 150,
    bottomHemMm         = 150,
    eyeletSpacingMm     = 160,
    liningRequired      = false,
  } = input;

  const warnings: string[] = [];

  // ── Track and required width ──────────────────────────────────────────────
  const trackWidth    = windowWidthMm + overlapMm;
  const requiredWidth = trackWidth * fullness;

  // ── VERTICAL RUN ─────────────────────────────────────────────────────────
  const widthsRequired = Math.ceil(
    (requiredWidth + sideHemMm * 2) / fabricWidthMm,
  );
  const rawCutLength = windowHeightMm + headingAllowanceMm + bottomHemMm;

  let cutLengthMm = rawCutLength;
  if (patternRepeatMm > 0) {
    if (patternRepeatMm > rawCutLength) {
      // Pattern repeat is larger than the whole drop — can't usefully round up,
      // use one full repeat as minimum and warn loudly.
      warnings.push(
        `Pattern repeat (${patternRepeatMm}mm) exceeds drop (${rawCutLength}mm). ` +
        `Using one repeat as cut length. Significant fabric waste expected.`,
      );
      cutLengthMm = patternRepeatMm;
    } else {
      cutLengthMm = Math.ceil(rawCutLength / patternRepeatMm) * patternRepeatMm;
    }
  }

  const verticalMetres = (widthsRequired * cutLengthMm * quantity) / 1000;

  // ── RAILROADED RUN ────────────────────────────────────────────────────────
  // Possible only when: FREE match + railroadable + drop fits within fabric width.
  const dropWithAllowances = windowHeightMm + headingAllowanceMm + bottomHemMm;
  const canRailroad =
    patternMatch === "FREE" &&
    railroadable &&
    dropWithAllowances <= fabricWidthMm;

  let chosenRun: FabricRun = "VERTICAL";
  let fabricMetres = verticalMetres;

  if (canRailroad) {
    const railroadedfabricMetres = ((requiredWidth + sideHemMm * 2) * quantity) / 1000;
    if (railroadedfabricMetres <= verticalMetres) {
      const saving = (verticalMetres - railroadedfabricMetres).toFixed(1);
      if (railroadedfabricMetres < verticalMetres) {
        warnings.push(
          `Railroading saves ${saving}m of fabric vs vertical run — using railroaded.`,
        );
      } else {
        warnings.push("Railroading is equivalent to vertical run — using railroaded.");
      }
      chosenRun = "RAILROADED";
      fabricMetres = railroadedfabricMetres;
    }
  }

  // ── LINING ────────────────────────────────────────────────────────────────
  let liningQty: number | null = null;
  if (liningRequired) {
    // Same widths; rawCutLength (no pattern repeat applied to lining).
    liningQty = parseFloat(
      ((widthsRequired * rawCutLength * quantity) / 1000).toFixed(3),
    );
  }

  // ── EYELETS ───────────────────────────────────────────────────────────────
  let eyeletCount: number | null = null;
  if (headingType === "EYELET") {
    const raw = Math.round(requiredWidth / eyeletSpacingMm);
    eyeletCount = raw % 2 === 0 ? raw : raw + 1; // rounded to even
  }

  return {
    engineVersion:  ENGINE_VERSION,
    materialQty:    parseFloat(fabricMetres.toFixed(3)),
    materialUnit:   "METRE",
    widthsRequired,
    cutLengthMm,
    liningQty,
    fabricRun:      chosenRun,
    eyeletCount,
    warnings,
  };
}

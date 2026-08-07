// /lib/calc/wallpaper.ts — the wallpaper calculator, part of the
// Measure & Material Engine (TRACK-B-CRAFT.md §4.1).
//
// Rules honoured:
//   - Pure function, no I/O.
//   - Versioned. Every result carries WALLPAPER_ENGINE_VERSION so a sent
//     quotation's frozen calcSnapshot can be traced back to the exact
//     formula that produced it.
//   - Warnings are plain English, meant to render in the UI AND print on
//     the quotation's notes for Rohit's client to read.
//   - 100% branch coverage is a blocking gate — see the sibling test file.
//
// Constants (fullness, wastage, threshold) will move to
// Organization.settings once that surface exists. For now they are
// exported so callers can override for tests and so a code-review can
// see them in one place.

export const WALLPAPER_ENGINE_VERSION = "wallpaper@1.0.0";

export type PatternMatch = "FREE" | "STRAIGHT" | "OFFSET";

export interface WallpaperDeduction {
  widthMm:  number;
  heightMm: number;
  label:    string;
}

export interface WallpaperInput {
  wallWidthMm:      number;
  wallHeightMm:     number;
  rollWidthMm:      number;
  rollLengthM:      number;
  patternMatch:     PatternMatch;
  patternRepeatMm:  number;        // 0 when FREE
  deductions:       readonly WallpaperDeduction[];
}

export interface WallpaperResult {
  engineVersion:        string;
  patternMatchApplied:  PatternMatch;  // may differ from input when a fallback fires
  cutLengthMm:          number;
  stripsPerRoll:        number;
  stripsNeeded:         number;
  rollsRequired:        number;
  warnings:             string[];
}

// Threshold below which an opening is ignored (see §4.1). One and a half
// square metres is the industry rule of thumb — smaller and the strip
// above/below the opening still has to be cut, so no material is saved.
const MIN_DEDUCTIBLE_M2 = 1.5;
const MM2_PER_M2 = 1_000_000;

export function calcWallpaper(input: WallpaperInput): WallpaperResult {
  assertPositive("wallWidthMm",  input.wallWidthMm);
  assertPositive("wallHeightMm", input.wallHeightMm);
  assertPositive("rollWidthMm",  input.rollWidthMm);
  assertPositive("rollLengthM",  input.rollLengthM);

  if (input.patternMatch !== "FREE" && !(input.patternRepeatMm > 0)) {
    throw new Error(
      `calcWallpaper: patternMatch=${input.patternMatch} requires patternRepeatMm > 0`,
    );
  }

  const warnings: string[] = [];

  // ── 1. Effective pattern-match, with the "repeat > wall height" fallback.
  //    A repeat taller than the wall degenerates to FREE — pattern alignment
  //    across strips becomes irrelevant when a single repeat already covers
  //    the whole drop. Warn so the estimator sees why match-cost disappeared.
  let patternMatchApplied: PatternMatch = input.patternMatch;
  if (patternMatchApplied !== "FREE" && input.patternRepeatMm > input.wallHeightMm) {
    warnings.push(
      `Pattern repeat (${input.patternRepeatMm}mm) is taller than the wall (${input.wallHeightMm}mm) — treated as free-match.`,
    );
    patternMatchApplied = "FREE";
  }

  // ── 2. Cut length per strip.
  //    NOTE (offset formula): TRACK-B-CRAFT.md §4.1 prints the OFFSET
  //    formula as `ceil((h + repeat/2) / repeat) × repeat`, which yields
  //    3200mm for the canonical 2700mm / 640mm-repeat case. The same section's
  //    test row demands 3520mm — that only holds if the extra half-repeat is
  //    added AFTER rounding up: `ceil(h / repeat) × repeat + repeat/2`.
  //    The test row is the acceptance criterion so we implement to match it.
  //    Flag this in code review if the spec formula ever gets amended.
  const repeat = input.patternRepeatMm;
  let cutLengthMm: number;
  switch (patternMatchApplied) {
    case "FREE":
      cutLengthMm = input.wallHeightMm;
      break;
    case "STRAIGHT":
      cutLengthMm = Math.ceil(input.wallHeightMm / repeat) * repeat;
      break;
    case "OFFSET":
      cutLengthMm = Math.ceil(input.wallHeightMm / repeat) * repeat + repeat / 2;
      break;
  }

  // ── 3. Sanity — a strip must fit in the roll at all.
  const rollLengthMm = input.rollLengthM * 1000;
  if (cutLengthMm > rollLengthMm) {
    throw new Error(
      `calcWallpaper: required cut length ${cutLengthMm}mm exceeds roll length ${rollLengthMm}mm — no strip can be cut.`,
    );
  }

  // ── 4. Strips per roll and strips needed for the wall.
  const stripsPerRoll = Math.floor(rollLengthMm / cutLengthMm);
  let stripsNeeded    = Math.ceil(input.wallWidthMm / input.rollWidthMm);

  // ── 5. Deductions. A door/window is only deducted when it can genuinely
  //    skip whole strip(s): it must exceed the area threshold AND span the
  //    full wall height AND be at least one roll-width wide. Anything else
  //    still needs strips above/below/around it, so no material is saved.
  for (const d of input.deductions) {
    const areaM2 = (d.widthMm * d.heightMm) / MM2_PER_M2;
    const spansFullHeight = d.heightMm >= input.wallHeightMm;
    const wideEnough      = d.widthMm  >= input.rollWidthMm;

    if (areaM2 > MIN_DEDUCTIBLE_M2 && spansFullHeight && wideEnough) {
      const skip = Math.floor(d.widthMm / input.rollWidthMm);
      stripsNeeded = Math.max(0, stripsNeeded - skip);
    } else {
      const why = areaM2 <= MIN_DEDUCTIBLE_M2
        ? `area ${areaM2.toFixed(2)} m² is below the 1.5 m² threshold`
        : !spansFullHeight
        ? "does not span the full wall height (strips above/below still needed)"
        : "narrower than one roll width (no full strip can be skipped)";
      warnings.push(`Opening "${d.label}" not deducted — ${why}.`);
    }
  }

  // ── 6. Rolls.
  const rollsRequired = Math.ceil(stripsNeeded / stripsPerRoll);

  // ── 7. Cost-of-match warning: any OFFSET run buys at least one extra
  //    roll vs. the equivalent free-match. Compute the free-match rolls
  //    and if we are paying more, tell the client.
  if (patternMatchApplied === "OFFSET") {
    const freeStripsPerRoll = Math.floor(rollLengthMm / input.wallHeightMm);
    const freeRolls = Math.ceil(stripsNeeded / freeStripsPerRoll);
    const extra    = rollsRequired - freeRolls;
    if (extra >= 1) {
      warnings.push(
        `Half-drop match adds ${extra} roll${extra > 1 ? "s" : ""} versus a free match.`,
      );
    }
  }

  return {
    engineVersion: WALLPAPER_ENGINE_VERSION,
    patternMatchApplied,
    cutLengthMm,
    stripsPerRoll,
    stripsNeeded,
    rollsRequired,
    warnings,
  };
}

function assertPositive(name: string, v: number): void {
  if (!(v > 0)) {
    throw new Error(`calcWallpaper: ${name} must be > 0, got ${v}`);
  }
}

// Wallpaper roll calculator — §7.2.
// Pure: no I/O, no side-effects.
//
// This is the ONLY wallpaper calculator in the codebase (§15.2). It absorbed
// the former /lib/calc/wallpaper.ts, which shipped a second, divergent
// implementation behind the on-site estimator panel.
//
// OFFSET (half-drop) formula — resolving a contradiction in §7.2:
//   The prose prints `ceil((h + repeat/2) / repeat) × repeat`, which for the
//   canonical 2700mm wall / 640mm repeat yields 3200mm — identical to a
//   STRAIGHT match, so the section's own "half-drop match adds 1 roll"
//   warning could never fire.
//   The section's acceptance row demands cut 3520mm, 2 strips/roll, 4 rolls,
//   which holds only when the half-repeat is added AFTER rounding up:
//   `ceil(h / repeat) × repeat + repeat/2`.
//   The acceptance row and the warning narrative agree with each other, so
//   that is what we implement. Recorded in docs/DECISIONS.md.
//   NOTE: §7.2's worked examples assume wastagePct = 0; wastage is a separate
//   step applied after the strip count.

import type { Deduction, PatternMatch } from "./types";

export interface WallpaperInput {
  wallWidthMm:      number;
  wallHeightMm:     number;
  deductions?:      Deduction[];  // door/window openings
  rollWidthMm:      number;       // typically 530
  rollLengthM:      number;       // typically 10.05
  patternRepeatMm:  number;       // 0 = FREE
  patternMatch:     PatternMatch;
  wastagePct:       number;       // e.g. 10 for 10 %
}

export interface WallpaperResult {
  readonly engineVersion: "wallpaper@2.0.0";
  patternMatchApplied: PatternMatch;  // may differ from input when the fallback fires
  rollsRequired:  number;
  stripsPerRoll:  number;
  stripsNeeded:   number;
  cutLengthMm:    number;
  areaSqft:       number;
  warnings:       string[];
}

const ENGINE_VERSION    = "wallpaper@2.0.0" as const;
const SQM_PER_SQFT      = 0.09290304;  // 1 sqft in m²
const MM2_PER_M2        = 1_000_000;
const MIN_DEDUCTIBLE_M2 = 1.5;

function assertPositive(name: string, v: number): void {
  if (!(v > 0)) throw new Error(`calcWallpaper: ${name} must be > 0, got ${v}`);
}

export function calcWallpaper(input: WallpaperInput): WallpaperResult {
  const {
    wallWidthMm,
    wallHeightMm,
    deductions = [],
    rollWidthMm,
    rollLengthM,
    patternRepeatMm,
    patternMatch,
    wastagePct,
  } = input;

  assertPositive("wallWidthMm",  wallWidthMm);
  assertPositive("wallHeightMm", wallHeightMm);
  assertPositive("rollWidthMm",  rollWidthMm);
  assertPositive("rollLengthM",  rollLengthM);
  if (patternMatch !== "FREE" && !(patternRepeatMm > 0)) {
    throw new Error(
      `calcWallpaper: patternMatch=${patternMatch} requires patternRepeatMm > 0`,
    );
  }

  const warnings: string[] = [];

  // ── Effective pattern match ───────────────────────────────────────────────
  // A repeat taller than the wall degenerates to FREE: a single repeat already
  // covers the whole drop, so there is nothing to align between strips.
  let patternMatchApplied: PatternMatch = patternMatch;
  if (patternMatchApplied !== "FREE" && patternRepeatMm > wallHeightMm) {
    warnings.push(
      `Pattern repeat (${patternRepeatMm}mm) is taller than the wall ` +
      `(${wallHeightMm}mm) — treated as free-match.`,
    );
    patternMatchApplied = "FREE";
  }

  // ── Cut length per strip ──────────────────────────────────────────────────
  let cutLengthMm: number;
  switch (patternMatchApplied) {
    case "STRAIGHT":
      cutLengthMm = Math.ceil(wallHeightMm / patternRepeatMm) * patternRepeatMm;
      break;
    case "OFFSET":
      cutLengthMm =
        Math.ceil(wallHeightMm / patternRepeatMm) * patternRepeatMm +
        patternRepeatMm / 2;
      warnings.push(
        `Half-drop match (${patternRepeatMm}mm repeat): cut length extended to ` +
        `${cutLengthMm}mm to allow for offset alignment.`,
      );
      break;
    default:
      cutLengthMm = wallHeightMm;
  }

  // ── A strip must physically fit in the roll ───────────────────────────────
  const rollLengthMm = rollLengthM * 1000;
  if (cutLengthMm > rollLengthMm) {
    throw new Error(
      `calcWallpaper: required cut length ${cutLengthMm}mm exceeds roll length ` +
      `${rollLengthMm}mm — no strip can be cut.`,
    );
  }

  const stripsPerRoll = Math.floor(rollLengthMm / cutLengthMm);
  const stripsNeeded  = Math.ceil(wallWidthMm / rollWidthMm);

  // ── Deductions ────────────────────────────────────────────────────────────
  // An opening only saves material when it can skip whole strip(s): it must
  // clear the area threshold AND span the full wall height AND be at least one
  // roll-width wide. Anything else still needs strips above/below/around it.
  let deductedStrips = 0;
  for (const d of deductions) {
    const qty             = d.qty ?? 1;
    const areaM2          = (d.widthMm * d.heightMm) / MM2_PER_M2;
    const spansFullHeight = d.heightMm >= wallHeightMm;
    const wideEnough      = d.widthMm  >= rollWidthMm;

    if (areaM2 > MIN_DEDUCTIBLE_M2 && spansFullHeight && wideEnough) {
      deductedStrips += Math.floor(d.widthMm / rollWidthMm) * qty;
    } else {
      const why = areaM2 <= MIN_DEDUCTIBLE_M2
        ? `area ${areaM2.toFixed(2)} m² is below the 1.5 m² threshold`
        : !spansFullHeight
          ? "does not span the full wall height (strips above/below still needed)"
          : "narrower than one roll width (no full strip can be skipped)";
      warnings.push(
        `Opening "${d.label ?? "unnamed"}" not deducted — ${why}; ` +
        `partial strips cannot be reused.`,
      );
    }
  }
  const effectiveStrips = Math.max(stripsNeeded - deductedStrips, 0);

  // ── Wastage, then whole rolls ─────────────────────────────────────────────
  const stripsWithWastage = Math.ceil(effectiveStrips * (1 + wastagePct / 100));
  const rollsRequired     = Math.ceil(stripsWithWastage / stripsPerRoll);

  // ── Cost-of-match warning ─────────────────────────────────────────────────
  // Compare against the same wall run as a free match, wastage included, so
  // the client sees what the pattern actually costs them.
  if (patternMatchApplied !== "FREE") {
    const freeStripsPerRoll = Math.floor(rollLengthMm / wallHeightMm);
    const freeRolls         = Math.ceil(stripsWithWastage / freeStripsPerRoll);
    const extra             = rollsRequired - freeRolls;
    if (extra >= 1) {
      const label = patternMatchApplied === "OFFSET" ? "Half-drop match" : "Straight repeat";
      warnings.push(
        `${label} adds ${extra} roll${extra > 1 ? "s" : ""} versus a free match.`,
      );
    }
  }

  const areaSqft = parseFloat(
    ((wallWidthMm * wallHeightMm) / (SQM_PER_SQFT * MM2_PER_M2)).toFixed(3),
  );

  return {
    engineVersion: ENGINE_VERSION,
    patternMatchApplied,
    rollsRequired,
    stripsPerRoll,
    stripsNeeded,
    cutLengthMm,
    areaSqft,
    warnings,
  };
}

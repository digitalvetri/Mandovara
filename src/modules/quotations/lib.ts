import type { ProductFamily } from "@prisma/client";

// Made-to-measure families (§1.1, CLAUDE.md).
// Every quotation line for these families MUST carry a measurementItemId (§0.10 / §15.1).
// Supporting families — hardware, accessories, service — may be quoted without measurement.
export const MADE_TO_MEASURE_FAMILIES: ReadonlySet<ProductFamily> = new Set<ProductFamily>([
  "CURTAIN_FABRIC",
  "SHEER",
  "LINING",
  "BLIND",
  "WALLPAPER",
  "FLOORING",
  "CARPET_ROLL",
  "CARPET_TILE",
  "UPHOLSTERY_FABRIC",
  "VERTICAL_GARDEN",
  "INTERIOR_FILM",
  "MURAL",
]);

// ── §0.10 / §15.1 measurement gate ──────────────────────────────────────────
// The single implementation of non-negotiable #1: no made-to-measure
// quotation line may exist without a linked MeasurementItem. It applies to
// EVERY quotation path — new, revision, and quick — and to lead-scoped
// quotes as well as client-scoped ones. A lead has no Project and therefore
// no measurement round, so a made-to-measure line against a lead is refused
// outright and the user is told to convert the lead first.

export interface GateLine {
  colourwayId?:       string | null;
  measurementItemId?: string | null;
}

export interface GateViolation {
  index:   number;
  family:  ProductFamily;
  /** Plain-English next action, safe to show in a field error. */
  message: string;
}

/**
 * Returns the first line that breaches the gate, or null when all lines pass.
 *
 * @param familyOf  resolves a colourwayId to its ProductFamily; return
 *                  undefined for an unknown colourway (the caller reports
 *                  that separately as a validation error).
 * @param opts.isLeadScoped  changes only the wording of the next action.
 * @param opts.labelOf       optional human label (design name) for the message.
 */
export function findMeasurementGateViolation(
  lines: readonly GateLine[],
  familyOf: (colourwayId: string) => ProductFamily | undefined,
  opts: { isLeadScoped: boolean; labelOf?: (colourwayId: string) => string | undefined },
): GateViolation | null {
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    if (line.measurementItemId) continue;
    if (!line.colourwayId) continue;

    const family = familyOf(line.colourwayId);
    if (!family || !MADE_TO_MEASURE_FAMILIES.has(family)) continue;

    const label = opts.labelOf?.(line.colourwayId) ?? family;
    const message = opts.isLeadScoped
      ? `${label} is made-to-measure (${family}). Convert this lead to a client ` +
        `so a measurement round can be captured, or quote only hardware, motor, ` +
        `accessory and service lines against a lead.`
      : `${label} is made-to-measure (${family}) — a measurement item must be ` +
        `linked before quoting.`;

    return { index, family, message };
  }
  return null;
}

// Shared Zod → ActionResult mapper. Lives here rather than in either action
// file so both can use it after actions.ts was split for the §10 line limit.
export function zodError<T>(err: import("zod").ZodError): {
  ok: false; error: string; fieldErrors: Record<string, string>; data?: T;
} {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    fieldErrors[issue.path.map(String).join(".")] = issue.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}

// ── Estimate vs quotation ───────────────────────────────────────────────────
// A quotation is an ESTIMATE when nothing on it came from a site measurement.
// Derived rather than stored: a stored flag would drift the moment a line was
// added or relinked, and this is exactly the question a reader cares about.
//
// §15.1 still blocks a CATALOG made-to-measure line without a MeasurementItem.
// This covers the other case — a free-text ballpark for a website enquiry,
// which is legitimate but must never be mistaken for a measured quote (§1.2:
// Mandovara loses money exactly when someone quotes before measuring).
export function isEstimate(lines: readonly { measurementItemId?: string | null }[]): boolean {
  return lines.length > 0 && lines.every((l) => !l.measurementItemId);
}

export const ESTIMATE_CAVEAT =
  "Indicative only. Final quantities and price are confirmed after site measurement.";

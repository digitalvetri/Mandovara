// Pure milestone-template merge + weight normalization.
//
// Given the set of ProductFamily values present on a project, merge the
// common spine (family = null) with each family's specific templates,
// dedupe by `code` (never duplicate SITE_VISIT even if three families
// declare it), sort by `sequence`, then renormalise `billingWeightPct`
// so the merged set sums to 100.
//
// Callable from server actions (project creation, family-added event) or
// from a re-generation task. No I/O — the DB layer feeds it templates
// and consumes MergedMilestone rows.
//
// See docs/BUILD-SPEC.md — project detail redesign §3.

export interface TemplateRow {
  readonly family: string | null; // ProductFamily or null (common spine)
  readonly sequence: number;
  readonly code: string;
  readonly name: string;
  readonly billingWeightPct: number;
  readonly autoCompleteOn: string | null;
}

export interface MergedMilestone {
  readonly code: string;
  readonly name: string;
  readonly sequence: number;
  /** null on the common spine, otherwise the first family that contributed it. */
  readonly family: string | null;
  /** Weight after renormalisation. Sums to 100 across the returned array. */
  readonly billingWeightPct: number;
  /** Raw weight from the template row, pre-normalisation — kept for audit. */
  readonly rawWeightPct: number;
  readonly autoCompleteOn: string | null;
}

/**
 * Merge templates for a given set of families and renormalise weights to 100.
 *
 * Rules:
 *  1. Common spine (family = null) is always included.
 *  2. For each family in `families`, include its templates.
 *  3. Dedupe by `code`. The first winning row is: common if present,
 *     otherwise the earliest family in `families` iteration order.
 *  4. Sort by `sequence`, then by `code` for stable ordering.
 *  5. Renormalise `billingWeightPct` so the total is exactly 100
 *     (last row absorbs any rounding remainder — no float drift on the sum).
 *
 * A project with no families still gets the common spine and normalises
 * across it (SITE_VISIT / MEASUREMENT / QUOTATION are 0 %, so the three
 * weighted rows — ADVANCE 40, INSTALLATION 30, HANDOVER 10 — become
 * 50/37.5/12.5 after normalization).
 */
export function mergeMilestoneTemplates(
  allTemplates: readonly TemplateRow[],
  families: readonly string[],
): MergedMilestone[] {
  const familySet = new Set<string>(families);
  const seen = new Map<string, MergedMilestone>();

  // Common spine first — wins on `code` collisions with family-specific templates.
  for (const t of allTemplates) {
    if (t.family !== null) continue;
    if (seen.has(t.code)) continue;
    seen.set(t.code, {
      code:             t.code,
      name:             t.name,
      sequence:         t.sequence,
      family:           null,
      billingWeightPct: t.billingWeightPct,
      rawWeightPct:     t.billingWeightPct,
      autoCompleteOn:   t.autoCompleteOn,
    });
  }

  // Then family-specific templates in the caller's iteration order.
  for (const family of families) {
    for (const t of allTemplates) {
      if (t.family !== family) continue;
      if (seen.has(t.code)) continue; // dedupe by code across families
      seen.set(t.code, {
        code:             t.code,
        name:             t.name,
        sequence:         t.sequence,
        family,
        billingWeightPct: t.billingWeightPct,
        rawWeightPct:     t.billingWeightPct,
        autoCompleteOn:   t.autoCompleteOn,
      });
    }
  }

  // Drop family-specific templates whose family isn't in the project set —
  // guards against a common-code family template accidentally leaking in.
  const merged = Array.from(seen.values()).filter(
    (m) => m.family === null || familySet.has(m.family),
  );

  merged.sort((a, b) => a.sequence - b.sequence || a.code.localeCompare(b.code));

  // Renormalise. If the raw sum is 0 (nothing weighted — should not happen
  // once ADVANCE/INSTALLATION/HANDOVER exist, but guard anyway), leave
  // weights at 0 rather than divide by zero.
  const rawTotal = merged.reduce((s, m) => s + m.rawWeightPct, 0);
  if (rawTotal === 0) return merged;

  const scaled = merged.map((m) => ({
    ...m,
    // Round to 2 dp; final row absorbs the remainder below.
    billingWeightPct: Math.round((m.rawWeightPct / rawTotal) * 100 * 100) / 100,
  }));

  const scaledTotal = scaled.reduce((s, m) => s + m.billingWeightPct, 0);
  const remainder = Math.round((100 - scaledTotal) * 100) / 100;
  if (remainder !== 0) {
    // Add the remainder to the last row that has a non-zero weight; if
    // every weight is zero we already returned above.
    for (let i = scaled.length - 1; i >= 0; i--) {
      const row = scaled[i];
      if (row && row.billingWeightPct > 0) {
        scaled[i] = { ...row, billingWeightPct: Math.round((row.billingWeightPct + remainder) * 100) / 100 };
        break;
      }
    }
  }

  return scaled;
}

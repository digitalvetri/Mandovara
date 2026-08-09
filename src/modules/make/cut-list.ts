// §15 rule 6 / §14 Phase 5 gate — the cut list for a make job is
// MATERIALISED from the frozen OrderLine.calcSnapshot, never
// re-derived by re-running the engine. If curtain@1.1.0 lands after a
// quote is sent, the tailor still cuts to what the client agreed to;
// the shop floor doesn't learn about the engine bump until the next
// order.
//
// The action layer (createMakeJobFromOrder) loads OrderLine + the
// measurement it links to; this file is a pure shape-mapper so the
// identity is trivially unit-testable without a DB.

// The snapshot shape written by modules/quotations/calc-snapshot.ts,
// then copied verbatim onto OrderLine.calcSnapshot at conversion time.
// Kept as `unknown` on the wire and narrowed here so the builder is
// resilient to schema drift — an unrecognised outputs blob is
// treated as "no cut-list-relevant data" and quietly skipped.
export interface OrderLineForCutList {
  orderLineId:       string;
  measurementItemId: string | null;
  calcSnapshot:      unknown | null;
  roomLabel:         string;              // from MeasurementItem, or a fallback
}

export interface CutListEntry {
  orderLineId:       string;
  measurementItemId: string | null;
  roomLabel:         string;
  panels:            number | null;
  cutLengthMm:       number | null;
  liningIssuedM:     number | null;
  eyeletCount:       number | null;
  headingType:       string | null;
}

interface CurtainOutputs {
  panels?:              unknown;
  cutLengthMm?:         unknown;
  liningMetres?:        unknown;
  eyeletCountPerPanel?: unknown;
}

// Returns exactly one entry per line that has a usable snapshot.
// Non-M2M lines (hardware, paint, sundries) simply don't produce a
// cut-list row — the caller inserts everything returned here and
// nothing else.
export function buildCutList(lines: readonly OrderLineForCutList[]): CutListEntry[] {
  const out: CutListEntry[] = [];
  for (const line of lines) {
    const outputs = extractOutputs(line.calcSnapshot);
    if (outputs == null) continue;

    // Curtain is the only family with cut-list-relevant outputs today
    // (wallpaper produces rolls, flooring produces boxes — those go on
    // a different sheet). Skip any line whose outputs don't carry the
    // curtain shape rather than silently emit a stub row.
    const panels      = numberOrNull(outputs.panels);
    const cutLengthMm = numberOrNull(outputs.cutLengthMm);
    if (panels == null && cutLengthMm == null) continue;

    out.push({
      orderLineId:       line.orderLineId,
      measurementItemId: line.measurementItemId,
      roomLabel:         line.roomLabel,
      panels,
      cutLengthMm,
      liningIssuedM:     numberOrNull(outputs.liningMetres),
      eyeletCount:       numberOrNull(outputs.eyeletCountPerPanel),
      headingType:       null,
    });
  }
  return out;
}

// ── helpers ──────────────────────────────────────────────────────

function extractOutputs(snapshot: unknown): CurtainOutputs | null {
  if (snapshot == null || typeof snapshot !== "object") return null;
  const s = snapshot as { outputs?: unknown };
  if (s.outputs == null || typeof s.outputs !== "object") return null;
  return s.outputs as CurtainOutputs;
}

function numberOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

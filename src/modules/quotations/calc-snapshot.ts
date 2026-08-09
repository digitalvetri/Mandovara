// §7 rule 4 / §15 non-negotiable #3 — freezing a CalcResult onto a
// QuotationLine at SEND time. Kept pure so the freeze rule can be
// unit-tested without a DB. `setQuotationStatus` loads the raw rows and
// hands them here; this module owns the snapshot *shape* so future
// callers (Order freeze, historical re-export) can reuse it.

export interface FreezeLine {
  id:                string;
  measurementItemId: string | null;
}
export interface FreezeCalc {
  measurementItemId: string;
  engineVersion:     string;
  family:            string;
  inputs:            unknown;
  outputs:           unknown;
  warnings:          readonly string[];
  computedAt:        Date;
}

// The JSON we persist into QuotationLine.calcSnapshot. Include a
// frozenAt so downstream readers know when the snapshot was taken —
// distinct from the CalcResult.computedAt (which is when the engine ran).
// Version-tag the shape so a later evolution can be migrated.
export interface CalcSnapshotV1 {
  v:                 1;
  engineVersion:     string;
  family:            string;
  inputs:            unknown;
  outputs:           unknown;
  warnings:          readonly string[];
  computedAt:        string;    // ISO
  frozenAt:          string;    // ISO
  measurementItemId: string;
}

export interface FreezeInstruction {
  lineId:   string;
  snapshot: CalcSnapshotV1;
}

// Returns exactly one FreezeInstruction per line that BOTH references a
// measurement AND has a CalcResult for it. Lines without either are
// silently skipped — they aren't made-to-measure, so there's nothing to
// freeze. The §0.10 gate is enforced at create time, not here.
export function buildCalcSnapshots(args: {
  lines: readonly FreezeLine[];
  calcs: ReadonlyMap<string, FreezeCalc>;   // keyed by measurementItemId
  now:   Date;
}): FreezeInstruction[] {
  const out: FreezeInstruction[] = [];
  const frozenAt = args.now.toISOString();
  for (const line of args.lines) {
    if (!line.measurementItemId) continue;
    const calc = args.calcs.get(line.measurementItemId);
    if (!calc) continue;   // no CalcResult yet — nothing to freeze
    out.push({
      lineId: line.id,
      snapshot: {
        v: 1,
        engineVersion:     calc.engineVersion,
        family:            calc.family,
        inputs:            calc.inputs,
        outputs:           calc.outputs,
        warnings:          calc.warnings,
        computedAt:        calc.computedAt.toISOString(),
        frozenAt,
        measurementItemId: calc.measurementItemId,
      },
    });
  }
  return out;
}

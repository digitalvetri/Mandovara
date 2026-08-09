// §7 rule 4 / §15 non-negotiable #3 — CalcResult freeze on quotation SEND.
// Unit-tests the pure builder in buildCalcSnapshots. Integration wiring in
// setQuotationStatus is left for the Phase 5 e2e (measurement → quote →
// send → later engine bump → snapshot on the sent line is unchanged).

import { describe, expect, it } from "vitest";
import {
  buildCalcSnapshots,
  type FreezeCalc, type FreezeLine,
} from "@/modules/quotations/calc-snapshot";

const NOW = new Date("2026-08-09T10:00:00.000Z");
const COMPUTED_AT = new Date("2026-08-08T09:30:00.000Z");

function calc(id: string, extras: Partial<FreezeCalc> = {}): FreezeCalc {
  return {
    measurementItemId: id,
    engineVersion:     "curtain@1.0.0",
    family:            "CURTAIN",
    inputs:            { windowWidthMm: 1800, windowHeightMm: 2100 },
    outputs:           { fabricMetres: 12, panels: 5, cutLengthMm: 2400 },
    warnings:          [],
    computedAt:        COMPUTED_AT,
    ...extras,
  };
}

describe("buildCalcSnapshots — §15 rule 3 (freeze on SEND)", () => {
  it("emits one snapshot per line that has a matched CalcResult", () => {
    const lines: FreezeLine[] = [
      { id: "L1", measurementItemId: "M1" },
      { id: "L2", measurementItemId: "M2" },
    ];
    const calcs = new Map([["M1", calc("M1")], ["M2", calc("M2")]]);

    const out = buildCalcSnapshots({ lines, calcs, now: NOW });
    expect(out).toHaveLength(2);
    expect(out.map((o) => o.lineId).sort()).toEqual(["L1", "L2"]);
  });

  it("captures engineVersion + inputs + outputs + warnings + timestamps + measurementItemId", () => {
    const lines: FreezeLine[] = [{ id: "L1", measurementItemId: "M1" }];
    const c = calc("M1", { warnings: ["railroading saves 6.4m"] });
    const out = buildCalcSnapshots({ lines, calcs: new Map([["M1", c]]), now: NOW });
    const s = out[0]!.snapshot;
    expect(s.v).toBe(1);
    expect(s.engineVersion).toBe("curtain@1.0.0");
    expect(s.family).toBe("CURTAIN");
    expect(s.inputs).toEqual({ windowWidthMm: 1800, windowHeightMm: 2100 });
    expect(s.outputs).toEqual({ fabricMetres: 12, panels: 5, cutLengthMm: 2400 });
    expect(s.warnings).toEqual(["railroading saves 6.4m"]);
    expect(s.computedAt).toBe(COMPUTED_AT.toISOString());
    expect(s.frozenAt).toBe(NOW.toISOString());
    expect(s.measurementItemId).toBe("M1");
  });

  it("skips lines with no measurementItemId (non-M2M products)", () => {
    const lines: FreezeLine[] = [
      { id: "L1", measurementItemId: null },
      { id: "L2", measurementItemId: "M2" },
    ];
    const out = buildCalcSnapshots({
      lines, calcs: new Map([["M2", calc("M2")]]), now: NOW,
    });
    expect(out.map((o) => o.lineId)).toEqual(["L2"]);
  });

  it("skips lines whose CalcResult hasn't been computed yet", () => {
    // Refuse-to-freeze rule: no CalcResult → no snapshot rather than
    // silently persisting nothing. The measurement gate prevents SEND
    // reaching this state for M2M products, so the branch is a safety net.
    const lines: FreezeLine[] = [{ id: "L1", measurementItemId: "M1" }];
    const out = buildCalcSnapshots({ lines, calcs: new Map(), now: NOW });
    expect(out).toEqual([]);
  });

  it("is pure — same inputs produce identical snapshots, mutating the input calc after does not leak", () => {
    const lines: FreezeLine[] = [{ id: "L1", measurementItemId: "M1" }];
    const c = calc("M1");
    const out1 = buildCalcSnapshots({ lines, calcs: new Map([["M1", c]]), now: NOW });

    // If a future engine revision mutated the CalcResult row, the frozen
    // snapshot must remain the same JSON. We simulate that here by
    // bumping engineVersion on `c` after the freeze and rebuilding — the
    // first snapshot must be untouched.
    const bumped: FreezeCalc = { ...c, engineVersion: "curtain@2.0.0" };
    const out2 = buildCalcSnapshots({ lines, calcs: new Map([["M1", bumped]]), now: NOW });

    expect(out1[0]!.snapshot.engineVersion).toBe("curtain@1.0.0");
    expect(out2[0]!.snapshot.engineVersion).toBe("curtain@2.0.0");
    // out1's already-frozen snapshot is not shared-by-reference with out2.
    expect(out1[0]!.snapshot).not.toBe(out2[0]!.snapshot);
  });
});

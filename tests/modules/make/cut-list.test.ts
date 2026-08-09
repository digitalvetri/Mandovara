// §14 Phase 5 gate — the cut list produced from a frozen calcSnapshot
// carries the SAME panels + cutLengthMm the engine originally emitted
// for the same measurement. Proven twice here: once by feeding the
// engine's real output through buildCutList, once by feeding a hand-
// written v1 snapshot (proves resilience to future engine bumps that
// leave the outputs shape stable).

import { describe, expect, it } from "vitest";
import { calcCurtain } from "@/lib/calc/curtain";
import {
  buildCutList, type OrderLineForCutList,
} from "@/modules/make/cut-list";

// The reference measurement used across Phase 3 (smoke-quote-freeze)
// and Phase 5 (smoke-cut-list-identity). Locking the same fixture
// everywhere is how we prove the identity is transitive.
const CURTAIN_INPUT = {
  windowWidthMm:   1800,
  windowHeightMm:  2100,
  fullness:        2.5,
  fabricWidthMm:   1100,
  patternMatch:    "FREE" as const,
  patternRepeatMm: 0,
};
const EXPECTED_PANELS       = 5;
const EXPECTED_CUT_LENGTH_MM = 2400;

function snapshotFromEngine(): unknown {
  const r = calcCurtain(CURTAIN_INPUT);
  // Shape mirrors modules/quotations/calc-snapshot.CalcSnapshotV1
  // (the shape actually written to QuotationLine.calcSnapshot).
  return {
    v: 1,
    engineVersion:     r.engineVersion,
    family:            "CURTAIN",
    inputs:            CURTAIN_INPUT,
    outputs: {
      fabricRun:    r.fabricRun,
      fabricMetres: r.fabricMetres,
      ...(r.panels        != null && { panels:        r.panels        }),
      ...(r.cutLengthMm   != null && { cutLengthMm:   r.cutLengthMm   }),
      ...(r.liningMetres  != null && { liningMetres:  r.liningMetres  }),
    },
    warnings:          r.warnings,
    computedAt:        "2026-08-01T00:00:00.000Z",
    frozenAt:          "2026-08-01T00:00:00.000Z",
    measurementItemId: "mea-1",
  };
}

describe("buildCutList — §14 Phase 5 identity", () => {
  it("copies panels + cutLengthMm from the engine output verbatim", () => {
    const line: OrderLineForCutList = {
      orderLineId:       "L1",
      measurementItemId: "mea-1",
      calcSnapshot:      snapshotFromEngine(),
      roomLabel:         "Living — East window",
    };
    const rows = buildCutList([line]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.panels).toBe(EXPECTED_PANELS);
    expect(rows[0]!.cutLengthMm).toBe(EXPECTED_CUT_LENGTH_MM);
    expect(rows[0]!.orderLineId).toBe("L1");
    expect(rows[0]!.measurementItemId).toBe("mea-1");
    expect(rows[0]!.roomLabel).toBe("Living — East window");
  });

  it("reads a hand-crafted v1 snapshot the same way (engine-independent)", () => {
    const snap = {
      v: 1, engineVersion: "curtain@99.0.0",
      family: "CURTAIN",
      outputs: {
        panels:              EXPECTED_PANELS,
        cutLengthMm:         EXPECTED_CUT_LENGTH_MM,
        liningMetres:        4.8,
        eyeletCountPerPanel: 8,
        fabricRun:           "VERTICAL",
        fabricMetres:        12,
      },
    };
    const rows = buildCutList([{
      orderLineId: "L1", measurementItemId: "mea-1",
      calcSnapshot: snap, roomLabel: "Master Bedroom",
    }]);
    expect(rows[0]!.panels).toBe(EXPECTED_PANELS);
    expect(rows[0]!.cutLengthMm).toBe(EXPECTED_CUT_LENGTH_MM);
    expect(rows[0]!.liningIssuedM).toBe(4.8);
    expect(rows[0]!.eyeletCount).toBe(8);
  });

  it("skips lines with no snapshot (non-M2M SKUs like paint or hardware)", () => {
    const rows = buildCutList([
      { orderLineId: "L-paint", measurementItemId: null, calcSnapshot: null, roomLabel: "-" },
      { orderLineId: "L-curtain", measurementItemId: "mea-1",
        calcSnapshot: snapshotFromEngine(), roomLabel: "Bay window" },
    ]);
    expect(rows.map((r) => r.orderLineId)).toEqual(["L-curtain"]);
  });

  it("skips a curtain snapshot in RAILROADED mode (no panels/cutLength)", () => {
    // Railroaded outputs deliberately omit panels + cutLengthMm because
    // the tailor sews one long horizontal strip. There's no cut list to
    // materialise — the make step for railroaded goods is different
    // work, tracked elsewhere. Skipping keeps the identity honest.
    const snap = {
      v: 1, engineVersion: "curtain@1.0.0", family: "CURTAIN",
      outputs: { fabricRun: "RAILROADED", fabricMetres: 5.2 },
    };
    const rows = buildCutList([{
      orderLineId: "L1", measurementItemId: "mea-1",
      calcSnapshot: snap, roomLabel: "Wide bay",
    }]);
    expect(rows).toEqual([]);
  });

  it("tolerates a snapshot with a garbage outputs blob (no crash, no row)", () => {
    // Defence against a future engine bump that renames the outputs
    // key or wraps them differently. Rather than throw and block a
    // valid job from being minted, we skip the offender.
    const rows = buildCutList([
      { orderLineId: "L1", measurementItemId: "mea-1",
        calcSnapshot: { v: 1, outputs: "not an object" }, roomLabel: "-" },
      { orderLineId: "L2", measurementItemId: null,
        calcSnapshot: "just a string", roomLabel: "-" },
      { orderLineId: "L3", measurementItemId: null, calcSnapshot: 42, roomLabel: "-" },
    ]);
    expect(rows).toEqual([]);
  });

  it("preserves input order (make-job line numbers follow order-line order)", () => {
    const lines: OrderLineForCutList[] = ["A", "B", "C"].map((n) => ({
      orderLineId:       `L-${n}`,
      measurementItemId: `mea-${n}`,
      calcSnapshot:      snapshotFromEngine(),
      roomLabel:         `Room ${n}`,
    }));
    const rows = buildCutList(lines);
    expect(rows.map((r) => r.orderLineId)).toEqual(["L-A", "L-B", "L-C"]);
  });
});

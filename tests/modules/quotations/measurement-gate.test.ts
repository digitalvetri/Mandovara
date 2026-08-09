// §0.10 gate — pure-function unit tests. Covers the three branches the
// server action delegates to enforceMeasurementGate():
//   1. Made-to-measure product with no measurementItemId → blocked.
//   2. Measurement belonging to another client → blocked.
//   3. Non-M2M product OR M2M product with a valid same-client measurement → passes.

import { describe, expect, it } from "vitest";
import {
  enforceMeasurementGate,
  type GateLine, type GateProduct, type GateMeasurement,
} from "@/modules/quotations/measurement-gate";

const CLIENT   = "client-current";
const M2M      = { id: "prod-curtain",   name: "Silk Curtain",   requiresMeasurement: true  } as const;
const NON_M2M  = { id: "prod-cushion",   name: "Cushion Cover",  requiresMeasurement: false } as const;

function productMap(...ps: GateProduct[]): ReadonlyMap<string, GateProduct> {
  return new Map(ps.map((p) => [p.id, p]));
}
function measurementMap(...ms: GateMeasurement[]): ReadonlyMap<string, GateMeasurement> {
  return new Map(ms.map((m) => [m.id, m]));
}

describe("enforceMeasurementGate — §0.10", () => {
  it("blocks a made-to-measure line with no measurementItemId", () => {
    const lines: GateLine[] = [{ productId: M2M.id }];
    const res = enforceMeasurementGate({
      clientId:    CLIENT,
      lines,
      products:    productMap(M2M),
      measurements: measurementMap(),
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toContain("Measurement required");
    expect(res.fieldErrors["lines.0.measurementItemId"]).toMatch(/made-to-measure/i);
  });

  it("blocks a measurement that belongs to a different client", () => {
    const foreign: GateMeasurement = { id: "mea-other", clientId: "client-other" };
    const lines: GateLine[] = [{ productId: M2M.id, measurementItemId: foreign.id }];
    const res = enforceMeasurementGate({
      clientId:    CLIENT,
      lines,
      products:    productMap(M2M),
      measurements: measurementMap(foreign),
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/different client/i);
    expect(res.fieldErrors["lines.0.measurementItemId"]).toMatch(/another client/i);
  });

  it("blocks an unknown measurement id (never loaded from the DB)", () => {
    const lines: GateLine[] = [{ productId: M2M.id, measurementItemId: "mea-nope" }];
    const res = enforceMeasurementGate({
      clientId:    CLIENT,
      lines,
      products:    productMap(M2M),
      measurements: measurementMap(),   // empty — id didn't resolve
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/not found/i);
    expect(res.fieldErrors["lines.0.measurementItemId"]).toMatch(/not found|outside this org/i);
  });

  it("passes a non-M2M line without any measurement", () => {
    const lines: GateLine[] = [{ productId: NON_M2M.id }];
    const res = enforceMeasurementGate({
      clientId:    CLIENT,
      lines,
      products:    productMap(NON_M2M),
      measurements: measurementMap(),
    });
    expect(res.ok).toBe(true);
  });

  it("passes an M2M line with a same-client measurement", () => {
    const ok: GateMeasurement = { id: "mea-ok", clientId: CLIENT };
    const lines: GateLine[] = [{ productId: M2M.id, measurementItemId: ok.id }];
    const res = enforceMeasurementGate({
      clientId:    CLIENT,
      lines,
      products:    productMap(M2M),
      measurements: measurementMap(ok),
    });
    expect(res.ok).toBe(true);
  });

  it("reports the FIRST offending line index, not last", () => {
    // 3 lines: [ok, missing-M2M, missing-M2M]. Error should point at index 1.
    const okM: GateMeasurement = { id: "mea-ok", clientId: CLIENT };
    const lines: GateLine[] = [
      { productId: NON_M2M.id },
      { productId: M2M.id },                    // ← first failure here
      { productId: M2M.id },
    ];
    const res = enforceMeasurementGate({
      clientId:    CLIENT,
      lines,
      products:    productMap(NON_M2M, M2M),
      measurements: measurementMap(okM),
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.fieldErrors["lines.1.measurementItemId"]).toBeTruthy();
    expect(res.fieldErrors["lines.2.measurementItemId"]).toBeUndefined();
  });

  it("passes an empty line list (nothing to gate)", () => {
    const res = enforceMeasurementGate({
      clientId:    CLIENT,
      lines:       [],
      products:    productMap(),
      measurements: measurementMap(),
    });
    expect(res.ok).toBe(true);
  });
});

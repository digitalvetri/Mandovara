// §0.10 gate — pure validator, extracted so we can unit-test it without
// standing up the full createQuotation transaction. The action calls this
// with data it has already loaded from the DB; the helper only compares
// what's in front of it and returns either OK or the exact fieldErrors
// shape ActionResult carries.
//
// Kept intentionally allocation-free and dependency-free so the same
// function can eventually be reused by e.g. an OrderLine gate (§8) or an
// import-time validator.

export interface GateProduct {
  id: string;
  name: string;
  requiresMeasurement: boolean;
}

export interface GateMeasurement {
  id: string;
  clientId: string;         // via measurement.project.clientId
}

export interface GateLine {
  productId: string;
  measurementItemId?: string | undefined;
}

export type GateResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors: Record<string, string> };

export function enforceMeasurementGate(args: {
  clientId:     string;
  lines:        readonly GateLine[];
  products:     ReadonlyMap<string, GateProduct>;
  measurements: ReadonlyMap<string, GateMeasurement>;
}): GateResult {
  const { clientId, lines, products, measurements } = args;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const product = products.get(line.productId);
    if (!product) continue;   // caller runs its own "unknown product" check

    if (product.requiresMeasurement && !line.measurementItemId) {
      return {
        ok: false, error: "Measurement required (§0.10)",
        fieldErrors: {
          [`lines.${i}.measurementItemId`]:
            `${product.name} is made-to-measure — link a site measurement before quoting`,
        },
      };
    }
    if (line.measurementItemId) {
      const m = measurements.get(line.measurementItemId);
      if (!m) {
        return {
          ok: false, error: "Measurement not found",
          fieldErrors: {
            [`lines.${i}.measurementItemId`]: "Measurement not found or outside this org",
          },
        };
      }
      if (m.clientId !== clientId) {
        return {
          ok: false, error: "Measurement belongs to a different client",
          fieldErrors: {
            [`lines.${i}.measurementItemId`]:
              "This measurement is from another client's project — pick one from the current client's job",
          },
        };
      }
    }
  }
  return { ok: true };
}

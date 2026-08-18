// §0.10 / §15.1 — no made-to-measure quotation line without a linked
// MeasurementItem.
//
// SCOPE: enforced on EVERY quotation path — new, revision and quick — and for
// lead-scoped quotes as well as client-scoped ones. §15.1 states the rule with
// no exception. A lead has no Project and therefore no measurement round, so a
// made-to-measure line against a bare lead is refused and the user is told to
// convert the lead first.

import { describe, it, expect } from "vitest";
import type { ProductFamily } from "@prisma/client";
import {
  findMeasurementGateViolation,
  MADE_TO_MEASURE_FAMILIES,
} from "@/modules/quotations/lib";

const FAMILIES: Record<string, ProductFamily> = {
  wallpaper: "WALLPAPER",
  curtain:   "CURTAIN_FABRIC",
  blind:     "BLIND",
  mural:     "MURAL",
  track:     "HARDWARE_TRACK",
  motor:     "MOTOR",
  service:   "SERVICE",
  accessory: "ACCESSORY",
};
const familyOf = (id: string): ProductFamily | undefined => FAMILIES[id];

describe("§15.1 measurement gate", () => {
  describe("client-scoped quotes", () => {
    it("blocks a made-to-measure line with no measurement item", () => {
      const v = findMeasurementGateViolation(
        [{ colourwayId: "wallpaper" }],
        familyOf,
        { isLeadScoped: false },
      );
      expect(v).not.toBeNull();
      expect(v!.family).toBe("WALLPAPER");
      expect(v!.index).toBe(0);
      expect(v!.message).toMatch(/measurement item must be linked/i);
    });

    it("allows a made-to-measure line that carries a measurement item", () => {
      expect(findMeasurementGateViolation(
        [{ colourwayId: "wallpaper", measurementItemId: "mi_1" }],
        familyOf,
        { isLeadScoped: false },
      )).toBeNull();
    });

    it("allows supporting families with no measurement", () => {
      expect(findMeasurementGateViolation(
        [{ colourwayId: "track" }, { colourwayId: "motor" },
         { colourwayId: "service" }, { colourwayId: "accessory" }],
        familyOf,
        { isLeadScoped: false },
      )).toBeNull();
    });
  });

  describe("lead-scoped quotes", () => {
    it("blocks wallpaper against a bare lead and names the next action", () => {
      const v = findMeasurementGateViolation(
        [{ colourwayId: "wallpaper" }],
        familyOf,
        { isLeadScoped: true },
      );
      expect(v).not.toBeNull();
      expect(v!.message).toMatch(/convert this lead to a client/i);
    });

    it("blocks every made-to-measure family against a lead", () => {
      for (const family of MADE_TO_MEASURE_FAMILIES) {
        const v = findMeasurementGateViolation(
          [{ colourwayId: "x" }],
          () => family,
          { isLeadScoped: true },
        );
        expect(v, `${family} must be gated`).not.toBeNull();
      }
    });

    it("still allows hardware and service against a lead", () => {
      expect(findMeasurementGateViolation(
        [{ colourwayId: "track" }, { colourwayId: "service" }],
        familyOf,
        { isLeadScoped: true },
      )).toBeNull();
    });
  });

  describe("reporting", () => {
    it("reports the FIRST offending line index", () => {
      const v = findMeasurementGateViolation(
        [{ colourwayId: "track" }, { colourwayId: "service" }, { colourwayId: "blind" }],
        familyOf,
        { isLeadScoped: false },
      );
      expect(v!.index).toBe(2);
      expect(v!.family).toBe("BLIND");
    });

    it("uses the design label in the message when supplied", () => {
      const v = findMeasurementGateViolation(
        [{ colourwayId: "curtain" }],
        familyOf,
        { isLeadScoped: true, labelOf: () => "Serene Silk — Pearl Grey" },
      );
      expect(v!.message).toContain("Serene Silk — Pearl Grey");
    });

    it("ignores service lines that carry no colourway at all", () => {
      expect(findMeasurementGateViolation(
        [{ description: "Site survey charge" } as never],
        familyOf,
        { isLeadScoped: false },
      )).toBeNull();
    });

    it("defers unknown colourways to the caller's own validation", () => {
      expect(findMeasurementGateViolation(
        [{ colourwayId: "does-not-exist" }],
        familyOf,
        { isLeadScoped: false },
      )).toBeNull();
    });
  });

  it("the made-to-measure set matches §1.1's nine product families", () => {
    // Sanity: the families Mandovara actually cuts to size must all be gated.
    for (const f of ["CURTAIN_FABRIC", "SHEER", "BLIND", "WALLPAPER", "FLOORING",
                     "CARPET_ROLL", "CARPET_TILE", "UPHOLSTERY_FABRIC",
                     "VERTICAL_GARDEN", "INTERIOR_FILM", "MURAL"] as ProductFamily[]) {
      expect(MADE_TO_MEASURE_FAMILIES.has(f), `${f} must be made-to-measure`).toBe(true);
    }
    // ...and the supporting families must not be, or a lead could never be quoted.
    for (const f of ["HARDWARE_TRACK", "HARDWARE_ROD", "MOTOR", "ACCESSORY",
                     "SERVICE", "FOAM_FILLING"] as ProductFamily[]) {
      expect(MADE_TO_MEASURE_FAMILIES.has(f), `${f} must NOT be made-to-measure`).toBe(false);
    }
  });
});

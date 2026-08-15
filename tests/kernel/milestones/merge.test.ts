import { describe, expect, it } from "vitest";
import { mergeMilestoneTemplates, type TemplateRow } from "@/kernel/milestones/merge";

// ─── Fixture: the same template set the seed writes (docs/BUILD-SPEC.md §3) ─
const TEMPLATES: readonly TemplateRow[] = [
  // common spine
  { family: null, sequence: 10, code: "SITE_VISIT",   name: "Site visit",    billingWeightPct: 0,  autoCompleteOn: "siteVisit.completed" },
  { family: null, sequence: 20, code: "MEASUREMENT",  name: "Measurement",   billingWeightPct: 0,  autoCompleteOn: "measurement.approved" },
  { family: null, sequence: 30, code: "QUOTATION",    name: "Quotation",     billingWeightPct: 0,  autoCompleteOn: "quotation.accepted" },
  { family: null, sequence: 40, code: "ADVANCE",      name: "Advance",       billingWeightPct: 40, autoCompleteOn: "advance.received" },
  { family: null, sequence: 50, code: "PROCUREMENT",  name: "Procurement",   billingWeightPct: 0,  autoCompleteOn: "allocation.complete" },
  { family: null, sequence: 80, code: "INSTALLATION", name: "Installation",  billingWeightPct: 30, autoCompleteOn: "installVisit.completed" },
  { family: null, sequence: 90, code: "HANDOVER",     name: "Handover",      billingWeightPct: 10, autoCompleteOn: null },

  // curtains + sheer
  { family: "CURTAIN_FABRIC", sequence: 60, code: "FABRIC_INWARD",  name: "Fabric inward",  billingWeightPct: 0,  autoCompleteOn: "grn.received" },
  { family: "CURTAIN_FABRIC", sequence: 70, code: "CUT_AND_STITCH", name: "Cut & stitch",   billingWeightPct: 20, autoCompleteOn: "makeJob.qcPassed" },
  { family: "SHEER",          sequence: 60, code: "FABRIC_INWARD",  name: "Fabric inward",  billingWeightPct: 0,  autoCompleteOn: "grn.received" },
  { family: "SHEER",          sequence: 70, code: "CUT_AND_STITCH", name: "Cut & stitch",   billingWeightPct: 20, autoCompleteOn: "makeJob.qcPassed" },

  // wallpaper
  { family: "WALLPAPER", sequence: 60, code: "ROLL_INWARD", name: "Roll inward (dye lot)", billingWeightPct: 0, autoCompleteOn: "grn.received" },

  // flooring
  { family: "FLOORING", sequence: 15, code: "SUBFLOOR_CHECK",  name: "Subfloor check",  billingWeightPct: 0, autoCompleteOn: null },
  { family: "FLOORING", sequence: 60, code: "MATERIAL_INWARD", name: "Material inward", billingWeightPct: 0, autoCompleteOn: "grn.received" },
];

function sum(arr: readonly { billingWeightPct: number }[]): number {
  return Math.round(arr.reduce((s, m) => s + m.billingWeightPct, 0) * 100) / 100;
}

describe("mergeMilestoneTemplates", () => {
  describe("wallpaper-only project", () => {
    const merged = mergeMilestoneTemplates(TEMPLATES, ["WALLPAPER"]);

    it("returns common spine + one wallpaper template = 8 milestones", () => {
      expect(merged).toHaveLength(8);
      expect(merged.map((m) => m.code)).toEqual([
        "SITE_VISIT", "MEASUREMENT", "QUOTATION", "ADVANCE", "PROCUREMENT",
        "ROLL_INWARD", "INSTALLATION", "HANDOVER",
      ]);
    });

    it("orders strictly by template sequence", () => {
      const seqs = merged.map((m) => m.sequence);
      expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    });

    it("normalises billing weights to exactly 100", () => {
      expect(sum(merged)).toBe(100);
    });

    it("keeps proportion of the raw weights (40 / 30 / 10 → 50 / 37.5 / 12.5)", () => {
      const byCode = new Map(merged.map((m) => [m.code, m]));
      expect(byCode.get("ADVANCE")?.billingWeightPct).toBe(50);
      expect(byCode.get("INSTALLATION")?.billingWeightPct).toBe(37.5);
      expect(byCode.get("HANDOVER")?.billingWeightPct).toBe(12.5);
    });

    it("zero-weight milestones stay at zero after normalisation", () => {
      const zeros = merged.filter((m) => m.rawWeightPct === 0);
      for (const m of zeros) expect(m.billingWeightPct).toBe(0);
    });
  });

  describe("adding curtains to a wallpaper project", () => {
    const before = mergeMilestoneTemplates(TEMPLATES, ["WALLPAPER"]);
    const after  = mergeMilestoneTemplates(TEMPLATES, ["WALLPAPER", "CURTAIN_FABRIC"]);

    it("merges CUT_AND_STITCH + FABRIC_INWARD in", () => {
      const codes = after.map((m) => m.code);
      expect(codes).toContain("CUT_AND_STITCH");
      expect(codes).toContain("FABRIC_INWARD");
    });

    it("does not duplicate the shared spine (SITE_VISIT once, not twice)", () => {
      const siteVisitCount = after.filter((m) => m.code === "SITE_VISIT").length;
      expect(siteVisitCount).toBe(1);
    });

    it("renormalises to 100 after the merge", () => {
      expect(sum(before)).toBe(100);
      expect(sum(after)).toBe(100);
    });

    it("adds a new weighted milestone → other weights shrink proportionally", () => {
      const advanceBefore = before.find((m) => m.code === "ADVANCE")?.billingWeightPct ?? 0;
      const advanceAfter  = after.find((m) => m.code === "ADVANCE")?.billingWeightPct ?? 0;
      expect(advanceAfter).toBeLessThan(advanceBefore);
    });
  });

  describe("multi-family without duplication", () => {
    const merged = mergeMilestoneTemplates(TEMPLATES, ["CURTAIN_FABRIC", "SHEER"]);

    it("shares FABRIC_INWARD + CUT_AND_STITCH across both families — one row each", () => {
      expect(merged.filter((m) => m.code === "FABRIC_INWARD")).toHaveLength(1);
      expect(merged.filter((m) => m.code === "CUT_AND_STITCH")).toHaveLength(1);
    });

    it("keeps common spine intact + normalises to 100", () => {
      expect(merged.map((m) => m.code)).toContain("SITE_VISIT");
      expect(sum(merged)).toBe(100);
    });
  });

  describe("flooring — subfloor check inserts at sequence 15", () => {
    const merged = mergeMilestoneTemplates(TEMPLATES, ["FLOORING"]);

    it("SUBFLOOR_CHECK sits between SITE_VISIT (10) and MEASUREMENT (20)", () => {
      const codes = merged.map((m) => m.code);
      const siteIdx     = codes.indexOf("SITE_VISIT");
      const subfloorIdx = codes.indexOf("SUBFLOOR_CHECK");
      const measureIdx  = codes.indexOf("MEASUREMENT");
      expect(siteIdx).toBeLessThan(subfloorIdx);
      expect(subfloorIdx).toBeLessThan(measureIdx);
    });
  });

  describe("empty family set (no families known yet)", () => {
    const merged = mergeMilestoneTemplates(TEMPLATES, []);

    it("returns exactly the common spine (7 milestones)", () => {
      expect(merged).toHaveLength(7);
      expect(merged.every((m) => m.family === null)).toBe(true);
    });

    it("still normalises to 100 across the common weighted rows", () => {
      expect(sum(merged)).toBe(100);
    });
  });

  describe("idempotency + stability", () => {
    it("is a pure function — same inputs give the same outputs", () => {
      const a = mergeMilestoneTemplates(TEMPLATES, ["WALLPAPER", "FLOORING"]);
      const b = mergeMilestoneTemplates(TEMPLATES, ["WALLPAPER", "FLOORING"]);
      expect(a).toEqual(b);
    });

    it("does not mutate its inputs", () => {
      const snapshot = JSON.stringify(TEMPLATES);
      mergeMilestoneTemplates(TEMPLATES, ["WALLPAPER", "CURTAIN_FABRIC", "FLOORING"]);
      expect(JSON.stringify(TEMPLATES)).toBe(snapshot);
    });
  });
});

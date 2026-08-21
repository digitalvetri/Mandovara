// Milestone templates seed — projects auto-generate their milestones by
// merging the COMMON spine with any templates whose `family` matches a
// family present in the project. Weights are renormalised to 100 % at
// generation time (see /lib/milestones/merge.ts) so the raw weights here
// are the *design* percentages, not runtime totals.
//
// Spec: docs/BUILD-SPEC.md — project detail redesign, §3.

import type { PrismaClient, Prisma, ProductFamily } from "@prisma/client";

interface TemplateSpec {
  family: ProductFamily | null;
  sequence: number;
  code: string;
  name: string;
  billingWeightPct: number;
  autoCompleteOn: string | null;
}

const TEMPLATES: readonly TemplateSpec[] = [
  // ── Common spine (family = null, present on every project) ─────────────
  { family: null, sequence: 10, code: "SITE_VISIT",    name: "Site visit",     billingWeightPct: 0,  autoCompleteOn: "siteVisit.completed" },
  { family: null, sequence: 20, code: "MEASUREMENT",   name: "Measurement",    billingWeightPct: 0,  autoCompleteOn: "measurement.approved" },
  { family: null, sequence: 30, code: "QUOTATION",     name: "Quotation",      billingWeightPct: 0,  autoCompleteOn: "quotation.accepted" },
  { family: null, sequence: 40, code: "ADVANCE",       name: "Advance",        billingWeightPct: 40, autoCompleteOn: "advance.received" },
  { family: null, sequence: 50, code: "PROCUREMENT",   name: "Procurement",    billingWeightPct: 0,  autoCompleteOn: "allocation.complete" },
  { family: null, sequence: 90, code: "HANDOVER",      name: "Handover",       billingWeightPct: 40, autoCompleteOn: null },

  // ── Curtains & sheer share the make cycle ──────────────────────────────
  { family: "CURTAIN_FABRIC", sequence: 60, code: "FABRIC_INWARD",  name: "Fabric inward",  billingWeightPct: 0,  autoCompleteOn: "grn.received" },
  { family: "CURTAIN_FABRIC", sequence: 70, code: "CUT_AND_STITCH", name: "Cut & stitch",   billingWeightPct: 20, autoCompleteOn: "makeJob.qcPassed" },
  { family: "SHEER",          sequence: 60, code: "FABRIC_INWARD",  name: "Fabric inward",  billingWeightPct: 0,  autoCompleteOn: "grn.received" },
  { family: "SHEER",          sequence: 70, code: "CUT_AND_STITCH", name: "Cut & stitch",   billingWeightPct: 20, autoCompleteOn: "makeJob.qcPassed" },

  // ── Wallpaper — dye lot check happens on the inward milestone ─────────
  { family: "WALLPAPER", sequence: 60, code: "ROLL_INWARD", name: "Roll inward (dye lot)", billingWeightPct: 0, autoCompleteOn: "grn.received" },

  // ── Flooring — subfloor check is a pre-material manual step ───────────
  { family: "FLOORING", sequence: 15, code: "SUBFLOOR_CHECK",   name: "Subfloor check",   billingWeightPct: 0, autoCompleteOn: null },
  { family: "FLOORING", sequence: 60, code: "MATERIAL_INWARD",  name: "Material inward",  billingWeightPct: 0, autoCompleteOn: "grn.received" },
];

export async function seedMilestoneTemplates(db: PrismaClient, orgId: string): Promise<number> {
  const rows: Prisma.MilestoneTemplateCreateManyInput[] = TEMPLATES.map((t) => ({
    organizationId:   orgId,
    family:           t.family,
    sequence:         t.sequence,
    code:             t.code,
    name:             t.name,
    billingWeightPct: t.billingWeightPct,
    autoCompleteOn:   t.autoCompleteOn,
    isActive:         true,
  }));

  const res = await db.milestoneTemplate.createMany({ data: rows, skipDuplicates: true });
  return res.count;
}

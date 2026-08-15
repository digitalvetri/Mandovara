// Milestone auto-generation service.
//
// Reads MilestoneTemplate rows + the project's known families, calls the
// pure merge/normalise function, and inserts any missing Milestone rows.
//
// Idempotent — never duplicates. Existing manual milestones (templateCode
// null) are preserved untouched. Existing template-linked milestones are
// updated in place if the merged weight has changed (e.g. a new family
// was added, weights renormalised).
//
// Called from:
//   - Project creation (families derived from initial intent)
//   - measurement.approved handler (families derived from DISTINCT
//     MeasurementItem.family across the project)
//   - Manual "regenerate milestones" admin action
//
// Never called from client code — always via server actions / listeners.

import type { Prisma, PrismaClient, ProductFamily } from "@prisma/client";
import { mergeMilestoneTemplates, type TemplateRow } from "./merge";

type TxOrClient = PrismaClient | Prisma.TransactionClient;

interface GenerateOptions {
  readonly orgId: string;
  readonly projectId: string;
  /** Optional explicit families override; if omitted, we derive from measurement items. */
  readonly families?: readonly ProductFamily[];
}

interface GenerateResult {
  readonly created: number;
  readonly updated: number;
  readonly familiesUsed: readonly string[];
}

export async function generateMilestonesForProject(
  db: TxOrClient,
  opts: GenerateOptions,
): Promise<GenerateResult> {
  const families = opts.families ?? (await deriveFamilies(db, opts.projectId));

  const templates = await db.milestoneTemplate.findMany({
    where:  { organizationId: opts.orgId, isActive: true },
    select: {
      family: true, sequence: true, code: true, name: true,
      billingWeightPct: true, autoCompleteOn: true,
    },
  });

  const templateRows: TemplateRow[] = templates.map((t) => ({
    family:           t.family,
    sequence:         t.sequence,
    code:             t.code,
    name:             t.name,
    billingWeightPct: Number(t.billingWeightPct),
    autoCompleteOn:   t.autoCompleteOn,
  }));

  const merged = mergeMilestoneTemplates(templateRows, families);

  const existing = await db.milestone.findMany({
    where:  { projectId: opts.projectId, templateCode: { not: null } },
    select: { id: true, templateCode: true, billingWeightPct: true, name: true, order: true, status: true },
  });
  const existingByCode = new Map(existing.map((m) => [m.templateCode as string, m]));

  let created = 0;
  let updated = 0;
  const now = new Date();

  for (const m of merged) {
    const found = existingByCode.get(m.code);
    if (!found) {
      await db.milestone.create({
        data: {
          organizationId:   opts.orgId,
          projectId:        opts.projectId,
          name:             m.name,
          plannedDate:      now, // placeholder — updated when the project has real dates
          billingPct:       m.billingWeightPct, // legacy column kept in sync
          billingWeightPct: m.billingWeightPct,
          order:            m.sequence,
          status:           "PENDING",
          templateCode:     m.code,
          family:           (m.family as ProductFamily | null) ?? null,
          sourceEvent:      m.autoCompleteOn,
        },
      });
      created += 1;
      continue;
    }

    // Update in place if weight or ordering changed (families were added
    // and the whole set renormalised). Don't touch status — that's owned
    // by domain-event handlers and manual overrides.
    const currentWeight = Number(found.billingWeightPct ?? 0);
    if (currentWeight !== m.billingWeightPct || found.order !== m.sequence) {
      await db.milestone.update({
        where: { id: found.id },
        data: {
          billingPct:       m.billingWeightPct,
          billingWeightPct: m.billingWeightPct,
          order:            m.sequence,
        },
      });
      updated += 1;
    }
  }

  return { created, updated, familiesUsed: families };
}

/** Distinct ProductFamily values across all MeasurementItems in this project. */
async function deriveFamilies(db: TxOrClient, projectId: string): Promise<readonly ProductFamily[]> {
  const rows = await db.measurementItem.findMany({
    where:   { measurement: { projectId } },
    select:  { family: true },
    distinct: ["family"],
  });
  return rows.map((r) => r.family);
}

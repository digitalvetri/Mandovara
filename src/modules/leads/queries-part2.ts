// Split out of queries.ts to stay under the §10 300-line limit.

// Leads repository — read side. All queries go through scoped(ctx).
// Schema reference: Lead has `stage LeadStage` (not `status`), `budgetMin`/`budgetMax` (not
// `expectedValue`), `mobile`, `email` — no companyName, no updatedAt, no stateCode.

import { scoped } from "@/kernel/db/scoped";
import { withTransaction } from "@/kernel/db/transaction";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import { LeadDetail, LeadSummaryCounts, ListLeadsQuery, OPEN_STAGES } from "./queries";
import { canTouchLead, canViewOthersLeads, leadVisibilityWhere } from "./scope";

export async function getLead(ctx: RequestContext, id: string): Promise<LeadDetail | null> {
  requirePermission(ctx, "lead.view");
  const db = scoped(ctx);
  const lead = await db.lead.findUnique({
    where: { id },
    select: {
      id: true, number: true, name: true, mobile: true, email: true,
      source: true, stage: true, requirement: true,
      budgetMin: true, budgetMax: true, siteAddress: true,
      ownerId: true, createdAt: true,
      convertedClientId: true, lostReason: true, nextActionAt: true,
    },
  });
  if (!lead) return null;
  // Not "forbidden" — absent. Returning null lets the page render its
  // ordinary not-found state, and does not confirm to an employee that a
  // lead with this id exists under someone else's name.
  if (!canTouchLead(ctx, lead)) return null;

  const owner = await db.user.findUnique({
    where: { id: lead.ownerId },
    select: { name: true },
  });

  const addr = lead.siteAddress as Record<string, unknown> | null;

  return {
    id: lead.id, number: lead.number, name: lead.name, mobile: lead.mobile, email: lead.email,
    source: lead.source, stage: lead.stage, requirement: lead.requirement,
    budgetMin: lead.budgetMin, budgetMax: lead.budgetMax,
    ownerId: lead.ownerId, createdAt: lead.createdAt,
    convertedClientId: lead.convertedClientId,
    lostReason: lead.lostReason, nextActionAt: lead.nextActionAt,
    ownerName: owner?.name ?? "—",
    city: typeof addr?.city === "string" && addr.city ? addr.city : null,
    priority: typeof addr?.priority === "string" ? addr.priority : null,
    siteAddress: typeof addr?.address === "string" && addr.address ? addr.address : null,
  };
}

export interface SalesUserOption {
  id:   string;
  name: string;
  role: string;
}

export async function listSalesUsers(ctx: RequestContext): Promise<SalesUserOption[]> {
  const db = scoped(ctx);
  const rows = await db.user.findMany({
    where: { role: { in: ["OWNER", "SALES", "DESIGNER"] as const }, status: "ACTIVE" },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
  return rows.map((u) => ({ id: u.id, name: u.name, role: u.role }));
}

export async function getLeadSummaryCounts(ctx: RequestContext): Promise<LeadSummaryCounts> {
  requirePermission(ctx, "lead.view");
  const db = scoped(ctx);
  const now = new Date();

  // Single groupBy replaces 6 separate COUNT queries
  // Same narrowing as listLeads — these are the counts printed on the
  // tabs above that list, so they have to answer the same question.
  const visible = leadVisibilityWhere(ctx);
  const [stageCounts, followUp] = await Promise.all([
    db.lead.groupBy({ by: ["stage"], _count: { id: true }, where: visible }),
    db.followUp.count({
      where: {
        refType: "LEAD", completedAt: null, dueAt: { lte: now },
        ...(canViewOthersLeads(ctx) ? {} : { ownerId: ctx.userId }),
      },
    }),
  ]);

  const m = new Map(stageCounts.map((s) => [s.stage, s._count.id]));
  const total = stageCounts.reduce((sum, s) => sum + s._count.id, 0);
  return {
    total,
    newLeads:  m.get("NEW")       ?? 0,
    contacted: m.get("CONTACTED") ?? 0,
    qualified: m.get("QUALIFIED") ?? 0,
    // Sanctioned "quoted" bucket = QUOTED + NEGOTIATION (legacy).
    quoted: (m.get("QUOTED") ?? 0) + (m.get("NEGOTIATION") ?? 0),
    followUp,
    won:  m.get("WON")  ?? 0,
    lost: m.get("LOST") ?? 0,
  };
}

export async function getLeadCities(ctx: RequestContext): Promise<string[]> {
  requirePermission(ctx, "lead.view");
  // $queryRaw for DISTINCT on a JSON field — Prisma groupBy can't target JSON paths.
  //
  // MUST go through withTransaction({ orgId }). orgPrisma()'s extension hooks
  // `$allModels`, and a raw query is not a model operation — so it would run
  // with no `app.current_org_id` set and the RLS policy would return zero rows.
  // Verified: the bare form returned 0 while the same count via a model op
  // returned 262.
  // The city dropdown is built from the leads you can see. Left
  // unscoped it would leak the towns of other people's leads and offer
  // filters that return nothing.
  const ownerOnly = canViewOthersLeads(ctx) ? null : ctx.userId;
  const rows = await withTransaction(
    (tx) => tx.$queryRaw<{ city: string }[]>`
      SELECT DISTINCT "siteAddress"->>'city' AS city
      FROM "Lead"
      WHERE "organizationId" = ${ctx.orgId}
        AND "siteAddress"->>'city' IS NOT NULL
        AND "siteAddress"->>'city' != ''
        AND (${ownerOnly}::text IS NULL OR "ownerId" = ${ownerOnly})
      ORDER BY city
    `,
    { orgId: ctx.orgId },
  );
  return rows.map((r) => r.city);
}

// ── helpers ───────────────────────────────────────────────────────────────────

type WhereInput = Record<string, unknown>;

export function buildWhere(q: ListLeadsQuery): WhereInput {
  const conditions: WhereInput[] = [];

  if (q.search?.trim()) {
    const s = q.search.trim();
    conditions.push({
      OR: [
        { name:   { contains: s, mode: "insensitive" } },
        { mobile: { contains: s } },
        { email:  { contains: s, mode: "insensitive" } },
        { number: { contains: s, mode: "insensitive" } },
      ],
    });
  }

  if (q.stage && q.stage !== "ALL") {
    if (q.stage === "OPEN") {
      // Retained for old bookmarks / dashboard links; UI no longer offers it.
      conditions.push({ stage: { in: [...OPEN_STAGES] } });
    } else if (q.stage === "NEW") {
      // Sanctioned NEW absorbs the pre-quote legacy stages so leads
      // stuck at CONTACTED / QUALIFIED / etc still show up in the tab.
      conditions.push({
        stage: { in: ["NEW", "CONTACTED", "QUALIFIED", "MEASUREMENT_SCHEDULED", "VISIT_SCHEDULED", "MEASURED"] },
      });
    } else if (q.stage === "QUOTED") {
      // QUOTED absorbs NEGOTIATION for the same reason.
      conditions.push({ stage: { in: ["QUOTED", "NEGOTIATION"] } });
    } else {
      conditions.push({ stage: q.stage });
    }
  }

  if (q.priority) {
    conditions.push({ siteAddress: { path: ["priority"], equals: q.priority } });
  }

  if (q.source) conditions.push({ source: q.source });
  if (q.ownerId) conditions.push({ ownerId: q.ownerId });

  if (q.city) {
    conditions.push({ siteAddress: { path: ["city"], equals: q.city } });
  }

  if (q.dateFrom || q.dateTo) {
    const dateFilter: Record<string, Date> = {};
    if (q.dateFrom) dateFilter.gte = new Date(q.dateFrom);
    if (q.dateTo)   dateFilter.lte = new Date(q.dateTo);
    conditions.push({ createdAt: dateFilter });
  }

  if (conditions.length === 0) return {};
  if (conditions.length === 1) return conditions[0]!;
  return { AND: conditions };
}

export function orderFor(sort: ListLeadsQuery["sort"]): { [k: string]: "asc" | "desc" }[] {
  switch (sort) {
    case "oldest": return [{ createdAt: "asc" },  { id: "asc" }];
    case "name":   return [{ name: "asc" },        { createdAt: "desc" }, { id: "desc" }];
    case "value":  return [{ budgetMax: "desc" },  { createdAt: "desc" }, { id: "desc" }];
    case "recent":
    default:       return [{ createdAt: "desc" },  { id: "desc" }];
  }
}

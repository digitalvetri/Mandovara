// Leads repository — read side. All queries go through scoped(ctx).
// Schema reference: Lead has `stage LeadStage` (not `status`), `budgetMin`/`budgetMax` (not
// `expectedValue`), `mobile`, `email` — no companyName, no updatedAt, no stateCode.

import { scoped } from "@/kernel/db/scoped";
import { prisma } from "@/kernel/db/client";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface ListLeadsQuery {
  search?: string;
  stage?: string | "OPEN" | "ALL";
  priority?: string;
  source?: string;
  ownerId?: string;
  city?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sort?: "recent" | "oldest" | "name" | "value";
}

export interface LeadRow {
  id: string;
  number: string;
  name: string;
  mobile: string;
  email: string | null;
  source: string;
  stage: string;
  requirement: string | null;
  budgetMin: bigint | null;
  budgetMax: bigint | null;
  ownerId: string;
  createdAt: Date;
  // enriched — always populated by listLeads; optional so getLead can reuse type
  city?: string | null;
  priority?: string | null;
  ownerName?: string;
  lastContactedAt?: Date | null;
  nextFollowUpAt?: Date | null;
}

export interface LeadDetail extends LeadRow {
  convertedClientId: string | null;
  lostReason: string | null;
  nextActionAt: Date | null;
  ownerName: string;
  budgetRangeSlug: string | null;
  /** Human-readable site address joined from the JSON blob, or null if empty. */
  siteAddress: string | null;
}

export interface ListLeadsResult {
  rows: LeadRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LeadSummaryCounts {
  total: number;
  newLeads: number;
  contacted: number;
  qualified: number;
  followUp: number;   // pending follow-ups (due date <= now, not completed)
  won: number;
  lost: number;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

// Valid LeadStage values per schema enum, excluding WON and LOST
const OPEN_STAGES = [
  "NEW", "CONTACTED", "QUALIFIED", "MEASUREMENT_SCHEDULED",
  "VISIT_SCHEDULED", "MEASURED", "QUOTED", "NEGOTIATION",
] as const;

export async function listLeads(
  ctx: RequestContext,
  q: ListLeadsQuery,
): Promise<ListLeadsResult> {
  requirePermission(ctx, "lead.view");
  const db = scoped(ctx);

  const pageSize = Math.min(q.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const page = Math.max(1, q.page ?? 1);
  const skip = (page - 1) * pageSize;

  const where = buildWhere(q);
  const orderBy = orderFor(q.sort);

  const [rawRows, total] = await Promise.all([
    db.lead.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      select: {
        id: true, number: true, name: true, mobile: true, email: true,
        source: true, stage: true, requirement: true,
        budgetMin: true, budgetMax: true,
        ownerId: true, createdAt: true,
        siteAddress: true,
      },
    }),
    db.lead.count({ where }),
  ]);

  if (rawRows.length === 0) return { rows: [], total, page, pageSize };

  const leadIds = rawRows.map((r) => r.id);
  const ownerIds = [...new Set(rawRows.map((r) => r.ownerId))];

  const [owners, lastContacted, nextPending] = await Promise.all([
    db.user.findMany({
      where: { id: { in: ownerIds } },
      select: { id: true, name: true },
    }),
    db.followUp.findMany({
      where: { refType: "LEAD", refId: { in: leadIds }, completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      take: leadIds.length * 3,   // at most 3 completed entries per lead to find the latest
      select: { refId: true, completedAt: true },
    }),
    db.followUp.findMany({
      where: { refType: "LEAD", refId: { in: leadIds }, completedAt: null },
      orderBy: { dueAt: "asc" },
      take: leadIds.length,       // one pending follow-up per lead is all we need
      select: { refId: true, dueAt: true },
    }),
  ]);

  const ownerNameMap = new Map(owners.map((o) => [o.id, o.name] as const));
  const lastContactedMap = new Map<string, Date>();
  for (const f of lastContacted) {
    if (!lastContactedMap.has(f.refId) && f.completedAt) {
      lastContactedMap.set(f.refId, f.completedAt);
    }
  }
  const nextFollowUpMap = new Map<string, Date>();
  for (const f of nextPending) {
    if (!nextFollowUpMap.has(f.refId)) {
      nextFollowUpMap.set(f.refId, f.dueAt);
    }
  }

  const rows: LeadRow[] = rawRows.map((r) => {
    const addr = r.siteAddress as Record<string, unknown> | null;
    return {
      id: r.id, number: r.number, name: r.name, mobile: r.mobile, email: r.email,
      source: r.source, stage: r.stage, requirement: r.requirement,
      budgetMin: r.budgetMin, budgetMax: r.budgetMax,
      ownerId: r.ownerId, createdAt: r.createdAt,
      city: typeof addr?.city === "string" && addr.city ? addr.city : null,
      priority: typeof addr?.priority === "string" ? addr.priority : null,
      ownerName: ownerNameMap.get(r.ownerId) ?? "—",
      lastContactedAt: lastContactedMap.get(r.id) ?? null,
      nextFollowUpAt: nextFollowUpMap.get(r.id) ?? null,
    };
  });

  return { rows, total, page, pageSize };
}

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

  const owner = await db.user.findUnique({
    where: { id: lead.ownerId },
    select: { name: true },
  });

  const addr = lead.siteAddress as Record<string, unknown> | null;
  const budgetRangeSlug = typeof addr?.budgetRange === "string" ? addr.budgetRange : null;
  const siteAddressStr = joinAddress(addr);

  return {
    id: lead.id, number: lead.number, name: lead.name, mobile: lead.mobile, email: lead.email,
    source: lead.source, stage: lead.stage, requirement: lead.requirement,
    budgetMin: lead.budgetMin, budgetMax: lead.budgetMax,
    ownerId: lead.ownerId, createdAt: lead.createdAt,
    convertedClientId: lead.convertedClientId,
    lostReason: lead.lostReason, nextActionAt: lead.nextActionAt,
    ownerName: owner?.name ?? "—",
    budgetRangeSlug,
    siteAddress: siteAddressStr,
    city: typeof addr?.city === "string" && addr.city ? addr.city : null,
    priority: typeof addr?.priority === "string" ? addr.priority : null,
  };
}

// Fold a site-address JSON blob into a single display line, dropping
// empty parts. Returns null when nothing usable is present.
function joinAddress(addr: Record<string, unknown> | null): string | null {
  if (!addr) return null;
  const parts = ["line1", "line", "street", "area", "city", "state", "pincode", "pin"]
    .map((k) => addr[k])
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  return parts.length > 0 ? parts.join(", ") : null;
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
  const [stageCounts, followUp] = await Promise.all([
    db.lead.groupBy({ by: ["stage"], _count: { id: true } }),
    db.followUp.count({ where: { refType: "LEAD", completedAt: null, dueAt: { lte: now } } }),
  ]);

  const m = new Map(stageCounts.map((s) => [s.stage, s._count.id]));
  const total = stageCounts.reduce((sum, s) => sum + s._count.id, 0);
  return {
    total,
    newLeads:  m.get("NEW")       ?? 0,
    contacted: m.get("CONTACTED") ?? 0,
    qualified: m.get("QUALIFIED") ?? 0,
    followUp,
    won:  m.get("WON")  ?? 0,
    lost: m.get("LOST") ?? 0,
  };
}

export async function getLeadCities(ctx: RequestContext): Promise<string[]> {
  requirePermission(ctx, "lead.view");
  // $queryRaw for DISTINCT on a JSON field — Prisma groupBy can't target JSON paths.
  // organizationId is applied manually; RLS is the second wall.
  const rows = await prisma.$queryRaw<{ city: string }[]>`
    SELECT DISTINCT "siteAddress"->>'city' AS city
    FROM "Lead"
    WHERE "organizationId" = ${ctx.orgId}
      AND "siteAddress"->>'city' IS NOT NULL
      AND "siteAddress"->>'city' != ''
    ORDER BY city
  `;
  return rows.map((r) => r.city);
}

// ── helpers ───────────────────────────────────────────────────────────────────

type WhereInput = Record<string, unknown>;

function buildWhere(q: ListLeadsQuery): WhereInput {
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
      conditions.push({ stage: { in: [...OPEN_STAGES] } });
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

function orderFor(sort: ListLeadsQuery["sort"]): { [k: string]: "asc" | "desc" } {
  switch (sort) {
    case "oldest": return { createdAt: "asc" };
    case "name":   return { name: "asc" };
    case "value":  return { budgetMax: "desc" };
    case "recent":
    default:       return { createdAt: "desc" };
  }
}

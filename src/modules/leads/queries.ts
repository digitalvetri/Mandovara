// Leads repository — read side. All queries go through scoped(ctx).
// Schema reference: Lead has `stage LeadStage` (not `status`), `budgetMin`/`budgetMax` (not
// `expectedValue`), `mobile`, `email` — no companyName, no updatedAt, no stateCode.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import { buildWhere, orderFor } from "./queries-part2";

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
export const OPEN_STAGES = [
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

export * from "./queries-part2";

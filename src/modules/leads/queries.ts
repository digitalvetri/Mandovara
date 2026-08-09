// Leads repository — read side. All queries go through db.scoped(ctx).
// Schema reference: Lead has `stage LeadStage` (not `status`), `budgetMin`/`budgetMax` (not
// `expectedValue`), `mobile`, `email` — no companyName, no updatedAt, no stateCode.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface ListLeadsQuery {
  search?: string;
  stage?: string | "OPEN" | "ALL";
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
}

export interface LeadDetail extends LeadRow {
  convertedClientId: string | null;
  lostReason: string | null;
  nextActionAt: Date | null;
}

export interface ListLeadsResult {
  rows: LeadRow[];
  total: number;
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

// Valid LeadStage values per schema enum, excluding WON and LOST
const OPEN_STAGES = [
  "NEW", "CONTACTED", "MEASUREMENT_SCHEDULED", "MEASURED", "QUOTED", "NEGOTIATION",
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

  const [rows, total] = await Promise.all([
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
      },
    }),
    db.lead.count({ where }),
  ]);

  return { rows, total, page, pageSize };
}

export async function getLead(ctx: RequestContext, id: string): Promise<LeadDetail | null> {
  requirePermission(ctx, "lead.view");
  const db = scoped(ctx);
  return db.lead.findUnique({
    where: { id },
    select: {
      id: true, number: true, name: true, mobile: true, email: true,
      source: true, stage: true, requirement: true,
      budgetMin: true, budgetMax: true,
      ownerId: true, createdAt: true,
      convertedClientId: true, lostReason: true, nextActionAt: true,
    },
  });
}

// ── helpers ───────────────────────────────────────────────────────────────────

type WhereInput = Record<string, unknown>;

function buildWhere(q: ListLeadsQuery): WhereInput {
  const where: WhereInput = {};
  if (q.search && q.search.trim().length > 0) {
    const s = q.search.trim();
    where["OR"] = [
      { name:   { contains: s, mode: "insensitive" } },
      { mobile: { contains: s } },
      { email:  { contains: s, mode: "insensitive" } },
    ];
  }
  if (q.stage && q.stage !== "ALL") {
    if (q.stage === "OPEN") {
      where["stage"] = { in: [...OPEN_STAGES] };
    } else {
      where["stage"] = q.stage;
    }
  }
  return where;
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

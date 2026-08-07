// Leads repository — read side. All queries go through db.scoped(ctx).

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import type { LeadStatus } from "./schema";

export interface ListLeadsQuery {
  search?: string;
  status?: LeadStatus | "OPEN" | "ALL";
  page?: number;
  pageSize?: number;
  sort?: "recent" | "oldest" | "name" | "value";
}

export interface LeadRow {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  companyName: string | null;
  source: string;
  status: string;
  expectedValue: bigint | null;
  requirement: string | null;
  ownerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadDetail extends LeadRow {
  convertedClientId: string | null;
}

export interface ListLeadsResult {
  rows: LeadRow[];
  total: number;
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

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
        id: true, name: true, mobile: true, email: true, companyName: true,
        source: true, status: true, expectedValue: true, requirement: true,
        ownerId: true, createdAt: true, updatedAt: true,
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
      id: true, name: true, mobile: true, email: true, companyName: true,
      source: true, status: true, expectedValue: true, requirement: true,
      ownerId: true, createdAt: true, updatedAt: true,
      convertedClientId: true,
    },
  });
}

// ── helpers ──────────────────────────────────────────────────────

type WhereInput = Record<string, unknown>;

function buildWhere(q: ListLeadsQuery): WhereInput {
  const where: WhereInput = {};
  if (q.search && q.search.trim().length > 0) {
    const s = q.search.trim();
    where["OR"] = [
      { name:        { contains: s, mode: "insensitive" } },
      { mobile:      { contains: s } },
      { email:       { contains: s, mode: "insensitive" } },
      { companyName: { contains: s, mode: "insensitive" } },
    ];
  }
  if (q.status && q.status !== "ALL") {
    if (q.status === "OPEN") {
      where["status"] = { in: ["NEW", "CONTACTED", "QUALIFIED", "PROPOSED", "NEGOTIATION"] };
    } else {
      where["status"] = q.status;
    }
  }
  return where;
}

function orderFor(sort: ListLeadsQuery["sort"]): { [k: string]: "asc" | "desc" } {
  switch (sort) {
    case "oldest": return { createdAt: "asc" };
    case "name":   return { name: "asc" };
    case "value":  return { expectedValue: "desc" };
    case "recent":
    default:       return { createdAt: "desc" };
  }
}

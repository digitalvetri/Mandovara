import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import type { QuotationStatus } from "./schema";
import { buildWhere, orderFor } from "./queries-part2";

export interface ListQuotationsQuery {
  search?: string;
  status?: QuotationStatus | "ALL";
  projectId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  pageSize?: number;
  sort?: "recent" | "oldest" | "total";
}

export type ExpiryBucket = "ok" | "soon" | "critical" | "expired";

export interface QuotationRow {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  clientMobile: string;
  projectId: string;
  projectName: string;
  date: Date;
  validUntil: Date;
  status: string;
  total: bigint;
  lineCount: number;
  ownerName: string;
  expiryBucket: ExpiryBucket;
}

export interface QuotationKPIs {
  total: number;
  byStatus: Record<string, number>;
  expiringSoon: number;
  totalValueStr: string;
}

export interface ListQuotationsResult {
  rows: QuotationRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface QuotationLine {
  id: string;
  lineNo: number;
  colourwayId: string | null;
  serviceRateId: string | null;
  measurementItemId: string | null;
  roomLabel: string | null;
  description: string;
  quantity: string;
  unit: string;
  rate: bigint;
  discountPct: string;
  taxable: bigint;
  gstRate: string;
  cgst: bigint;
  sgst: bigint;
  igst: bigint;
  amount: bigint;
  isOptional: boolean;
  // Enriched fields for PDF/preview (populated by getQuotation)
  hsn:           string | null;
  colourHex:     string | null;
  colourwayCode: string | null;
  designName:    string | null;
  brandName:     string | null;
  calcSnapshot:  Record<string, unknown> | null;
  widthMm:       string | null;
  heightMm:      string | null;
}

export interface QuotationDetail {
  id: string;
  number: string;
  revision: number;
  status: string;
  branchId: string;
  branchName: string;
  supplierStateCode: string;
  ownerName: string | null;
  // Party — FIXES-01 §5.1. Exactly one of leadId / clientId is set.
  // The client* fields carry the party's display info regardless of
  // which side is set (lead's name/mobile OR client's).
  leadId:   string | null;
  clientId: string | null;
  clientName: string;
  clientMobile: string;
  clientEmail: string | null;
  clientGstin: string | null;
  projectId:   string | null;
  projectName: string | null;
  /** Site area printed on the quotation's second band (VEERAKERALAM,
   *  NEELAMBUR …). Project site city, falling back to the client's or
   *  lead's city. Null when nobody has recorded one. */
  siteArea:    string | null;
  date: Date;
  validUntil: Date;
  taxableAmount: bigint;
  cgst: bigint;
  sgst: bigint;
  igst: bigint;
  roundOff: bigint;
  total: bigint;
  termsText: string | null;
  shareToken: string | null;
  shareTokenExpiresAt: Date | null;
  /** Edits spent since the last owner unlock — see edit-budget.ts. */
  editCount: number;
  lines: QuotationLine[];
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export async function quotationKPIs(ctx: RequestContext): Promise<QuotationKPIs> {
  requirePermission(ctx, "quotation.view");
  const db = scoped(ctx);

  const now = new Date();
  const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [groups, expiringSoonCount, valueAgg] = await Promise.all([
    db.quotation.groupBy({ by: ["status"], _count: { _all: true } }),
    db.quotation.count({
      where: {
        status: { in: ["SENT", "APPROVED", "REVISED"] },
        validUntil: { gte: now, lte: sevenDaysOut },
      },
    }),
    db.quotation.aggregate({ _sum: { total: true } }),
  ]);

  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const g of groups) {
    byStatus[g.status] = g._count._all;
    total += g._count._all;
  }

  return {
    total,
    byStatus,
    expiringSoon: expiringSoonCount,
    totalValueStr: (valueAgg._sum.total ?? 0n).toString(),
  };
}

export async function listQuotations(
  ctx: RequestContext,
  q: ListQuotationsQuery,
): Promise<ListQuotationsResult> {
  requirePermission(ctx, "quotation.view");
  const db = scoped(ctx);

  const pageSize = Math.min(q.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const page = Math.max(1, q.page ?? 1);
  const skip = (page - 1) * pageSize;

  const where = buildWhere(q);
  const orderBy = orderFor(q.sort);

  const [rows, total] = await Promise.all([
    db.quotation.findMany({
      where, orderBy, skip, take: pageSize,
      select: {
        id: true, number: true, date: true, validUntil: true, status: true, total: true,
        clientId: true, ownerId: true,
        // Deliberately NOT nesting `client` through the project.
        //
        // Project.client is a REQUIRED relation in the schema, so Prisma
        // asserts a row came back for it. Under scoped()/RLS the join can
        // legitimately return nothing — a client outside the caller's org
        // or hidden by a row policy — and Prisma then fails the whole
        // findMany with "Inconsistent query result: Field client is
        // required to return data, got null instead". That took the entire
        // quotations list down over one unreachable client row.
        //
        // Fetching clients separately by id (same shape as the owner
        // lookup below) keeps a missing row to a single dash in one cell.
        project: { select: { id: true, name: true, clientId: true } },
        _count: { select: { lines: true } },
      },
    }),
    db.quotation.count({ where }),
  ]);

  const ownerIds = [...new Set(rows.map((r) => r.ownerId))];
  const users = ownerIds.length > 0
    ? await db.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, name: true } })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u.name]));

  const clientIds = [...new Set(rows.map((r) => r.project?.clientId).filter((v): v is string => v != null))];
  const clients = clientIds.length > 0
    ? await db.client.findMany({
        where: { id: { in: clientIds } },
        select: { id: true, name: true, mobile: true },
      })
    : [];
  const clientMap = new Map(clients.map((c) => [c.id, c]));

  const now = new Date();
  const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  function bucketFor(status: string, validUntil: Date): ExpiryBucket {
    if (!["SENT", "APPROVED", "REVISED"].includes(status)) return "ok";
    if (validUntil < now) return "expired";
    if (validUntil <= threeDays) return "critical";
    if (validUntil <= sevenDays) return "soon";
    return "ok";
  }

  return {
    // Lead-scoped quotations (FIXES-01 §5.1) have no project — hide them
    // from the client-facing quotations list for now. Next session's UI
    // wiring adds a "Lead quotations" filter + column.
    rows: rows
      .filter((r): r is typeof r & { project: NonNullable<typeof r.project>; clientId: string } =>
        r.project !== null && r.clientId !== null)
      .map((r) => ({
        id: r.id,
        number: r.number,
        clientId: r.clientId,
        // A client the caller cannot see costs this row its name and
        // number, not the page.
        clientName: clientMap.get(r.project.clientId)?.name ?? "—",
        clientMobile: clientMap.get(r.project.clientId)?.mobile ?? "",
        projectId: r.project.id,
        projectName: r.project.name,
        date: r.date,
        validUntil: r.validUntil,
        status: r.status,
        total: r.total,
        lineCount: r._count.lines,
        ownerName: userMap.get(r.ownerId) ?? "—",
        expiryBucket: bucketFor(r.status, r.validUntil),
      })),
    total, page, pageSize,
  };
}

export * from "./queries-part2";
export * from "./queries-inline";

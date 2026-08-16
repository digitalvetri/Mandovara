import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import type { QuotationStatus } from "./schema";

export interface ListQuotationsQuery {
  search?: string;
  status?: QuotationStatus | "ALL";
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
}

export interface QuotationDetail {
  id: string;
  number: string;
  revision: number;
  status: string;
  branchId: string;
  branchName: string;
  supplierStateCode: string;
  clientId: string;
  clientName: string;
  clientMobile: string;
  clientEmail: string | null;
  clientGstin: string | null;
  projectId: string;
  projectName: string;
  date: Date;
  validUntil: Date;
  taxableAmount: bigint;
  cgst: bigint;
  sgst: bigint;
  igst: bigint;
  roundOff: bigint;
  total: bigint;
  termsText: string | null;
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
        project: {
          select: {
            id: true,
            name: true,
            client: { select: { name: true, mobile: true } },
          },
        },
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
    rows: rows.map((r) => ({
      id: r.id,
      number: r.number,
      clientId: r.clientId,
      clientName: r.project.client.name,
      clientMobile: r.project.client.mobile,
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

export async function getQuotation(
  ctx: RequestContext,
  id: string,
): Promise<QuotationDetail | null> {
  requirePermission(ctx, "quotation.view");
  const db = scoped(ctx);

  const row = await db.quotation.findUnique({
    where: { id },
    select: {
      id: true, number: true, revision: true, status: true, branchId: true,
      projectId: true, clientId: true,
      date: true, validUntil: true, termsText: true,
      taxableAmount: true, cgst: true, sgst: true, igst: true, roundOff: true, total: true,
      project: {
        select: {
          name: true,
          client: { select: { id: true, name: true, mobile: true, email: true, gstin: true } },
        },
      },
      lines: {
        orderBy: { lineNo: "asc" },
        select: {
          id: true, lineNo: true, description: true,
          colourwayId: true, serviceRateId: true, measurementItemId: true, roomLabel: true,
          quantity: true, unit: true, rate: true,
          discountPct: true, taxable: true, gstRate: true,
          cgst: true, sgst: true, igst: true, amount: true, isOptional: true,
        },
      },
    },
  });
  if (!row) return null;

  const branch = await db.branch.findUniqueOrThrow({
    where: { id: row.branchId },
    select: { name: true, stateCode: true },
  });

  return {
    id: row.id,
    number: row.number,
    revision: row.revision,
    status: row.status,
    branchId: row.branchId,
    branchName: branch.name,
    supplierStateCode: branch.stateCode,
    clientId: row.clientId,
    clientName: row.project.client.name,
    clientMobile: row.project.client.mobile,
    clientEmail: row.project.client.email,
    clientGstin: row.project.client.gstin,
    projectName: row.project.name,
    projectId: row.projectId,
    date: row.date,
    validUntil: row.validUntil,
    termsText: row.termsText,
    taxableAmount: row.taxableAmount,
    cgst: row.cgst,
    sgst: row.sgst,
    igst: row.igst,
    roundOff: row.roundOff,
    total: row.total,
    lines: row.lines.map((l) => ({
      id: l.id,
      lineNo: l.lineNo,
      colourwayId: l.colourwayId,
      serviceRateId: l.serviceRateId,
      measurementItemId: l.measurementItemId,
      roomLabel: l.roomLabel,
      description: l.description,
      quantity: l.quantity.toString(),
      unit: l.unit,
      rate: l.rate,
      discountPct: l.discountPct.toString(),
      taxable: l.taxable,
      gstRate: l.gstRate.toString(),
      cgst: l.cgst,
      sgst: l.sgst,
      igst: l.igst,
      amount: l.amount,
      isOptional: l.isOptional,
    })),
  };
}

export interface QuotationInlineRow {
  id:         string;
  number:     string;
  revision:   number;
  date:       Date;
  status:     string;
  total:      bigint;
  lineCount:  number;
  projectId:  string;
  projectName: string;
}

/** Small-table list for embedding in a client detail or lead detail
 *  page. Newest first, no pagination — a client with 200 quotes is
 *  rare enough to add a "See all" link at the bottom instead. */
export async function listQuotationsForClient(
  ctx:      RequestContext,
  clientId: string,
  limit = 20,
): Promise<QuotationInlineRow[]> {
  requirePermission(ctx, "quotation.view");
  const db = scoped(ctx);
  const rows = await db.quotation.findMany({
    where:   { clientId },
    orderBy: [{ date: "desc" }, { revision: "desc" }],
    take:    limit,
    select: {
      id: true, number: true, revision: true, date: true,
      status: true, total: true,
      project: { select: { id: true, name: true } },
      _count:  { select: { lines: true } },
    },
  });
  return rows.map((r) => ({
    id:          r.id,
    number:      r.number,
    revision:    r.revision,
    date:        r.date,
    status:      r.status,
    total:       r.total,
    lineCount:   r._count.lines,
    projectId:   r.project.id,
    projectName: r.project.name,
  }));
}

// ── helpers ──────────────────────────────────────────────────────────────────

type WhereInput = Record<string, unknown>;

export function buildWhere(q: ListQuotationsQuery): WhereInput {
  const where: WhereInput = {};
  if (q.search && q.search.trim().length > 0) {
    const s = q.search.trim();
    where["OR"] = [
      { number: { contains: s, mode: "insensitive" } },
      { project: { client: { name: { contains: s, mode: "insensitive" } } } },
    ];
  }
  if (q.status && q.status !== "ALL") where["status"] = q.status;
  if (q.dateFrom || q.dateTo) {
    const dateFilter: WhereInput = {};
    if (q.dateFrom) dateFilter["gte"] = q.dateFrom;
    if (q.dateTo) dateFilter["lte"] = q.dateTo;
    where["date"] = dateFilter;
  }
  return where;
}

function orderFor(sort: ListQuotationsQuery["sort"]): { [k: string]: "asc" | "desc" } {
  switch (sort) {
    case "oldest": return { date: "asc" };
    case "total":  return { total: "desc" };
    default:       return { date: "desc" };
  }
}

/* eslint-disable max-lines -- FIXME(§10): 450 lines, limit 300. Split by concern before the next phase; the rule stays enforced so this stays visible. */
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
      leadId: true, projectId: true, clientId: true,
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
    where:  { id: row.branchId },
    select: { name: true, stateCode: true },
  });

  // Party info — from the linked project's client (client-scoped) or
  // from the lead directly (lead-scoped, FIXES-01 §5.1).
  let clientName   = "—";
  let clientMobile = "";
  let clientEmail: string | null = null;
  let clientGstin: string | null = null;
  let projectName: string | null = null;
  if (row.project) {
    clientName   = row.project.client.name;
    clientMobile = row.project.client.mobile;
    clientEmail  = row.project.client.email;
    clientGstin  = row.project.client.gstin;
    projectName  = row.project.name;
  } else if (row.leadId) {
    const lead = await db.lead.findUnique({
      where:  { id: row.leadId },
      select: { name: true, mobile: true, email: true },
    });
    if (lead) {
      clientName   = lead.name;
      clientMobile = lead.mobile;
      clientEmail  = lead.email;
    }
  }

  return {
    id: row.id,
    number: row.number,
    revision: row.revision,
    status: row.status,
    branchId: row.branchId,
    branchName: branch.name,
    supplierStateCode: branch.stateCode,
    leadId:      row.leadId,
    clientId:    row.clientId,
    clientName,
    clientMobile,
    clientEmail,
    clientGstin,
    projectName,
    projectId:   row.projectId,
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
  // Filter out lead-scoped (no project) — this helper is called with a
  // clientId, and lead-scoped quotes shouldn't appear here anyway (they
  // have leadId set, clientId null, so wouldn't match the where clause).
  // Defensive filter in case of legacy data.
  return rows
    .filter((r): r is typeof r & { project: { id: string; name: string } } => r.project !== null)
    .map((r) => ({
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

// FIXES-01 §7.3 — quick list of open (DRAFT) quotations for the
// PDP's Add-to-Quote modal. Filters to only APPENDABLE states.
export interface OpenQuotationOption {
  id:         string;
  number:     string;
  clientName: string; // "Lead: X" for lead-scoped, "Client: X" otherwise
  total:      bigint;
  date:       Date;
  isLead:     boolean;
}
export async function listOpenQuotationsForAppend(
  ctx: RequestContext,
): Promise<OpenQuotationOption[]> {
  requirePermission(ctx, "quotation.view");
  const db = scoped(ctx);
  const rows = await db.quotation.findMany({
    where:   { status: { in: ["DRAFT", "REVISED"] } },
    orderBy: { date: "desc" },
    take:    25,
    select: {
      id: true, number: true, total: true, date: true,
      leadId: true, clientId: true,
      project: { select: { client: { select: { name: true } } } },
    },
  });
  const leadIds = Array.from(new Set(rows.map((r) => r.leadId).filter((x): x is string => !!x)));
  const leads = leadIds.length > 0
    ? await db.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, name: true } })
    : [];
  const leadName = new Map(leads.map((l) => [l.id, l.name] as const));
  return rows.map((r) => ({
    id:         r.id,
    number:     r.number,
    clientName: r.leadId
      ? `Lead: ${leadName.get(r.leadId) ?? "—"}`
      : `Client: ${r.project?.client.name ?? "—"}`,
    total:      r.total,
    date:       r.date,
    isLead:     !!r.leadId,
  }));
}

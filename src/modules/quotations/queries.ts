import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import type { QuotationStatus } from "./schema";

export interface ListQuotationsQuery {
  search?: string;
  status?: QuotationStatus | "ALL";
  page?: number;
  pageSize?: number;
  sort?: "recent" | "oldest" | "total";
}

export interface QuotationRow {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  date: Date;
  validUntil: Date;
  status: string;
  total: bigint;
  lineCount: number;
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
  clientGstin: string | null;
  projectId: string;
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
        clientId: true,
        project: { select: { client: { select: { name: true } } } },
        _count: { select: { lines: true } },
      },
    }),
    db.quotation.count({ where }),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      number: r.number,
      clientId: r.clientId,
      clientName: r.project.client.name,
      date: r.date,
      validUntil: r.validUntil,
      status: r.status,
      total: r.total,
      lineCount: r._count.lines,
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
          client: { select: { id: true, name: true, mobile: true, gstin: true } },
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
    clientGstin: row.project.client.gstin,
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

// ── helpers ──────────────────────────────────────────────────────────────────

type WhereInput = Record<string, unknown>;

function buildWhere(q: ListQuotationsQuery): WhereInput {
  const where: WhereInput = {};
  if (q.search && q.search.trim().length > 0) {
    const s = q.search.trim();
    where["OR"] = [
      { number: { contains: s, mode: "insensitive" } },
      { project: { client: { name: { contains: s, mode: "insensitive" } } } },
    ];
  }
  if (q.status && q.status !== "ALL") where["status"] = q.status;
  return where;
}

function orderFor(sort: ListQuotationsQuery["sort"]): { [k: string]: "asc" | "desc" } {
  switch (sort) {
    case "oldest": return { date: "asc" };
    case "total":  return { total: "desc" };
    default:       return { date: "desc" };
  }
}

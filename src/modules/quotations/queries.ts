// Quotations repository.

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
  clientName: string;
  clientId: string;
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
  productId: string;
  productCode: string;
  productName: string;
  uom: string;
  description: string;
  quantity: string; // decimal-as-string
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
  clientStateCode: string;
  clientGstin: string | null;
  date: Date;
  validUntil: Date;
  taxableAmount: bigint;
  cgst: bigint;
  sgst: bigint;
  igst: bigint;
  roundOff: bigint;
  total: bigint;
  createdAt: Date;
  updatedAt: Date;
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
        client: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
    }),
    db.quotation.count({ where }),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id, number: r.number,
      clientId: r.client.id, clientName: r.client.name,
      date: r.date, validUntil: r.validUntil,
      status: r.status, total: r.total, lineCount: r._count.lines,
    })),
    total, page, pageSize,
  };
}

export async function getQuotation(ctx: RequestContext, id: string): Promise<QuotationDetail | null> {
  requirePermission(ctx, "quotation.view");
  const db = scoped(ctx);
  const row = await db.quotation.findUnique({
    where: { id },
    select: {
      id: true, number: true, revision: true, status: true, branchId: true,
      date: true, validUntil: true,
      taxableAmount: true, cgst: true, sgst: true, igst: true, roundOff: true, total: true,
      createdAt: true, updatedAt: true,
      client: { select: {
        id: true, name: true, primaryMobile: true, stateCode: true, gstin: true,
      }},
      lines: {
        orderBy: { lineNo: "asc" },
        select: {
          id: true, lineNo: true, description: true, quantity: true, rate: true,
          discountPct: true, taxable: true, gstRate: true,
          cgst: true, sgst: true, igst: true, amount: true, isOptional: true,
          productId: true,
          product: { select: { code: true, name: true, uom: true } },
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
    id: row.id, number: row.number, revision: row.revision, status: row.status,
    branchId: row.branchId, branchName: branch.name, supplierStateCode: branch.stateCode,
    clientId: row.client.id, clientName: row.client.name,
    clientMobile: row.client.primaryMobile,
    clientStateCode: row.client.stateCode, clientGstin: row.client.gstin,
    date: row.date, validUntil: row.validUntil,
    taxableAmount: row.taxableAmount, cgst: row.cgst, sgst: row.sgst, igst: row.igst,
    roundOff: row.roundOff, total: row.total,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
    lines: row.lines.map((l) => ({
      id: l.id, lineNo: l.lineNo, productId: l.productId,
      productCode: l.product.code, productName: l.product.name, uom: l.product.uom,
      description: l.description,
      quantity: l.quantity.toString(),
      rate: l.rate,
      discountPct: l.discountPct.toString(),
      taxable: l.taxable, gstRate: l.gstRate.toString(),
      cgst: l.cgst, sgst: l.sgst, igst: l.igst, amount: l.amount,
      isOptional: l.isOptional,
    })),
  };
}

// ── For the create form ──────────────────────────────────────────

export interface ClientPickerRow {
  id: string; name: string; stateCode: string; mobile: string;
}
export interface ProductPickerRow {
  id: string; code: string; name: string; uom: string; gstRate: number; mrp: bigint | null;
}

export async function listClientsForPicker(ctx: RequestContext): Promise<ClientPickerRow[]> {
  requirePermission(ctx, "client.view");
  const db = scoped(ctx);
  const rows = await db.client.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    take: 200,
    select: { id: true, name: true, stateCode: true, primaryMobile: true },
  });
  return rows.map((r) => ({
    id: r.id, name: r.name, stateCode: r.stateCode, mobile: r.primaryMobile,
  }));
}

export async function listProductsForPicker(ctx: RequestContext): Promise<ProductPickerRow[]> {
  requirePermission(ctx, "catalog.view");
  const db = scoped(ctx);
  const rows = await db.product.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    take: 500,
    select: {
      id: true, code: true, name: true, uom: true, gstRate: true,
      prices: {
        where: { tier: "MRP", effectiveTo: null },
        orderBy: { effectiveFrom: "desc" },
        take: 1,
        select: { amount: true },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id, code: r.code, name: r.name, uom: r.uom, gstRate: Number(r.gstRate),
    mrp: r.prices[0]?.amount ?? null,
  }));
}

// ── helpers ──────────────────────────────────────────────────────

type WhereInput = Record<string, unknown>;

function buildWhere(q: ListQuotationsQuery): WhereInput {
  const where: WhereInput = {};
  if (q.search && q.search.trim().length > 0) {
    const s = q.search.trim();
    where["OR"] = [
      { number: { contains: s, mode: "insensitive" } },
      { client: { name: { contains: s, mode: "insensitive" } } },
    ];
  }
  if (q.status && q.status !== "ALL") where["status"] = q.status;
  return where;
}

function orderFor(sort: ListQuotationsQuery["sort"]): { [k: string]: "asc" | "desc" } | { [k: string]: "asc" | "desc" }[] {
  switch (sort) {
    case "oldest": return { date: "asc" };
    case "total":  return { total: "desc" };
    case "recent":
    default:       return { createdAt: "desc" };
  }
}

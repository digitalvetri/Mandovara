// Invoices repository — read side.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import type { InvoiceStatus } from "./schema";

export interface ListInvoicesQuery {
  search?: string;
  status?: InvoiceStatus | "OUTSTANDING" | "ALL";
  page?: number;
  pageSize?: number;
  sort?: "recent" | "oldest" | "total" | "duesoon";
}

export interface InvoiceRow {
  id: string;
  number: string;
  type: string;
  clientId: string;
  clientName: string;
  date: Date;
  dueDate: Date;
  status: string;
  irnStatus: string;
  total: bigint;
  paidTotal: bigint;
  outstanding: bigint;
  orderNumber: string | null;
  overdueBy: number; // in days; negative if not yet due
}

export interface ListInvoicesResult {
  rows: InvoiceRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface InvoiceLine {
  id: string;
  lineNo: number;
  productId: string;
  productCode: string;
  productName: string;
  uom: string;
  description: string;
  quantity: string;
  rate: bigint;
  discountPct: string;
  taxable: bigint;
  gstRate: string;
  cgst: bigint;
  sgst: bigint;
  igst: bigint;
  amount: bigint;
}

export interface InvoiceDetail {
  id: string;
  number: string;
  type: string;
  status: string;
  irnStatus: string;
  irn: string | null;
  ackNo: string | null;
  ackDate: Date | null;
  clientId: string;
  clientName: string;
  clientMobile: string;
  clientGstin: string | null;
  clientStateCode: string;
  branchId: string;
  branchName: string;
  supplierStateCode: string;
  placeOfSupply: string;
  date: Date;
  dueDate: Date;
  cancelledAt: Date | null;
  cancelReason: string | null;
  taxableAmount: bigint;
  cgst: bigint;
  sgst: bigint;
  igst: bigint;
  roundOff: bigint;
  total: bigint;
  advanceAdjusted: bigint;
  paidTotal: bigint;
  outstanding: bigint;
  orderId: string | null;
  orderNumber: string | null;
  createdAt: Date;
  lines: InvoiceLine[];
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export async function listInvoices(
  ctx: RequestContext,
  q: ListInvoicesQuery,
): Promise<ListInvoicesResult> {
  requirePermission(ctx, "invoice.view");
  const db = scoped(ctx);

  const pageSize = Math.min(q.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const page = Math.max(1, q.page ?? 1);
  const skip = (page - 1) * pageSize;
  const now = new Date();

  const where = buildWhere(q, now);
  const orderBy = orderFor(q.sort);

  const [rows, total] = await Promise.all([
    db.invoice.findMany({
      where, orderBy, skip, take: pageSize,
      select: {
        id: true, number: true, type: true, date: true, dueDate: true,
        status: true, irnStatus: true, total: true, advanceAdjusted: true,
        client: { select: { id: true, name: true } },
        orderId: true,
        allocations: { select: { amount: true } },
      },
    }),
    db.invoice.count({ where }),
  ]);

  return {
    rows: rows.map((r) => {
      const paid = r.allocations.reduce((s, a) => s + a.amount, 0n);
      const outstanding = r.total - r.advanceAdjusted - paid;
      const overdueBy = Math.floor((now.getTime() - r.dueDate.getTime()) / 86_400_000);
      return {
        id: r.id, number: r.number, type: r.type,
        clientId: r.client.id, clientName: r.client.name,
        date: r.date, dueDate: r.dueDate, status: r.status, irnStatus: r.irnStatus,
        total: r.total, paidTotal: paid, outstanding,
        orderNumber: null,
        overdueBy,
      };
    }),
    total, page, pageSize,
  };
}

export async function getInvoice(ctx: RequestContext, id: string): Promise<InvoiceDetail | null> {
  requirePermission(ctx, "invoice.view");
  const db = scoped(ctx);
  const row = await db.invoice.findUnique({
    where: { id },
    select: {
      id: true, number: true, type: true, status: true, branchId: true,
      irnStatus: true, irn: true, ackNo: true, ackDate: true,
      date: true, dueDate: true, placeOfSupply: true,
      cancelledAt: true, cancelReason: true,
      taxableAmount: true, cgst: true, sgst: true, igst: true, roundOff: true, total: true,
      advanceAdjusted: true,
      orderId: true, createdAt: true,
      client: { select: {
        id: true, name: true, primaryMobile: true, stateCode: true, gstin: true,
      }},
      allocations: { select: { amount: true } },
      lines: {
        orderBy: { lineNo: "asc" },
        select: {
          id: true, lineNo: true, description: true, quantity: true, rate: true,
          discountPct: true, taxable: true, gstRate: true,
          cgst: true, sgst: true, igst: true, amount: true,
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

  const orderNumber = row.orderId
    ? (await db.salesOrder.findUnique({
        where: { id: row.orderId },
        select: { number: true },
      }))?.number ?? null
    : null;

  const paid = row.allocations.reduce((s, a) => s + a.amount, 0n);
  const outstanding = row.total - row.advanceAdjusted - paid;

  return {
    id: row.id, number: row.number, type: row.type, status: row.status,
    irnStatus: row.irnStatus, irn: row.irn, ackNo: row.ackNo, ackDate: row.ackDate,
    clientId: row.client.id, clientName: row.client.name,
    clientMobile: row.client.primaryMobile, clientStateCode: row.client.stateCode,
    clientGstin: row.client.gstin,
    branchId: row.branchId, branchName: branch.name, supplierStateCode: branch.stateCode,
    placeOfSupply: row.placeOfSupply,
    date: row.date, dueDate: row.dueDate,
    cancelledAt: row.cancelledAt, cancelReason: row.cancelReason,
    taxableAmount: row.taxableAmount, cgst: row.cgst, sgst: row.sgst, igst: row.igst,
    roundOff: row.roundOff, total: row.total, advanceAdjusted: row.advanceAdjusted,
    paidTotal: paid, outstanding,
    orderId: row.orderId, orderNumber: orderNumber,
    createdAt: row.createdAt,
    lines: row.lines.map((l) => ({
      id: l.id, lineNo: l.lineNo, productId: l.productId,
      productCode: l.product.code, productName: l.product.name, uom: l.product.uom,
      description: l.description,
      quantity: l.quantity.toString(),
      rate: l.rate, discountPct: l.discountPct.toString(),
      taxable: l.taxable, gstRate: l.gstRate.toString(),
      cgst: l.cgst, sgst: l.sgst, igst: l.igst, amount: l.amount,
    })),
  };
}

// ── helpers ──────────────────────────────────────────────────────

type WhereInput = Record<string, unknown>;

function buildWhere(q: ListInvoicesQuery, now: Date): WhereInput {
  const where: WhereInput = {};
  if (q.search && q.search.trim().length > 0) {
    const s = q.search.trim();
    where["OR"] = [
      { number: { contains: s, mode: "insensitive" } },
      { client: { name: { contains: s, mode: "insensitive" } } },
    ];
  }
  if (q.status && q.status !== "ALL") {
    if (q.status === "OUTSTANDING") {
      where["status"] = { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] };
    } else if (q.status === "OVERDUE") {
      where["AND"] = [
        { status: { in: ["ISSUED", "PARTIALLY_PAID"] } },
        { dueDate: { lt: now } },
      ];
    } else {
      where["status"] = q.status;
    }
  }
  return where;
}

function orderFor(sort: ListInvoicesQuery["sort"]): { [k: string]: "asc" | "desc" } {
  switch (sort) {
    case "oldest":   return { date: "asc" };
    case "total":    return { total: "desc" };
    case "duesoon":  return { dueDate: "asc" };
    case "recent":
    default:         return { createdAt: "desc" };
  }
}

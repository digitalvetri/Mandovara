// Sales orders repository — read side.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import type { OrderStatus } from "./schema";

export interface ListOrdersQuery {
  search?: string;
  status?: OrderStatus | "OPEN" | "ALL";
  page?: number;
  pageSize?: number;
  sort?: "recent" | "oldest" | "total";
}

export interface OrderRow {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  date: Date;
  deliveryBy: Date | null;
  status: string;
  total: bigint;
  lineCount: number;
  quotationNumber: string | null;
}

export interface ListOrdersResult {
  rows: OrderRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OrderLine {
  id: string;
  lineNo: number;
  productId: string;
  productCode: string;
  productName: string;
  uom: string;
  description: string;
  orderedQty: string;
  dispatchedQty: string;
  pendingQty: string;
  rate: bigint;
  gstRate: string;
  amount: bigint;
}

export interface DispatchRow {
  id: string;
  number: string;
  dispatchedAt: Date;
  status: string;
  vehicleNumber: string | null;
  transporter: string | null;
  lineCount: number;
}

export interface OrderDetail {
  id: string;
  number: string;
  status: string;
  clientId: string;
  clientName: string;
  clientMobile: string;
  clientStateCode: string;
  branchId: string;
  branchName: string;
  date: Date;
  deliveryBy: Date | null;
  taxableAmount: bigint;
  cgst: bigint;
  sgst: bigint;
  igst: bigint;
  total: bigint;
  quotationId: string | null;
  quotationNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
  lines: OrderLine[];
  dispatches: DispatchRow[];
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export async function listOrders(
  ctx: RequestContext,
  q: ListOrdersQuery,
): Promise<ListOrdersResult> {
  requirePermission(ctx, "order.view");
  const db = scoped(ctx);

  const pageSize = Math.min(q.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const page = Math.max(1, q.page ?? 1);
  const skip = (page - 1) * pageSize;

  const where = buildWhere(q);

  const [rows, total] = await Promise.all([
    db.salesOrder.findMany({
      where,
      orderBy: q.sort === "oldest" ? { date: "asc" }
             : q.sort === "total"  ? { total: "desc" }
             :                       { createdAt: "desc" },
      skip, take: pageSize,
      select: {
        id: true, number: true, date: true, deliveryBy: true, status: true, total: true,
        client: { select: { id: true, name: true } },
        quotation: { select: { number: true } },
        _count: { select: { lines: true } },
      },
    }),
    db.salesOrder.count({ where }),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id, number: r.number,
      clientId: r.client.id, clientName: r.client.name,
      date: r.date, deliveryBy: r.deliveryBy, status: r.status,
      total: r.total, lineCount: r._count.lines,
      quotationNumber: r.quotation?.number ?? null,
    })),
    total, page, pageSize,
  };
}

export async function getOrder(ctx: RequestContext, id: string): Promise<OrderDetail | null> {
  requirePermission(ctx, "order.view");
  const db = scoped(ctx);
  const row = await db.salesOrder.findUnique({
    where: { id },
    select: {
      id: true, number: true, status: true, branchId: true,
      date: true, deliveryBy: true,
      taxableAmount: true, cgst: true, sgst: true, igst: true, total: true,
      quotationId: true, createdAt: true, updatedAt: true,
      client: { select: {
        id: true, name: true, primaryMobile: true, stateCode: true,
      }},
      quotation: { select: { number: true } },
      lines: {
        orderBy: { lineNo: "asc" },
        select: {
          id: true, lineNo: true, description: true,
          orderedQty: true, dispatchedQty: true,
          rate: true, gstRate: true, amount: true,
          productId: true,
          product: { select: { code: true, name: true, uom: true } },
        },
      },
      dispatches: {
        orderBy: { dispatchedAt: "desc" },
        select: {
          id: true, number: true, dispatchedAt: true, status: true,
          vehicleNumber: true, transporter: true,
          _count: { select: { lines: true } },
        },
      },
    },
  });
  if (!row) return null;

  const branch = await db.branch.findUniqueOrThrow({
    where: { id: row.branchId },
    select: { name: true },
  });

  return {
    id: row.id, number: row.number, status: row.status,
    clientId: row.client.id, clientName: row.client.name,
    clientMobile: row.client.primaryMobile, clientStateCode: row.client.stateCode,
    branchId: row.branchId, branchName: branch.name,
    date: row.date, deliveryBy: row.deliveryBy,
    taxableAmount: row.taxableAmount, cgst: row.cgst, sgst: row.sgst, igst: row.igst,
    total: row.total,
    quotationId: row.quotationId, quotationNumber: row.quotation?.number ?? null,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
    lines: row.lines.map((l) => {
      const ordered  = l.orderedQty.toString();
      const dispatched = l.dispatchedQty.toString();
      const pending = subtractDecimalStrings(ordered, dispatched);
      return {
        id: l.id, lineNo: l.lineNo, productId: l.productId,
        productCode: l.product.code, productName: l.product.name, uom: l.product.uom,
        description: l.description,
        orderedQty: ordered, dispatchedQty: dispatched, pendingQty: pending,
        rate: l.rate, gstRate: l.gstRate.toString(), amount: l.amount,
      };
    }),
    dispatches: row.dispatches.map((d) => ({
      id: d.id, number: d.number, dispatchedAt: d.dispatchedAt, status: d.status,
      vehicleNumber: d.vehicleNumber, transporter: d.transporter,
      lineCount: d._count.lines,
    })),
  };
}

export interface AcceptedQuotationOption {
  id: string;
  number: string;
  clientName: string;
  total: bigint;
  date: Date;
}

export async function listAcceptedQuotations(ctx: RequestContext): Promise<AcceptedQuotationOption[]> {
  requirePermission(ctx, "order.create");
  const db = scoped(ctx);
  const rows = await db.quotation.findMany({
    where: { status: "ACCEPTED" },
    orderBy: { date: "desc" },
    take: 200,
    select: {
      id: true, number: true, total: true, date: true,
      client: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id, number: r.number, clientName: r.client.name,
    total: r.total, date: r.date,
  }));
}

// ── helpers ──────────────────────────────────────────────────────

type WhereInput = Record<string, unknown>;

function buildWhere(q: ListOrdersQuery): WhereInput {
  const where: WhereInput = {};
  if (q.search && q.search.trim().length > 0) {
    const s = q.search.trim();
    where["OR"] = [
      { number: { contains: s, mode: "insensitive" } },
      { client: { name: { contains: s, mode: "insensitive" } } },
    ];
  }
  if (q.status && q.status !== "ALL") {
    if (q.status === "OPEN") {
      where["status"] = { in: ["CONFIRMED", "PARTIAL_DISPATCH"] };
    } else {
      where["status"] = q.status;
    }
  }
  return where;
}

// Small decimal subtraction helper for display purposes. Works up to 4dp.
function subtractDecimalStrings(a: string, b: string): string {
  const scale = 10_000;
  const ai = Math.round(parseFloat(a) * scale);
  const bi = Math.round(parseFloat(b) * scale);
  const diff = ai - bi;
  const whole = Math.trunc(diff / scale);
  const frac = Math.abs(diff % scale).toString().padStart(4, "0").replace(/0+$/, "");
  return frac.length === 0 ? String(whole) : `${whole}.${frac}`;
}

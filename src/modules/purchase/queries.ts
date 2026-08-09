// Purchase orders repository.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import type { POStatus } from "./schema";

export interface ListPOQuery {
  search?: string;
  status?: POStatus | "OPEN" | "ALL";
  page?: number;
  pageSize?: number;
}

export interface PORow {
  id: string;
  number: string;
  vendorId: string;
  vendorName: string;
  date: Date;
  expectedDate: Date | null;
  status: string;
  total: bigint;
  lineCount: number;
}

export interface ListPOResult {
  rows: PORow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface POLineRow {
  id: string;
  lineNo: number;
  productId: string;
  productCode: string;
  productName: string;
  uom: string;
  trackBatch: boolean;
  description: string;
  orderedQty: string;
  receivedQty: string;
  pendingQty: string;
  rate: bigint;
  gstRate: string;
  amount: bigint;
}

export interface GRNRow {
  id: string;
  number: string;
  receivedAt: Date;
  status: string;
  vehicleNumber: string | null;
  invoiceRef: string | null;
  lineCount: number;
  totalValue: bigint;
}

export interface PODetail {
  id: string;
  number: string;
  status: string;
  vendorId: string;
  vendorName: string;
  vendorMobile: string;
  branchId: string;
  branchName: string;
  date: Date;
  expectedDate: Date | null;
  taxableAmount: bigint;
  cgst: bigint;
  sgst: bigint;
  igst: bigint;
  total: bigint;
  lines: POLineRow[];
  grns: GRNRow[];
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export async function listPOs(ctx: RequestContext, q: ListPOQuery): Promise<ListPOResult> {
  requirePermission(ctx, "po.view");
  const db = scoped(ctx);

  const pageSize = Math.min(q.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const page = Math.max(1, q.page ?? 1);
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (q.search && q.search.trim().length > 0) {
    const s = q.search.trim();
    where["OR"] = [
      { number: { contains: s, mode: "insensitive" } },
      { vendor: { name: { contains: s, mode: "insensitive" } } },
    ];
  }
  if (q.status && q.status !== "ALL") {
    if (q.status === "OPEN") where["status"] = { in: ["ISSUED", "PARTIAL_RECEIVED"] };
    else where["status"] = q.status;
  }

  const [rows, total] = await Promise.all([
    db.purchaseOrder.findMany({
      where, orderBy: { createdAt: "desc" }, skip, take: pageSize,
      select: {
        id: true, number: true, date: true, expectedDate: true,
        status: true, total: true,
        vendor: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
    }),
    db.purchaseOrder.count({ where }),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id, number: r.number,
      vendorId: r.vendor.id, vendorName: r.vendor.name,
      date: r.date, expectedDate: r.expectedDate, status: r.status,
      total: r.total, lineCount: r._count.lines,
    })),
    total, page, pageSize,
  };
}

export async function getPO(ctx: RequestContext, id: string): Promise<PODetail | null> {
  requirePermission(ctx, "po.view");
  const db = scoped(ctx);
  const row = await db.purchaseOrder.findUnique({
    where: { id },
    select: {
      id: true, number: true, status: true, branchId: true,
      date: true, expectedDate: true,
      taxableAmount: true, cgst: true, sgst: true, igst: true, total: true,
      vendor: { select: { id: true, name: true, mobile: true } },
      lines: {
        orderBy: { lineNo: "asc" },
        select: {
          id: true, lineNo: true, description: true, quantity: true, receivedQty: true,
          rate: true, gstRate: true, amount: true, productId: true,
          product: { select: { code: true, name: true, uom: true, trackBatch: true } },
        },
      },
      grns: {
        orderBy: { receivedAt: "desc" },
        select: {
          id: true, number: true, receivedAt: true, status: true,
          vehicleNumber: true, invoiceRef: true, totalValue: true,
          _count: { select: { lines: true } },
        },
      },
    },
  });
  if (!row) return null;
  const branch = await db.branch.findUniqueOrThrow({
    where: { id: row.branchId }, select: { name: true },
  });
  return {
    id: row.id, number: row.number, status: row.status,
    vendorId: row.vendor.id, vendorName: row.vendor.name, vendorMobile: row.vendor.mobile,
    branchId: row.branchId, branchName: branch.name,
    date: row.date, expectedDate: row.expectedDate,
    taxableAmount: row.taxableAmount, cgst: row.cgst, sgst: row.sgst, igst: row.igst,
    total: row.total,
    lines: row.lines.map((l) => {
      const ordered = l.quantity.toString();
      const received = l.receivedQty.toString();
      const pending = subDec(ordered, received);
      return {
        id: l.id, lineNo: l.lineNo, productId: l.productId,
        productCode: l.product.code, productName: l.product.name, uom: l.product.uom,
        trackBatch: l.product.trackBatch,
        description: l.description,
        orderedQty: ordered, receivedQty: received, pendingQty: pending,
        rate: l.rate, gstRate: l.gstRate.toString(), amount: l.amount,
      };
    }),
    grns: row.grns.map((g) => ({
      id: g.id, number: g.number, receivedAt: g.receivedAt, status: g.status,
      vehicleNumber: g.vehicleNumber, invoiceRef: g.invoiceRef,
      lineCount: g._count.lines, totalValue: g.totalValue,
    })),
  };
}

function subDec(a: string, b: string): string {
  const scale = 10_000;
  const ai = Math.round(parseFloat(a) * scale);
  const bi = Math.round(parseFloat(b) * scale);
  const diff = ai - bi;
  const whole = Math.trunc(diff / scale);
  const frac = Math.abs(diff % scale).toString().padStart(4, "0").replace(/0+$/, "");
  return frac.length === 0 ? String(whole) : `${whole}.${frac}`;
}

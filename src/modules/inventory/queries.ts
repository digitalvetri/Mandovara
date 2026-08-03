// Inventory repository.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface ListBalancesQuery {
  warehouseId?: string | "ALL";
  search?: string;
  page?: number;
  pageSize?: number;
  onlyLow?: boolean; // reorder-level flag
}

export interface BalanceRow {
  productId: string;
  productCode: string;
  productName: string;
  uom: string;
  warehouseId: string;
  warehouseName: string;
  quantity: string; // decimal string
  reserved: string;
  available: string;
  value: bigint;
  reorderLevel: string | null;
  isLow: boolean;
}

export interface ListBalancesResult {
  rows: BalanceRow[];
  total: number;
  page: number;
  pageSize: number;
  warehouses: { id: string; name: string }[];
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export async function listBalances(
  ctx: RequestContext,
  q: ListBalancesQuery,
): Promise<ListBalancesResult> {
  requirePermission(ctx, "inventory.view");
  const db = scoped(ctx);

  const pageSize = Math.min(q.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const page = Math.max(1, q.page ?? 1);
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (q.warehouseId && q.warehouseId !== "ALL") where["warehouseId"] = q.warehouseId;
  if (q.search && q.search.trim().length > 0) {
    const s = q.search.trim();
    where["product"] = {
      OR: [
        { code: { contains: s, mode: "insensitive" } },
        { name: { contains: s, mode: "insensitive" } },
      ],
    };
  }

  const [rows, total, warehouses] = await Promise.all([
    db.stockBalance.findMany({
      where, orderBy: { updatedAt: "desc" }, skip, take: pageSize,
      select: {
        productId: true, warehouseId: true,
        quantity: true, reserved: true, value: true,
        product:   { select: { code: true, name: true, uom: true, reorderLevel: true } },
        warehouse: { select: { name: true } },
      },
    }),
    db.stockBalance.count({ where }),
    db.warehouse.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const mapped: BalanceRow[] = rows.map((r) => {
    const qty = r.quantity.toString();
    const reserved = r.reserved.toString();
    const available = subtractDec(qty, reserved);
    const reorder = r.product.reorderLevel?.toString() ?? null;
    const isLow = reorder != null && parseFloat(available) < parseFloat(reorder);
    return {
      productId: r.productId, productCode: r.product.code, productName: r.product.name,
      uom: r.product.uom,
      warehouseId: r.warehouseId, warehouseName: r.warehouse.name,
      quantity: qty, reserved, available, value: r.value,
      reorderLevel: reorder, isLow,
    };
  });

  return {
    rows: q.onlyLow ? mapped.filter((r) => r.isLow) : mapped,
    total: q.onlyLow ? mapped.filter((r) => r.isLow).length : total,
    page, pageSize, warehouses,
  };
}

export interface LedgerRow {
  id: string;
  occurredAt: Date;
  direction: string;
  quantity: string;
  rate: bigint;
  refType: string;
  refId: string;
  warehouseName: string;
  runningBalance: string;
}

export async function listLedgerForProduct(
  ctx: RequestContext,
  productId: string,
  warehouseId?: string,
): Promise<LedgerRow[]> {
  requirePermission(ctx, "inventory.view");
  const db = scoped(ctx);
  const where: Record<string, unknown> = { productId };
  if (warehouseId) where["warehouseId"] = warehouseId;
  const rows = await db.stockLedgerEntry.findMany({
    where,
    orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
    take: 500,
    select: {
      id: true, occurredAt: true, direction: true, quantity: true, rate: true,
      refType: true, refId: true,
      warehouse: { select: { name: true } },
    },
  });
  // Running balance per warehouse.
  const runningByWh = new Map<string, number>();
  const out: LedgerRow[] = [];
  for (const r of rows) {
    const wh = r.warehouse.name;
    const cur = runningByWh.get(wh) ?? 0;
    const q = Number(r.quantity);
    const next = r.direction === "IN" ? cur + q : cur - q;
    runningByWh.set(wh, next);
    out.push({
      id: r.id, occurredAt: r.occurredAt, direction: r.direction,
      quantity: r.quantity.toString(), rate: r.rate,
      refType: r.refType, refId: r.refId, warehouseName: wh,
      runningBalance: next.toString(),
    });
  }
  return out.reverse(); // most recent first for display
}

export interface ProductPickerRow {
  id: string; code: string; name: string; uom: string;
}
export async function listProductsForAdjustment(ctx: RequestContext): Promise<ProductPickerRow[]> {
  requirePermission(ctx, "catalog.view");
  const db = scoped(ctx);
  const rows = await db.product.findMany({
    where: { status: "ACTIVE" },
    orderBy: { code: "asc" },
    take: 500,
    select: { id: true, code: true, name: true, uom: true },
  });
  return rows;
}
export async function listWarehouses(ctx: RequestContext): Promise<{ id: string; name: string }[]> {
  requirePermission(ctx, "inventory.view");
  const db = scoped(ctx);
  return db.warehouse.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

// ── helpers ──────────────────────────────────────────────────────

function subtractDec(a: string, b: string): string {
  const scale = 10_000;
  const ai = Math.round(parseFloat(a) * scale);
  const bi = Math.round(parseFloat(b) * scale);
  const diff = ai - bi;
  const whole = Math.trunc(diff / scale);
  const frac = Math.abs(diff % scale).toString().padStart(4, "0").replace(/0+$/, "");
  return frac.length === 0 ? String(whole) : `${whole}.${frac}`;
}

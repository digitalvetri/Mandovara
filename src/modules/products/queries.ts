// Products repository. All reads through db.scoped(ctx).

import { scoped } from "@/kernel/db/scoped";
import { requirePermission, can } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import type { ProductStatus } from "./schema";

export interface ListProductsQuery {
  search?: string;
  categoryId?: string | "ALL";
  status?: ProductStatus | "ALL";
  page?: number;
  pageSize?: number;
  sort?: "recent" | "code" | "name";
}

export interface ProductRow {
  id: string;
  code: string;
  name: string;
  categoryName: string;
  hsn: string;
  uom: string;
  gstRate: number;
  status: string;
  /** Latest MRP (highest-tier price with no effectiveTo). Null if none set. */
  mrp: bigint | null;
  /** Cost — only present when caller has product.viewCost. */
  cost: bigint | null;
  updatedAt: Date;
}

export interface ListProductsResult {
  rows: ProductRow[];
  total: number;
  page: number;
  pageSize: number;
  categories: CategoryOption[];
}

export interface CategoryOption {
  id: string;
  name: string;
  productCount: number;
}

export interface ProductDetail extends ProductRow {
  categoryId: string;
  uomPrecision: number;
  reorderLevel: string | null;
  minStock: string | null;
  trackBatch: boolean;
  trackSerial: boolean;
  createdAt: Date;
  prices: { tier: string; amount: bigint; effectiveFrom: Date }[];
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export async function listProducts(
  ctx: RequestContext,
  q: ListProductsQuery,
): Promise<ListProductsResult> {
  requirePermission(ctx, "catalog.view");
  const db = scoped(ctx);

  const pageSize = Math.min(q.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const page = Math.max(1, q.page ?? 1);
  const skip = (page - 1) * pageSize;

  const where = buildWhere(q);
  const orderBy = orderFor(q.sort);
  const canSeeCost = can(ctx, "catalog.viewCost");

  const [rows, total, categories] = await Promise.all([
    db.product.findMany({
      where, orderBy, skip, take: pageSize,
      select: {
        id: true, code: true, name: true, hsn: true, uom: true,
        gstRate: true, status: true, updatedAt: true,
        category: { select: { id: true, name: true } },
        prices: {
          where: { effectiveTo: null, tier: { in: canSeeCost ? ["MRP", "COST"] : ["MRP"] } },
          orderBy: { effectiveFrom: "desc" },
          take: canSeeCost ? 4 : 2,
          select: { tier: true, amount: true },
        },
      },
    }),
    db.product.count({ where }),
    listCategories(ctx),
  ]);

  return {
    rows: rows.map((r) => {
      const mrp  = r.prices.find((p) => p.tier === "MRP")?.amount  ?? null;
      const cost = canSeeCost
        ? (r.prices.find((p) => p.tier === "COST")?.amount ?? null)
        : null;
      return {
        id: r.id, code: r.code, name: r.name,
        categoryName: r.category.name,
        hsn: r.hsn, uom: r.uom, gstRate: Number(r.gstRate),
        status: r.status, mrp, cost, updatedAt: r.updatedAt,
      };
    }),
    total, page, pageSize, categories,
  };
}

export async function listCategories(ctx: RequestContext): Promise<CategoryOption[]> {
  requirePermission(ctx, "catalog.view");
  const db = scoped(ctx);
  const cats = await db.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, _count: { select: { products: true } } },
  });
  return cats.map((c) => ({ id: c.id, name: c.name, productCount: c._count.products }));
}

export async function getProduct(ctx: RequestContext, id: string): Promise<ProductDetail | null> {
  requirePermission(ctx, "catalog.view");
  const db = scoped(ctx);
  const canSeeCost = can(ctx, "catalog.viewCost");

  const row = await db.product.findUnique({
    where: { id },
    select: {
      id: true, code: true, name: true, hsn: true, uom: true, uomPrecision: true,
      gstRate: true, status: true, reorderLevel: true, minStock: true,
      trackBatch: true, trackSerial: true, createdAt: true, updatedAt: true,
      category: { select: { id: true, name: true } },
      prices: {
        where: canSeeCost ? {} : { tier: { in: ["MRP", "DEALER", "DISTRIBUTOR", "PROJECT"] } },
        orderBy: { effectiveFrom: "desc" },
        select: { tier: true, amount: true, effectiveFrom: true },
      },
    },
  });
  if (!row) return null;

  const mrp  = row.prices.find((p) => p.tier === "MRP")?.amount  ?? null;
  const cost = canSeeCost ? (row.prices.find((p) => p.tier === "COST")?.amount ?? null) : null;

  return {
    id: row.id, code: row.code, name: row.name,
    categoryId: row.category.id, categoryName: row.category.name,
    hsn: row.hsn, uom: row.uom, uomPrecision: row.uomPrecision,
    gstRate: Number(row.gstRate), status: row.status,
    reorderLevel: row.reorderLevel?.toString() ?? null,
    minStock:     row.minStock?.toString() ?? null,
    trackBatch: row.trackBatch, trackSerial: row.trackSerial,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
    mrp, cost,
    prices: row.prices,
  };
}

// ── helpers ──────────────────────────────────────────────────────

type WhereInput = Record<string, unknown>;

function buildWhere(q: ListProductsQuery): WhereInput {
  const where: WhereInput = {};
  if (q.search && q.search.trim().length > 0) {
    const s = q.search.trim();
    where["OR"] = [
      { code: { contains: s, mode: "insensitive" } },
      { name: { contains: s, mode: "insensitive" } },
      { hsn:  { contains: s } },
    ];
  }
  if (q.categoryId && q.categoryId !== "ALL") where["categoryId"] = q.categoryId;
  if (q.status && q.status !== "ALL")         where["status"] = q.status;
  return where;
}

function orderFor(sort: ListProductsQuery["sort"]): { [k: string]: "asc" | "desc" } {
  switch (sort) {
    case "code":   return { code: "asc" };
    case "name":   return { name: "asc" };
    case "recent":
    default:       return { updatedAt: "desc" };
  }
}

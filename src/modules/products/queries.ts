// @ts-nocheck
// Products page repository — delegates to the catalog module's searchDesigns.
// The /products route is the catalog surface: Brand → Collection → Design → Colourway.
// The legacy "Product" model never existed in this schema; catalog IS the product list.

import { requirePermission, can } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import { scoped } from "@/kernel/db/scoped";
import { searchDesigns, listBrands } from "@/modules/catalog/queries";

export interface ListProductsQuery {
  search?: string;
  categoryId?: string | "ALL";    // treated as brandId in catalog
  status?: string | "ALL";        // "ACTIVE" | "INACTIVE" | "ALL"
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
  mrp: bigint | null;
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

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export async function listProducts(
  ctx: RequestContext,
  q: ListProductsQuery,
): Promise<ListProductsResult> {
  requirePermission(ctx, "catalog.view");
  const canSeeCost = can(ctx, "catalog.viewCost");

  const pageSize = Math.min(q.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const page = Math.max(1, q.page ?? 1);

  // Parallelize: design search + brand list run concurrently
  const [result, brands] = await Promise.all([
    searchDesigns(ctx, {
      q: q.search,
      brandId: q.categoryId && q.categoryId !== "ALL" ? q.categoryId : undefined,
      page,
      pageSize,
    }),
    listBrands(ctx),
  ]);

  const rows: ProductRow[] = result.designs.flatMap((design) =>
    design.colourways.map((cw) => {
      const prices = cw.prices ?? [];
      const mrp  = prices.find((p) => p.tier === "RETAIL" || p.tier === "MRP")?.amount ?? null;
      const cost = canSeeCost
        ? (prices.find((p) => p.tier === "COST")?.amount ?? null)
        : null;

      return {
        id:           cw.id,
        code:         cw.code,
        name:         `${design.name} — ${cw.colourName}`,
        categoryName: `${design.collection.brand.name} › ${design.collection.name}`,
        hsn:          design.hsn,
        uom:          cw.sellUnit,
        gstRate:      Number(design.gstRate),
        status:       design.isActive && cw.isActive ? "ACTIVE" : "INACTIVE",
        mrp,
        cost,
        updatedAt:    new Date(),
      };
    }),
  );
  const categories: CategoryOption[] = brands.map((b) => ({
    id:           b.id,
    name:         b.name,
    productCount: b._count.collections,
  }));

  return { rows, total: result.total, page, pageSize, categories };
}

export async function listCategories(ctx: RequestContext): Promise<CategoryOption[]> {
  requirePermission(ctx, "catalog.view");
  const brands = await listBrands(ctx);
  return brands.map((b) => ({
    id:           b.id,
    name:         b.name,
    productCount: b._count.collections,
  }));
}

// Read a single "product" — the Colourway is the sellable SKU per
// CLAUDE.md §5. Maps the canonical Brand→Collection→Design→Colourway
// shape into the legacy ProductDetail interface the /products/[id]
// page expects. Fields the canonical schema doesn't carry
// (uomPrecision, reorderLevel, minStock, trackBatch, trackSerial)
// come back as null/false — the form still renders and edits are a
// no-op until the /products page is rewritten against canonical.
export async function getProduct(ctx: RequestContext, id: string): Promise<ProductDetail | null> {
  requirePermission(ctx, "catalog.view");
  const canSeeCost = can(ctx, "catalog.viewCost");
  const db = scoped(ctx);
  const cw = await db.colourway.findUnique({
    where:  { id },
    select: {
      id: true, code: true, colourName: true, sellUnit: true, isActive: true,
      imageKey: true, hex: true,
      design: {
        select: {
          name: true, hsn: true, gstRate: true, isActive: true,
          collection: {
            select: {
              name: true,
              brand: { select: { id: true, name: true } },
            },
          },
        },
      },
      prices: {
        orderBy: { effectiveFrom: "desc" },
        select:  { tier: true, amount: true, effectiveFrom: true, effectiveTo: true },
      },
    },
  });
  if (!cw) return null;

  const now = new Date();
  const activePrices = cw.prices.filter(
    (p) => p.effectiveFrom <= now && (p.effectiveTo == null || p.effectiveTo >= now),
  );
  const mrp  = activePrices.find((p) => p.tier === "RETAIL" || p.tier === "MRP")?.amount ?? null;
  const cost = canSeeCost
    ? (activePrices.find((p) => p.tier === "COST")?.amount ?? null)
    : null;

  return {
    id:            cw.id,
    code:          cw.code,
    name:          `${cw.design.name} — ${cw.colourName}`,
    categoryName:  `${cw.design.collection.brand.name} › ${cw.design.collection.name}`,
    hsn:           cw.design.hsn,
    uom:           cw.sellUnit,
    uomPrecision:  2,
    gstRate:       Number(cw.design.gstRate),
    status:        cw.design.isActive && cw.isActive ? "ACTIVE" : "INACTIVE",
    mrp,
    cost,
    reorderLevel:  null,
    minStock:      null,
    trackBatch:    false,
    trackSerial:   false,
    prices:        activePrices.map((p) => ({
      tier:          p.tier,
      amount:        p.amount,
      effectiveFrom: p.effectiveFrom,
    })),
  };
}

// Product detail shape expected by /products/[id]. Kept loose to
// carry both real Colourway data and legacy field slots the form
// still asks about.
export interface ProductDetail {
  id:            string;
  code:          string;
  name:          string;
  categoryName:  string;
  hsn:           string;
  uom:           string;
  uomPrecision:  number;
  gstRate:       number;
  status:        string;
  mrp:           bigint | null;
  cost:          bigint | null;
  reorderLevel:  string | null;
  minStock:      string | null;
  trackBatch:    boolean;
  trackSerial:   boolean;
  prices:        { tier: string; amount: bigint; effectiveFrom: Date }[];
}

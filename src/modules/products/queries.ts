// @ts-nocheck
// Products page repository — delegates to the catalog module's searchDesigns.
// The /products route is the catalog surface: Brand → Collection → Design → Colourway.
// The legacy "Product" model never existed in this schema; catalog IS the product list.

import { requirePermission, can } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import { scoped } from "@/kernel/db/scoped";
import { searchDesigns } from "@/modules/catalog/queries";
import { ProductFamilyEnum } from "@/modules/catalog/schema";

// Product-family labels used in the category dropdown. Trade-friendly
// names — the enum key (CARPET_ROLL) is invisible in the UI.
const FAMILY_LABEL: Readonly<Record<string, string>> = {
  CURTAIN_FABRIC: "Curtains",
  SHEER: "Sheer Curtains",
  LINING: "Curtain Lining",
  BLIND: "Blinds",
  WALLPAPER: "Wallpaper",
  FLOORING: "Flooring",
  CARPET_ROLL: "Carpets",
  CARPET_TILE: "Carpet Tiles",
  RUG: "Rugs",
  UPHOLSTERY_FABRIC: "Upholstery Fabric",
  FOAM_FILLING: "Foam & Filling",
  VERTICAL_GARDEN: "Vertical Garden",
  INTERIOR_FILM: "Interior Films",
  MURAL: "Murals & Art",
  HARDWARE_TRACK: "Curtain Tracks",
  HARDWARE_ROD: "Curtain Rods",
  MOTOR: "Motors",
  ACCESSORY: "Accessories",
  SERVICE: "Services",
};

export interface ListProductsQuery {
  search?: string;
  categoryId?: string | "ALL";    // product family enum value (WALLPAPER, BLIND, …)
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
  imageKey: string | null;
  hex: string | null;
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

  // categoryId now carries a product-family enum value (WALLPAPER, BLIND, …).
  const familyFilter = q.categoryId && q.categoryId !== "ALL"
    ? (ProductFamilyEnum.safeParse(q.categoryId).success ? q.categoryId : undefined)
    : undefined;

  // Parallelize: design search + family counts run concurrently
  const [result, families] = await Promise.all([
    searchDesigns(ctx, {
      q: q.search,
      family: familyFilter,
      page,
      pageSize,
    }),
    familyCounts(ctx),
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
        categoryName: FAMILY_LABEL[design.family] ?? design.family,
        hsn:          design.hsn,
        uom:          cw.sellUnit,
        gstRate:      Number(design.gstRate),
        status:       design.isActive && cw.isActive ? "ACTIVE" : "INACTIVE",
        mrp,
        cost,
        imageKey:     cw.imageKey ?? null,
        hex:          cw.hex ?? null,
        updatedAt:    new Date(),
      };
    }),
  );

  return { rows, total: result.total, page, pageSize, categories: families };
}

export async function listCategories(ctx: RequestContext): Promise<CategoryOption[]> {
  requirePermission(ctx, "catalog.view");
  return familyCounts(ctx);
}

// Family-level counts for the /products category dropdown.
// Groups Designs by their ProductFamily and returns one CategoryOption per
// family that actually has designs in the DB — no empty categories.
async function familyCounts(ctx: RequestContext): Promise<CategoryOption[]> {
  const db = scoped(ctx);
  const rows = await db.design.groupBy({
    by: ["family"],
    _count: { _all: true },
    where: { isActive: true },
  });
  return rows
    .map((r) => ({
      id:           r.family,
      name:         FAMILY_LABEL[r.family] ?? r.family,
      productCount: r._count._all,
    }))
    .sort((a, b) => b.productCount - a.productCount);
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
          name: true, family: true, hsn: true, gstRate: true, isActive: true,
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
    imageKey:      cw.imageKey,
    hex:           cw.hex,
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
  imageKey:      string | null;
  hex:           string | null;
  trackBatch:    boolean;
  trackSerial:   boolean;
  prices:        { tier: string; amount: bigint; effectiveFrom: Date }[];
}

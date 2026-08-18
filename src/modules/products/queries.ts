/* eslint-disable max-lines -- FIXME(§10): 608 lines, limit 300. Split by concern before the next phase; the rule stays enforced so this stays visible. */
// Products page repository — delegates to the catalog module's searchDesigns.
// /products is the catalog surface: Brand → Collection → Design → Colourway.

import { requirePermission, can } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import { scoped } from "@/kernel/db/scoped";
import { searchDesigns } from "@/modules/catalog/queries";
import { ProductFamilyEnum } from "@/modules/catalog/schema";

// Trade-friendly labels for the category rail — enum keys never surface in UI.
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

// Families where dye-lot mismatch is a real risk (CLAUDE.md §0.6).
// The card renders a dye-lot pin only when the family is in this set
// AND the colourway actually has stock with a dye lot recorded.
const DYE_LOT_SENSITIVE = new Set<string>([
  "WALLPAPER", "CARPET_ROLL", "CARPET_TILE", "RUG",
  "CURTAIN_FABRIC", "SHEER", "UPHOLSTERY_FABRIC",
]);


export interface ListProductsQuery {
  search?:        string;
  categoryId?:    string | "ALL";    // ProductFamily enum value
  brandId?:       string | "ALL";
  status?:        string | "ALL";
  inStockOnly?:   boolean;
  priceMinPaise?: bigint;
  priceMaxPaise?: bigint;
  page?:          number;
  pageSize?:      number;
  sort?:          "recent" | "code" | "name" | "price_asc" | "price_desc";
}

export interface ProductRow {
  id:            string;
  code:          string;
  name:          string;
  brand:         string;
  collectionName:string;
  family:        string;       // enum key, e.g. "WALLPAPER"
  familyLabel:   string;       // display, e.g. "Wallpaper"
  categoryName:  string;       // familyLabel — kept for backwards compat
  hsn:           string;
  uom:           string;
  gstRate:       number;
  status:        string;
  mrp:           bigint | null;
  cost:          bigint | null;
  imageKey:      string | null;
  hex:           string | null;
  inStock:       boolean;
  dyeLotHint:    string | null;   // short lot label to render in the pin
  isNew:         boolean;         // reserved for a future NEW pill; always false until Design.createdAt exists
  updatedAt:     Date;
}

export interface CategoryOption {
  id:           string;
  name:         string;
  productCount: number;
}

export interface BrandOption {
  id:           string;
  name:         string;
  productCount: number;
}

export interface PriceBand {
  minPaise: bigint;
  maxPaise: bigint;
}

export interface ListProductsResult {
  rows:       ProductRow[];
  total:      number;
  page:       number;
  pageSize:   number;
  categories: CategoryOption[];
  brands:     BrandOption[];
  priceBand:  PriceBand;
}

const DEFAULT_PAGE_SIZE = 24;   // 4×6 grid at 1440
const MAX_PAGE_SIZE = 96;

export async function listProducts(
  ctx: RequestContext,
  q: ListProductsQuery,
): Promise<ListProductsResult> {
  requirePermission(ctx, "catalog.view");
  const canSeeCost = can(ctx, "catalog.viewCost");

  const pageSize = Math.min(q.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const page = Math.max(1, q.page ?? 1);

  // Narrow through the parse result so the value is a ProductFamily, not a
  // bare string — safeParse().success alone does not narrow q.categoryId.
  const familyParse = q.categoryId && q.categoryId !== "ALL"
    ? ProductFamilyEnum.safeParse(q.categoryId)
    : null;
  const familyFilter = familyParse?.success ? familyParse.data : undefined;
  const brandFilter = q.brandId && q.brandId !== "ALL" ? q.brandId : undefined;

  const [result, families, brands, priceBand] = await Promise.all([
    searchDesigns(ctx, {
      q:             q.search,
      family:        familyFilter,
      brandId:       brandFilter,
      inStock:       q.inStockOnly === true ? true : undefined,
      priceMinPaise: q.priceMinPaise,
      priceMaxPaise: q.priceMaxPaise,
      page,
      pageSize,
    }),
    familyCounts(ctx),
    brandCounts(ctx),
    priceRange(ctx),
  ]);

  const rows: ProductRow[] = result.designs.flatMap((design) =>
    design.colourways.map((cw) => {
      const prices = cw.prices ?? [];
      const mrp  = prices.find((p) => p.tier === "RETAIL" || p.tier === "MRP")?.amount ?? null;
      const cost = canSeeCost
        ? (prices.find((p) => p.tier === "COST")?.amount ?? null)
        : null;

      // In-stock = any dye lot has quantity − reserved > 0
      const stockRows = cw.stock ?? [];
      const availableStock = stockRows.filter(
        (s) => Number(s.quantity ?? 0) - Number(s.reserved ?? 0) > 0,
      );
      const inStock = availableStock.length > 0;

      // Dye-lot hint: only for dye-lot-sensitive families with real
      // stock data. Show the first available lot's short label (last
      // 3 chars of the lot code), or "MIX" if multiple lots available.
      let dyeLotHint: string | null = null;
      if (DYE_LOT_SENSITIVE.has(design.family)) {
        const lots = availableStock
          .map((s) => s.dyeLot as string | null)
          .filter((l): l is string => typeof l === "string" && l.length > 0);
        if (lots.length === 1) {
          dyeLotHint = shortenLot(lots[0]!);
        } else if (lots.length > 1) {
          dyeLotHint = "MIX";
        }
      }

      // Design has no createdAt column — see note in getProduct.
      const isNew = false;

      const familyLabel = FAMILY_LABEL[design.family] ?? design.family;
      const brandName   = design.collection.brand.name;
      const collName    = design.collection.name;

      return {
        id:             cw.id,
        code:           cw.code,
        name:           cw.colourName && cw.colourName !== "Standard"
                          ? `${design.name} — ${cw.colourName}`
                          : design.name,
        brand:          brandName,
        collectionName: collName,
        family:         design.family,
        familyLabel,
        categoryName:   familyLabel,
        hsn:            design.hsn,
        uom:            cw.sellUnit,
        gstRate:        Number(design.gstRate),
        status:         design.isActive && cw.isActive ? "ACTIVE" : "INACTIVE",
        mrp,
        cost,
        imageKey:       cw.imageKey ?? null,
        hex:            cw.hex ?? null,
        inStock,
        dyeLotHint,
        isNew,
        updatedAt:      new Date(),
      };
    }),
  );

  // Sort at row-level so price sorting works across colourways within
  // the returned page. (The DB fetch is design-name ASC.)
  const sorted = sortRows(rows, q.sort ?? "name");

  return {
    rows:       sorted,
    total:      result.total,
    page,
    pageSize,
    categories: families,
    brands,
    priceBand,
  };
}

function sortRows(rows: ProductRow[], sort: NonNullable<ListProductsQuery["sort"]>): ProductRow[] {
  const out = rows.slice();
  switch (sort) {
    case "recent":     out.sort((a, b) => +b.updatedAt - +a.updatedAt); break;
    case "code":       out.sort((a, b) => a.code.localeCompare(b.code)); break;
    case "price_asc":  out.sort((a, b) => Number((a.mrp ?? 0n) - (b.mrp ?? 0n))); break;
    case "price_desc": out.sort((a, b) => Number((b.mrp ?? 0n) - (a.mrp ?? 0n))); break;
    case "name":
    default:           out.sort((a, b) => a.name.localeCompare(b.name)); break;
  }
  return out;
}

// Take the last chunk of a lot code as a scannable pin label.
// "MDV/GRN-2608-0142-B" → "142-B"; "LOT-A" → "LOT-A".
function shortenLot(lot: string): string {
  const s = lot.trim().toUpperCase();
  if (s.length <= 6) return s;
  return s.slice(-6);
}

export async function listCategories(ctx: RequestContext): Promise<CategoryOption[]> {
  requirePermission(ctx, "catalog.view");
  return familyCounts(ctx);
}

// Lightweight brand picker for the New Product form. Returns every
// active brand, not only those with existing designs, so the datalist
// stays useful in a freshly-wiped catalog before any products exist.
export async function listBrandsForPicker(
  ctx: RequestContext,
): Promise<Array<{ id: string; name: string }>> {
  requirePermission(ctx, "catalog.view");
  const db = scoped(ctx);
  return db.brand.findMany({
    where:   { isActive: true },
    orderBy: { name: "asc" },
    select:  { id: true, name: true },
  });
}

// Editable snapshot for the /products/[id]/edit form. Structured to
// match the updateProductSchema shape so defaultValues plug in
// directly.
export interface ProductEditSnapshot {
  id:       string;
  code:     string;
  name:     string;
  brand:    string;
  family:   string;
  familyLabel: string;
  hsn:      string;
  gstRate:  number;
  sellUnit: string;
  pileHeightMm: string;    // "" if not set
  gsm:          string;    // ""
  pileYarn:     string;
  points:       string;
  extraSpecs:   Array<{ key: string; value: string }>;
  sizePrices:   Array<{ tier: string; price: string }>; // rupees as string
  cost:         string;    // ""
  imageKey:     string | null;
}

const RESERVED_SPEC_KEYS = new Set([
  "sourcedFrom", "sourcedOn", "sheet", "page", "slot", "series", "pileYarn", "points",
]);

export async function getProductForEdit(
  ctx: RequestContext,
  id:  string,
): Promise<ProductEditSnapshot | null> {
  requirePermission(ctx, "catalog.view");
  const canSeeCost = can(ctx, "catalog.viewCost");
  const db = scoped(ctx);

  const cw = await db.colourway.findUnique({
    where:  { id },
    select: {
      id: true, code: true, sellUnit: true, imageKey: true,
      design: {
        select: {
          name: true, family: true, hsn: true, gstRate: true,
          gsm: true, thicknessMm: true, specs: true,
          collection: { select: { brand: { select: { name: true } } } },
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

  // Bucket the active prices by prefix. Size-tier rows come out as
  // { tier: "3x5", price: "7100" }; single-tier COST separately.
  const sizePrices = activePrices
    .filter((p) => p.tier.startsWith("SIZE:"))
    .map((p) => ({
      tier:  p.tier.slice("SIZE:".length),
      price: (Number(p.amount) / 100).toString(),
    }));
  const cost = canSeeCost
    ? activePrices.find((p) => p.tier === "COST")
    : undefined;

  const specs = (cw.design.specs && typeof cw.design.specs === "object" && !Array.isArray(cw.design.specs))
    ? cw.design.specs as Record<string, unknown>
    : {};
  const pileYarn = typeof specs["pileYarn"] === "string" ? specs["pileYarn"] as string : "";
  const points   = typeof specs["points"]   === "string" ? specs["points"]   as string
                 : specs["points"] != null ? String(specs["points"]) : "";
  const extraSpecs = Object.entries(specs)
    .filter(([k]) => !RESERVED_SPEC_KEYS.has(k))
    .map(([k, v]) => ({ key: k, value: v == null ? "" : String(v) }));

  const familyLabel = FAMILY_LABEL[cw.design.family] ?? cw.design.family;

  return {
    id:       cw.id,
    code:     cw.code,
    name:     cw.design.name,
    brand:    cw.design.collection.brand.name,
    family:   cw.design.family,
    familyLabel,
    hsn:      cw.design.hsn,
    gstRate:  Number(cw.design.gstRate),
    sellUnit: cw.sellUnit,
    pileHeightMm: cw.design.thicknessMm != null ? String(cw.design.thicknessMm) : "",
    gsm:          cw.design.gsm != null ? String(cw.design.gsm) : "",
    pileYarn,
    points,
    extraSpecs,
    sizePrices,
    cost:     cost ? (Number(cost.amount) / 100).toString() : "",
    imageKey: cw.imageKey,
  };
}

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

async function brandCounts(ctx: RequestContext): Promise<BrandOption[]> {
  const db = scoped(ctx);
  const brands = await db.brand.findMany({
    where:  { isActive: true },
    select: {
      id: true, name: true,
      collections: {
        select: { _count: { select: { designs: true } } },
      },
    },
  });
  return brands
    .map((b) => ({
      id:           b.id,
      name:         b.name,
      productCount: b.collections.reduce((s, c) => s + c._count.designs, 0),
    }))
    .filter((b) => b.productCount > 0)
    .sort((a, b) => b.productCount - a.productCount);
}

async function priceRange(ctx: RequestContext): Promise<PriceBand> {
  const db = scoped(ctx);
  const agg = await db.price.aggregate({
    where: {
      tier: { in: ["RETAIL", "MRP"] },
      effectiveFrom: { lte: new Date() },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
    },
    _min: { amount: true },
    _max: { amount: true },
  });
  return {
    minPaise: agg._min.amount ?? 0n,
    maxPaise: agg._max.amount ?? 0n,
  };
}

// ─── PDP query (rewritten for the new detail page) ─────────────────────

export interface PriceRow {
  tier:          string;
  amount:        bigint;
  effectiveFrom: Date;
}

export interface DesignSpecEntry {
  key:   string;
  label: string;
  value: string;
}

export interface ProductDetail {
  id:            string;
  code:          string;
  name:          string;
  colourName:    string;
  brand:         string;
  brandId:       string;
  collection:    string;
  family:        string;
  familyLabel:   string;
  categoryName:  string;    // "brand › collection" — legacy display
  hsn:           string;
  uom:           string;
  uomPrecision:  number;
  gstRate:       number;
  status:        string;
  mrp:           bigint | null;
  retail:        bigint | null;
  cost:          bigint | null;
  imageKey:      string | null;
  hex:           string | null;
  catalogPdfKey: string | null;   // /catalog/pdfs/{slug}.pdf when the full supplier PDF is attached
  inStock:       boolean;
  dyeLotHint:    string | null;
  isNew:         boolean;
  attributes:    DesignSpecEntry[];      // family attrs from Design + specs Json
  prices:        PriceRow[];
  siblingColourways: {
    id: string; code: string; colourName: string; hex: string | null; imageKey: string | null;
  }[];
  // Legacy fields the edit form still expects — leave null/false.
  reorderLevel:  string | null;
  minStock:      string | null;
  trackBatch:    boolean;
  trackSerial:   boolean;
}

export async function getProduct(ctx: RequestContext, id: string): Promise<ProductDetail | null> {
  requirePermission(ctx, "catalog.view");
  const canSeeCost = can(ctx, "catalog.viewCost");
  const db = scoped(ctx);
  const cw = await db.colourway.findUnique({
    where:  { id },
    select: {
      id: true, code: true, colourName: true, sellUnit: true, isActive: true,
      imageKey: true, hex: true,
      stock: { select: { dyeLot: true, quantity: true, reserved: true } },
      design: {
        select: {
          id: true, name: true, family: true, hsn: true, gstRate: true, isActive: true,
          specs: true, catalogPdfKey: true,
          rollWidthMm: true, rollLengthM: true, fabricWidthMm: true,
          patternRepeatMm: true, patternMatch: true, railroadable: true,
          gsm: true, thicknessMm: true, areaPerBoxSqft: true, tileSizeMm: true,
          collection: {
            select: {
              id: true, name: true,
              brand: { select: { id: true, name: true } },
            },
          },
          colourways: {
            where: { isActive: true, NOT: { id } },
            select: { id: true, code: true, colourName: true, hex: true, imageKey: true },
            take: 8,
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
  const retail = activePrices.find((p) => p.tier === "RETAIL")?.amount ?? null;
  const mrp    = activePrices.find((p) => p.tier === "MRP")?.amount ?? null;
  const cost   = canSeeCost
    ? (activePrices.find((p) => p.tier === "COST")?.amount ?? null)
    : null;

  const stockRows = cw.stock ?? [];
  const availableStock = stockRows.filter(
    (s) => Number(s.quantity ?? 0) - Number(s.reserved ?? 0) > 0,
  );
  const inStock = availableStock.length > 0;

  let dyeLotHint: string | null = null;
  if (DYE_LOT_SENSITIVE.has(cw.design.family)) {
    const lots = availableStock
      .map((s) => s.dyeLot as string | null)
      .filter((l): l is string => typeof l === "string" && l.length > 0);
    if (lots.length === 1) dyeLotHint = shortenLot(lots[0]!);
    else if (lots.length > 1) dyeLotHint = "MIX";
  }

  // Design has no createdAt column in the schema so "NEW" pill is
  // always false on the PDP for now. Add a column via migration if
  // this ever becomes a real requirement.
  const isNew = false;

  const attributes: DesignSpecEntry[] = [];
  if (cw.design.rollWidthMm)     attributes.push({ key: "rollWidth",     label: "Roll width",     value: `${cw.design.rollWidthMm} mm` });
  if (cw.design.rollLengthM)     attributes.push({ key: "rollLength",    label: "Roll length",    value: `${cw.design.rollLengthM} m` });
  if (cw.design.fabricWidthMm)   attributes.push({ key: "fabricWidth",   label: "Fabric width",   value: `${cw.design.fabricWidthMm} mm` });
  if (cw.design.patternRepeatMm) attributes.push({ key: "patternRepeat", label: "Pattern repeat", value: `${cw.design.patternRepeatMm} mm` });
  if (cw.design.patternMatch && cw.design.patternMatch !== "FREE") {
    attributes.push({ key: "patternMatch", label: "Pattern match", value: String(cw.design.patternMatch).toLowerCase() });
  }
  if (cw.design.railroadable)    attributes.push({ key: "railroadable",  label: "Railroadable",   value: "Yes" });
  if (cw.design.gsm)             attributes.push({ key: "gsm",           label: "GSM",            value: String(cw.design.gsm) });
  if (cw.design.thicknessMm)     attributes.push({ key: "thickness",     label: "Thickness",      value: `${cw.design.thicknessMm} mm` });
  if (cw.design.areaPerBoxSqft)  attributes.push({ key: "areaPerBox",    label: "Area / box",     value: `${cw.design.areaPerBoxSqft} sqft` });
  if (cw.design.tileSizeMm)      attributes.push({ key: "tileSize",      label: "Tile size",      value: cw.design.tileSizeMm });
  const specs = cw.design.specs as Record<string, unknown> | null;
  if (specs && typeof specs === "object" && !Array.isArray(specs)) {
    for (const [k, v] of Object.entries(specs)) {
      if (k === "sourcedFrom" || k === "sourcedOn" || k === "sheet" || k === "page" || k === "series") continue;
      if (v == null || v === "") continue;
      attributes.push({ key: `spec:${k}`, label: humanize(k), value: String(v) });
    }
  }

  const familyLabel = FAMILY_LABEL[cw.design.family] ?? cw.design.family;

  return {
    id:            cw.id,
    code:          cw.code,
    name:          cw.design.name,
    colourName:    cw.colourName,
    brand:         cw.design.collection.brand.name,
    brandId:       cw.design.collection.brand.id,
    collection:    cw.design.collection.name,
    family:        cw.design.family,
    familyLabel,
    categoryName:  `${cw.design.collection.brand.name} › ${cw.design.collection.name}`,
    hsn:           cw.design.hsn,
    uom:           cw.sellUnit,
    uomPrecision:  2,
    gstRate:       Number(cw.design.gstRate),
    status:        cw.design.isActive && cw.isActive ? "ACTIVE" : "INACTIVE",
    mrp,
    retail,
    cost,
    reorderLevel:  null,
    minStock:      null,
    trackBatch:    false,
    trackSerial:   false,
    imageKey:      cw.imageKey,
    hex:           cw.hex,
    catalogPdfKey: cw.design.catalogPdfKey ?? null,
    inStock,
    dyeLotHint,
    isNew,
    attributes,
    prices: activePrices.map((p) => ({
      tier:          p.tier,
      amount:        p.amount,
      effectiveFrom: p.effectiveFrom,
    })),
    siblingColourways: cw.design.colourways,
  };
}

function humanize(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}

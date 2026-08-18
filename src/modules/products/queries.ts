// Products page repository — delegates to the catalog module's searchDesigns.
// /products is the catalog surface: Brand → Collection → Design → Colourway.

import { requirePermission, can } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import { scoped } from "@/kernel/db/scoped";
import { searchDesigns } from "@/modules/catalog/queries";
import { ProductFamilyEnum } from "@/modules/catalog/schema";
import { brandCounts, familyCounts, priceRange } from "./queries-part2";

// Trade-friendly labels for the category rail — enum keys never surface in UI.
export const FAMILY_LABEL: Readonly<Record<string, string>> = {
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
export const DYE_LOT_SENSITIVE = new Set<string>([
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
export function shortenLot(lot: string): string {
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

export const RESERVED_SPEC_KEYS = new Set([
  "sourcedFrom", "sourcedOn", "sheet", "page", "slot", "series", "pileYarn", "points",
]);

export * from "./queries-part2";

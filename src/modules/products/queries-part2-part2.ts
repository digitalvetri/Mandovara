// Split out of queries-part2.ts to stay under the §10 300-line limit.

// Split out of queries.ts to stay under the §10 300-line limit.

// Products page repository — delegates to the catalog module's searchDesigns.
// /products is the catalog surface: Brand → Collection → Design → Colourway.

import { requirePermission, can } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import { scoped } from "@/kernel/db/scoped";
import { DYE_LOT_SENSITIVE, FAMILY_LABEL, shortenLot } from "./queries";
import { DesignSpecEntry, PriceRow } from "./queries-part2";

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

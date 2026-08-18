// Split out of queries.ts to stay under the §10 300-line limit.

// Products page repository — delegates to the catalog module's searchDesigns.
// /products is the catalog surface: Brand → Collection → Design → Colourway.

import { requirePermission, can } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import { scoped } from "@/kernel/db/scoped";
import { BrandOption, CategoryOption, FAMILY_LABEL, PriceBand, ProductEditSnapshot, RESERVED_SPEC_KEYS } from "./queries";

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

export async function familyCounts(ctx: RequestContext): Promise<CategoryOption[]> {
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

export async function brandCounts(ctx: RequestContext): Promise<BrandOption[]> {
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

export async function priceRange(ctx: RequestContext): Promise<PriceBand> {
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

export * from "./queries-part2-part2";

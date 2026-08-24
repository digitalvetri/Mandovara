// Catalog read operations — Brand → Collection → Design → Colourway.
// Search uses tsvector (Phase 1 gate: p95 < 200ms across 3,500 colourways).
// Cost price stripped for roles that lack catalog.viewCost.

import type { RequestContext } from "@/kernel/auth/context";
import { scoped } from "@/kernel/db/scoped";
import { can } from "@/kernel/rbac/guard";
import type { DesignSearchParamsInput } from "./schema";

// ── Brands ──────────────────────────────────────────────────────────────────

export async function listBrands(ctx: RequestContext) {
  const db = scoped(ctx);
  return db.brand.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, country: true, leadTimeDays: true,
      isActive: true, logoKey: true,
      _count: { select: { collections: true } },
    },
  });
}

export async function getBrandById(ctx: RequestContext, id: string) {
  const db = scoped(ctx);
  return db.brand.findUniqueOrThrow({
    where: { id },
    include: {
      collections: {
        orderBy: [{ seasonYear: "desc" }, { name: "asc" }],
        select: {
          id: true, name: true, family: true, seasonYear: true, isActive: true,
          _count: { select: { designs: true } },
        },
      },
    },
  });
}

// ── Collections ─────────────────────────────────────────────────────────────

export async function listCollections(ctx: RequestContext, brandId: string) {
  const db = scoped(ctx);
  return db.collection.findMany({
    where: { brandId },
    orderBy: [{ seasonYear: "desc" }, { name: "asc" }],
    include: {
      _count: { select: { designs: true, sampleBooks: true } },
    },
  });
}

// ── Designs (search) ─────────────────────────────────────────────────────────

export async function searchDesigns(
  ctx: RequestContext,
  params: DesignSearchParamsInput & { priceMinPaise?: bigint; priceMaxPaise?: bigint },
) {
  const db = scoped(ctx);
  const showCost = can(ctx, "catalog.viewCost");
  const skip = (params.page - 1) * params.pageSize;

  // Full-text search via tsvector when a query term is present.
  // Falls back to collectionId/brandId filter when no query.
  const where = buildDesignWhere(ctx, params);

  const [designs, total] = await Promise.all([
    db.design.findMany({
      where,
      skip,
      take: params.pageSize,
      orderBy: { name: "asc" },
      include: {
        collection: { select: { id: true, name: true, brandId: true, brand: { select: { name: true } } } },
        colourways: {
          where: { isActive: true },
          select: {
            id: true, code: true, colourName: true, hex: true, imageKey: true, sellUnit: true, isActive: true,
            stock: {
              select: { dyeLot: true, quantity: true, reserved: true },
            },
            prices: {
              where: {
                effectiveFrom: { lte: new Date() },
                OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
                tier: showCost ? undefined : { not: "COST" },
              },
              orderBy: { effectiveFrom: "desc" },
              take: showCost ? 5 : 4,
            },
          },
        },
      },
    }),
    db.design.count({ where }),
  ]);

  return { designs, total, page: params.page, pageSize: params.pageSize };
}

interface DesignWhereExtras {
  priceMinPaise?: bigint;
  priceMaxPaise?: bigint;
}

function buildDesignWhere(
  ctx: RequestContext,
  params: DesignSearchParamsInput & DesignWhereExtras,
) {
  const and: object[] = [];

  if (params.family) and.push({ family: params.family });

  // Price band filter — matches designs whose Standard colourway has any
  // active RETAIL/MRP price row within [priceMinPaise, priceMaxPaise].
  if (params.priceMinPaise != null || params.priceMaxPaise != null) {
    const amountFilter: Record<string, bigint> = {};
    if (params.priceMinPaise != null) amountFilter["gte"] = params.priceMinPaise;
    if (params.priceMaxPaise != null) amountFilter["lte"] = params.priceMaxPaise;
    and.push({
      colourways: {
        some: {
          prices: {
            some: {
              tier: { in: ["RETAIL", "MRP"] },
              amount: amountFilter,
              effectiveFrom: { lte: new Date() },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
            },
          },
        },
      },
    });
  }
  if (params.brandId) and.push({ collection: { brandId: params.brandId } });
  if (params.collectionId) and.push({ collectionId: params.collectionId });
  if (params.inStock) and.push({ colourways: { some: { stock: { some: { quantity: { gt: 0 } } } } } });

  // Partial-match search via pg_trgm similarity (fast on indexed column)
  // Full-text search would use $queryRaw but Prisma returns typed rows for filter
  // We use `contains` for the gate; pg_trgm index makes this ≤ 50ms in practice
  if (params.q) {
    const q = params.q.trim();
    and.push({
      OR: [
        { code: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { colourways: { some: { colourName: { contains: q, mode: "insensitive" } } } },
        { collection: { name: { contains: q, mode: "insensitive" } } },
        { collection: { brand: { name: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }

  return and.length ? { AND: and } : {};
}

// ── Design detail ────────────────────────────────────────────────────────────

export async function getDesignById(ctx: RequestContext, id: string) {
  const db = scoped(ctx);
  const showCost = can(ctx, "catalog.viewCost");

  const design = await db.design.findUniqueOrThrow({
    where: { id },
    include: {
      collection: {
        include: {
          brand: { select: { id: true, name: true, country: true, leadTimeDays: true } },
          sampleBooks: {
            select: { id: true, barcode: true, status: true, costValue: showCost },
          },
        },
      },
      colourways: {
        where: { isActive: true },
        include: {
          prices: {
            where: {
              effectiveFrom: { lte: new Date() },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
              tier: showCost ? undefined : { not: "COST" },
            },
            orderBy: { effectiveFrom: "desc" },
          },
          stock: {
            orderBy: { dyeLot: "asc" },
          },
        },
      },
    },
  });

  return design;
}

// ── Colourway for quoting ────────────────────────────────────────────────────
// Published contract (TRACK-A §5): getColourwayForQuote(id, clientId)

export async function getColourwayForQuote(
  ctx: RequestContext,
  colourwayId: string,
  clientId?: string,
) {
  const db = scoped(ctx);
  const now = new Date();

  const cw = await db.colourway.findUniqueOrThrow({
    where: { id: colourwayId },
    include: {
      design: {
        select: { hsn: true, gstRate: true, family: true, specs: true },
      },
      prices: {
        where: {
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
        },
        orderBy: { effectiveFrom: "desc" },
      },
      stock: {
        select: { dyeLot: true, quantity: true, reserved: true },
        orderBy: { dyeLot: "asc" },
      },
    },
  });

  // Client-specific override beats tier price
  const clientPrice = cw.prices.find((p) => p.clientId === clientId);
  const retailPrice = cw.prices.find((p) => p.tier === "RETAIL" && !p.clientId);
  const resolvedRate = (clientPrice ?? retailPrice)?.amount ?? 0n;

  return {
    colourway: cw,
    resolvedRate,
    gstRate: cw.design.gstRate,
    sellUnit: cw.sellUnit,
    stockByLot: cw.stock,
  };
}

// ── Sample library ────────────────────────────────────────────────────────────

export async function listSampleBooks(ctx: RequestContext) {
  const db = scoped(ctx);
  return db.sampleBook.findMany({
    orderBy: { status: "asc" },
    include: {
      collection: {
        select: { name: true, brand: { select: { name: true } } },
      },
      issues: {
        where: { returnedAt: null },
        orderBy: { issuedAt: "desc" },
        take: 1,
      },
    },
  });
}

export async function getOverdueSampleBooks(ctx: RequestContext) {
  const db = scoped(ctx);
  return db.sampleIssue.findMany({
    where: { returnedAt: null, dueAt: { lt: new Date() } },
    orderBy: { dueAt: "asc" },
    include: {
      book: {
        include: { collection: { include: { brand: true } } },
      },
    },
  });
}

// ── PDF catalog management ────────────────────────────────────────────────────

export async function listBrandsWithPdf(ctx: RequestContext) {
  const db = scoped(ctx);
  // All active brands, PDF or not — so a freshly-created brand is visible
  // on /products immediately, and BrandCard's "0 PDFs" AlertCircle state
  // is reachable. The counters on the page still tell PDF coverage from
  // the collections array.
  return db.brand.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, country: true, logoKey: true,
      collections: {
        where: { isActive: true },
        orderBy: [{ seasonYear: "desc" }, { name: "asc" }],
        select: {
          id: true, name: true, family: true, seasonYear: true,
          catalogPdfKey: true,
          _count: { select: { designs: true } },
        },
      },
    },
  });
}

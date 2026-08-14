// Catalog image-coverage report: which Colourways are missing `imageKey`
// so the /products list falls back to a hex swatch instead of a cover.
//
// Everything is derived from a single db.colourway query (656 rows today);
// grouping happens in memory to avoid a groupBy across the join to Design.
// If the catalog crosses ~5k rows we can migrate to a raw SQL rollup.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface CatalogImageCoverageQuery {
  search?:   string;
  page?:     number;
  pageSize?: number;
}

export interface CoverageBucket {
  key:     string;
  label:   string;
  total:   number;
  missing: number;
  pct:     number;    // 0..1 — proportion missing (higher = worse)
}

export interface MissingRow {
  id:          string;
  code:        string;
  designName:  string;
  colourName:  string;
  brand:       string;
  collection:  string;
  family:      string;
  hex:         string | null;
}

export interface CatalogImageCoverageResult {
  totalColourways: number;
  withImage:       number;
  withoutImage:    number;
  coveragePct:     number;    // 0..1 — proportion WITH image (higher = better)
  byFamily:        CoverageBucket[];
  byCollection:    CoverageBucket[];
  missing:         MissingRow[];
  missingTotal:    number;
  page:            number;
  pageSize:        number;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE     = 100;
const MAX_WORST_BUCKETS = 10;   // worst-offender collections shown on the page

export async function catalogImageCoverage(
  ctx: RequestContext,
  q: CatalogImageCoverageQuery = {},
): Promise<CatalogImageCoverageResult> {
  requirePermission(ctx, "catalog.view");
  const db = scoped(ctx);

  const pageSize = Math.min(q.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const page     = Math.max(1, q.page ?? 1);

  // Pull every colourway with its design + collection + brand names.
  // Modest column projection so ~656 rows stay cheap.
  const all = await db.colourway.findMany({
    select: {
      id: true, code: true, colourName: true, imageKey: true, hex: true,
      design: {
        select: {
          name: true, family: true,
          collection: {
            select: {
              id: true, name: true,
              brand: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const total     = all.length;
  const withImg   = all.filter((r) => r.imageKey != null && r.imageKey.length > 0);
  const withoutI  = all.filter((r) => r.imageKey == null || r.imageKey.length === 0);

  const byFamily     = bucketBy(all, (r) => [r.design.family, r.design.family]);
  const byCollection = bucketBy(all, (r) => {
    const c = r.design.collection;
    return [c.id, `${c.brand.name} › ${c.name}`];
  })
    .filter((b) => b.missing > 0)
    .sort((a, b) => b.missing - a.missing || b.pct - a.pct)
    .slice(0, MAX_WORST_BUCKETS);

  const search = q.search?.trim().toLowerCase();
  const filtered = search
    ? withoutI.filter((r) =>
        r.code.toLowerCase().includes(search) ||
        r.design.name.toLowerCase().includes(search) ||
        r.colourName.toLowerCase().includes(search) ||
        r.design.collection.name.toLowerCase().includes(search) ||
        r.design.collection.brand.name.toLowerCase().includes(search))
    : withoutI;

  filtered.sort((a, b) => {
    const bc = a.design.collection.brand.name.localeCompare(b.design.collection.brand.name);
    if (bc !== 0) return bc;
    const cc = a.design.collection.name.localeCompare(b.design.collection.name);
    if (cc !== 0) return cc;
    return a.design.name.localeCompare(b.design.name);
  });

  const missingSlice = filtered
    .slice((page - 1) * pageSize, page * pageSize)
    .map<MissingRow>((r) => ({
      id:         r.id,
      code:       r.code,
      designName: r.design.name,
      colourName: r.colourName,
      brand:      r.design.collection.brand.name,
      collection: r.design.collection.name,
      family:     r.design.family,
      hex:        r.hex ?? null,
    }));

  return {
    totalColourways: total,
    withImage:       withImg.length,
    withoutImage:    withoutI.length,
    coveragePct:     total === 0 ? 0 : withImg.length / total,
    byFamily,
    byCollection,
    missing:         missingSlice,
    missingTotal:    filtered.length,
    page,
    pageSize,
  };
}

// ── helpers ──────────────────────────────────────────────────────────

interface ColourwayRow {
  id: string; code: string; colourName: string;
  imageKey: string | null; hex: string | null;
  design: {
    name: string; family: string;
    collection: { id: string; name: string; brand: { name: string } };
  };
}

function bucketBy(
  rows: ColourwayRow[],
  key: (row: ColourwayRow) => readonly [string, string],
): CoverageBucket[] {
  const map = new Map<string, { label: string; total: number; missing: number }>();
  for (const r of rows) {
    const [k, label] = key(r);
    const entry = map.get(k) ?? { label, total: 0, missing: 0 };
    entry.total += 1;
    if (r.imageKey == null || r.imageKey.length === 0) entry.missing += 1;
    map.set(k, entry);
  }
  return [...map.entries()]
    .map(([k, v]) => ({
      key:     k,
      label:   v.label,
      total:   v.total,
      missing: v.missing,
      pct:     v.total === 0 ? 0 : v.missing / v.total,
    }))
    .sort((a, b) => b.missing - a.missing);
}

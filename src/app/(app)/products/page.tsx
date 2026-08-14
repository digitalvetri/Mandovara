// /products — image-first grid catalogue for showroom staff.
//
// Layout: 240px filter rail (sticky on desktop) · 24px gutter · card grid.
// Cards break 4→3→2→1 at 2xl / lg / sm.
// Every filter mirrors a URL param so the state is shareable and
// browser-back-safe.

import Link from "next/link";
import type { Route } from "next";
import { PrimaryButton, Topbar } from "@/components/layout/Topbar";
import { Pager } from "@/components/data/Pager";
import { devContext } from "@/lib/dev-context";
import { listProducts } from "@/modules/products/queries";
import { PRODUCT_STATUSES, type ProductStatus } from "@/modules/products/schema";
import { FilterRail } from "./_components/FilterRail";
import { ResultsBar } from "./_components/ResultsBar";
import { ProductGrid } from "./_components/ProductGrid";
import { EmptyResults } from "./_components/EmptyResults";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?:          string;
  categoryId?: string;
  brandId?:    string;
  status?:     string;
  inStock?:    string;
  priceMin?:   string;
  priceMax?:   string;
  page?:       string;
  sort?:       string;
}

export default async function ProductsPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx = await devContext();

  const q          = params.q?.trim();
  const status     = normaliseStatus(params.status);
  const categoryId = params.categoryId ?? "ALL";
  const brandId    = params.brandId ?? "ALL";
  const inStockOnly = params.inStock === "1";
  const priceMinPaise = parsePriceRupees(params.priceMin);
  const priceMaxPaise = parsePriceRupees(params.priceMax);
  const page = parsePositiveInt(params.page) ?? 1;
  const sort = (params.sort as "recent" | "code" | "name" | "price_asc" | "price_desc" | undefined) ?? "name";

  const result = await listProducts(ctx, {
    ...(q != null && { search: q }),
    categoryId,
    brandId,
    status,
    inStockOnly,
    ...(priceMinPaise != null && { priceMinPaise }),
    ...(priceMaxPaise != null && { priceMaxPaise }),
    page,
    sort,
  });

  const totalAll = result.categories.reduce((s, c) => s + c.productCount, 0);

  return (
    <>
      <Topbar
        title="Product Catalog"
        eyebrow={`${totalAll} SKUs · ${result.categories.length} categor${result.categories.length === 1 ? "y" : "ies"}${result.brands.length > 1 ? ` · ${result.brands.length} brands` : ""}`}
        actions={
          <Link href={"/products/new" as Route}>
            <PrimaryButton>New Product</PrimaryButton>
          </Link>
        }
      />

      <div className="flex flex-col lg:flex-row gap-6 pb-10">
        <FilterRail
          categories={result.categories}
          brands={result.brands}
          priceBand={result.priceBand}
        />

        <div className="flex-1 min-w-0">
          <ResultsBar
            total={result.total}
            page={result.page}
            pageSize={result.pageSize}
            totalAll={totalAll}
            categories={result.categories}
            brands={result.brands}
          />

          {result.rows.length === 0 ? (
            <EmptyResults hasFilters={hasActiveFilters(params)} />
          ) : (
            <>
              <ProductGrid rows={result.rows} />
              <Pager page={result.page} pageSize={result.pageSize} total={result.total} />
            </>
          )}
        </div>
      </div>
    </>
  );
}

function hasActiveFilters(p: SearchParams): boolean {
  return !!(p.q || p.categoryId || p.brandId || p.priceMin || p.priceMax || p.inStock === "1");
}
function parsePriceRupees(v: string | undefined): bigint | undefined {
  if (v == null || v.trim() === "") return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return BigInt(Math.round(n * 100));
}
function normaliseStatus(v: string | undefined): ProductStatus | "ALL" {
  if (v == null || v === "" || v === "ALL") return "ALL";
  if ((PRODUCT_STATUSES as readonly string[]).includes(v)) return v as ProductStatus;
  return "ALL";
}
function parsePositiveInt(v: string | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}

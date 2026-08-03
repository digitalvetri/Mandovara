import Link from "next/link";
import type { Route } from "next";
import { PrimaryButton, Topbar } from "@/components/layout/Topbar";
import { Pager } from "@/components/data/Pager";
import { can } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { listProducts } from "@/modules/products/queries";
import { PRODUCT_STATUSES, type ProductStatus } from "@/modules/products/schema";
import { ProductFilters } from "./_components/ProductFilters";
import { ProductsTable } from "./_components/ProductsTable";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  categoryId?: string;
  status?: string;
  page?: string;
  sort?: string;
}

export default async function ProductsPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx = await devContext();

  const q = params.q?.trim();
  const status = normaliseStatus(params.status);
  const categoryId = params.categoryId ?? "ALL";
  const page = parsePositiveInt(params.page) ?? 1;
  const sort = (params.sort as "recent" | "code" | "name" | undefined) ?? "recent";

  const result = await listProducts(ctx, {
    ...(q != null && { search: q }),
    categoryId,
    status,
    page,
    sort,
  });

  return (
    <>
      <Topbar
        title="Product Catalog"
        eyebrow={`${result.total} SKU${result.total === 1 ? "" : "s"} · ${result.categories.length} categor${result.categories.length === 1 ? "y" : "ies"}${q ? ` · matching "${q}"` : ""}`}
        actions={
          <Link href={"/products/new" as Route}>
            <PrimaryButton>New Product</PrimaryButton>
          </Link>
        }
      />
      <ProductFilters categories={result.categories} />
      <ProductsTable rows={result.rows} canSeeCost={can(ctx, "catalog.viewCost")} />
      <Pager page={page} pageSize={result.pageSize} total={result.total} />
    </>
  );
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

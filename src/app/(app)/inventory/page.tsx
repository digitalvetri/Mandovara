import Link from "next/link";
import type { Route } from "next";
import { PrimaryButton, Topbar } from "@/components/layout/Topbar";
import { Pager } from "@/components/data/Pager";
import { can } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { listBalances } from "@/modules/inventory/queries";
import { BalanceFilters } from "./_components/BalanceFilters";
import { BalancesTable } from "./_components/BalancesTable";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  warehouseId?: string;
  low?: string;
  page?: string;
}

export default async function InventoryPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx = await devContext();

  const q = params.q?.trim();
  const warehouseId = params.warehouseId ?? "ALL";
  const onlyLow = params.low === "1";
  const page = parsePositiveInt(params.page) ?? 1;

  const result = await listBalances(ctx, {
    ...(q != null && { search: q }),
    warehouseId, onlyLow, page,
  });

  return (
    <>
      <Topbar
        title="Inventory & Stock"
        eyebrow={`${result.total} balance${result.total === 1 ? "" : "s"}${onlyLow ? " · below reorder" : ""}${q ? ` · matching "${q}"` : ""}`}
        actions={
          <Link href={"/inventory/adjust" as Route}>
            <PrimaryButton>New Adjustment</PrimaryButton>
          </Link>
        }
      />
      <BalanceFilters warehouses={result.warehouses} />
      <BalancesTable rows={result.rows} canSeeValue={can(ctx, "catalog.viewCost")} />
      <Pager page={page} pageSize={result.pageSize} total={result.total} />
    </>
  );
}

function parsePositiveInt(v: string | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}

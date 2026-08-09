import { Topbar } from "@/components/layout/Topbar";
import { can } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { listStockBalances } from "@/modules/stock/queries";
import { BalancesTable } from "./_components/BalancesTable";
import { BalanceFilters } from "./_components/BalanceFilters";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  family?: string;
  dyeLot?: string;
}

export default async function InventoryPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx = await devContext();

  const search = params.q?.trim();
  const family = params.family?.trim();
  const dyeLot = params.dyeLot?.trim();

  const rows = await listStockBalances(ctx, {
    ...(search && { search }),
    ...(family && { family }),
    ...(dyeLot && { dyeLot }),
  });

  return (
    <>
      <Topbar
        title="Stock & Dye Lots"
        eyebrow={`${rows.length} balance${rows.length === 1 ? "" : "s"}${search ? ` · matching "${search}"` : ""}`}
      />
      <BalanceFilters />
      <BalancesTable rows={rows} canSeeValue={can(ctx, "catalog.viewCost")} />
    </>
  );
}

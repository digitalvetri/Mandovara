// Inventory / Stocks landing page — redesigned per the reference.
//   ┌ Materials · Stock on hand across every location    [Export]
//   ├ 4-tab pill row (Stock · Purchasing · Operations · Requests)
//   ├ 4 KPI tiles (Items · Low stock · Open POs · Stock value)
//   ├ "+ Add item" + family pill filter + search
//   └ item rows with inline Edit → EditStockModal
//
// Purchasing tab links to /purchase (existing module).
// Operations + Requests are placeholder tabs for now — no dead ends.

import { devContext } from "@/lib/dev-context";
import { getInventoryKpis, listStockItems } from "@/modules/inventory/queries";
import { Topbar } from "@/components/layout/Topbar";
import { Pager } from "@/components/data/Pager";
import { InventoryTabs } from "./_components/InventoryTabs";
import { InventoryKpiCards } from "./_components/InventoryKpiCards";
import { InventoryToolbar } from "./_components/InventoryToolbar";
import { StockList } from "./_components/StockList";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  family?: string;
  page?: string;
  tab?: string;
  onlyLow?: string;
  hasLot?: string;
}

export default async function InventoryPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx = await devContext();

  const q       = params.q?.trim();
  const family  = params.family?.trim() ?? "ALL";
  const page    = parsePositiveInt(params.page) ?? 1;
  const onlyLow = params.onlyLow === "1";
  const hasLot  = params.hasLot === "1";

  const [{ rows, total, pageSize, families }, kpis] = await Promise.all([
    listStockItems(ctx, { ...(q && { search: q }), family, page, onlyLow, hasLot }),
    getInventoryKpis(ctx),
  ]);

  return (
    <>
      <Topbar title="" />

      {/* Header */}
      <div className="mb-4">
        <h1 className="font-display text-[28px] font-semibold leading-none text-text">Materials</h1>
        <div className="mt-1 text-[12px] text-text-dim">Stock on hand across every location</div>
      </div>

      <InventoryTabs active="stock" />
      <InventoryKpiCards kpis={kpis} />
      <InventoryToolbar families={families} />
      <StockList rows={rows} />
      <Pager page={page} pageSize={pageSize} total={total} />
    </>
  );
}

function parsePositiveInt(v: string | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}

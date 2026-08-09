// /purchase/allocation — the dye-lot console (§0.6, Phase 4 gate).
// Split view: left = open order lines that still need material; right =
// available lots for the selected line + a form to allocate.
//
// Active line is URL state (?line=xxx) so a link is shareable and refresh
// preserves context. Selecting a line refetches lots on the server —
// no client-side hydration of stock.

import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { can } from "@/kernel/rbac/guard";
import {
  listOpenOrderLines,
  listAvailableLotsForProduct,
  listAllocationsForOrderLine,
} from "@/modules/allocation/queries";
import { OpenLinesTable } from "./_components/OpenLinesTable";
import { AllocationPanel } from "./_components/AllocationPanel";

export const dynamic = "force-dynamic";

interface SearchParams {
  line?: string;
}

export default async function AllocationConsolePage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx = await devContext();

  const openLines = await listOpenOrderLines(ctx);
  const activeLineId = params.line && openLines.find((l) => l.id === params.line)
    ? params.line
    : null;

  const active = activeLineId
    ? openLines.find((l) => l.id === activeLineId) ?? null
    : null;
  const [lots, allocations] = active
    ? await Promise.all([
        listAvailableLotsForProduct(ctx, active.productId),
        listAllocationsForOrderLine(ctx, active.id),
      ])
    : [[], []];

  const canOverride = can(ctx, "allocation.overrideMixedLot");
  const totalPending = openLines.length;

  return (
    <>
      <Topbar
        title="Dye-lot Allocation"
        eyebrow={
          `${totalPending} order line${totalPending === 1 ? "" : "s"} awaiting material` +
          (canOverride ? "" : " · mixed-lot override disabled")
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-4 lg:gap-6 items-start">
        <OpenLinesTable rows={openLines} activeId={activeLineId} />
        <AllocationPanel
          line={active}
          lots={lots}
          existing={allocations}
          canOverride={canOverride}
        />
      </div>
    </>
  );
}

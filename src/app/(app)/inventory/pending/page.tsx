// Pending Stock Verification — /inventory/pending
//
// Stock physically in the showroom whose brand/collection could not be
// matched to the catalogue on import. Held here, deliberately outside
// StockBalance and every stock KPI, until someone reads the actual
// label.
//
// A working queue since 2026-08-28 (owner: "make it a working queue we
// can tick off"). It used to render a static JSON file, so the list sat
// at 25 forever and the answer found on the label was never recorded
// anywhere — which meant the same rolls came back round every month.
//
// Ticking an item captures what the label said. That is the point: the
// brand and collection are what let someone add it to the catalogue
// afterwards.

import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { can } from "@/kernel/rbac/guard";
import { getPendingQueue } from "@/modules/pending-stock/queries";
import { InventoryTabs } from "../_components/InventoryTabs";
import { PendingRow } from "./_components/PendingRow";

export const dynamic = "force-dynamic";

export default async function PendingStockPage() {
  const ctx = await devContext();
  const queue = await getPendingQueue(ctx);
  const canEdit = can(ctx, "inventory.adjust");

  const left = queue.total - queue.checked;
  const pct = queue.total === 0 ? 100 : Math.round((queue.checked / queue.total) * 100);

  return (
    <>
      <Topbar title="" />

      <div className="mb-4">
        <h1 className="font-display text-[28px] font-semibold leading-none text-text">
          Pending Verification
        </h1>
        <div className="mt-1 text-[12px] text-text-dim">
          {left === 0
            ? "All items checked."
            : `${left} of ${queue.total} still to check against their label`}
        </div>
      </div>

      <InventoryTabs active="pending" pendingCount={left} />

      <p className="mb-4 rounded-[10px] border-l-2 border-fault bg-fault/8 px-4 py-2.5 text-[12.5px] text-text">
        These do not count in your stock totals. Read the physical label before
        adding any of them to the catalogue.
      </p>

      {queue.total > 0 && (
        <div className="mb-5 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-good transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="tabular-nums shrink-0 text-[12px] text-text-dim">
            {queue.checked} of {queue.total} checked
          </span>
        </div>
      )}

      <div className="space-y-4 pb-10">
        {queue.groups.map((g) => (
          <section key={g.key} className="overflow-hidden rounded-[12px] border border-rule bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-4 py-3">
              <span className="text-[13px] font-medium text-text">
                {g.label}
                <span className="tabular-nums ml-2 text-[11.5px] text-text-dim">
                  {g.done === g.rows.length ? "all done" : `${g.done}/${g.rows.length}`}
                </span>
              </span>
              <span className="text-[10.5px] uppercase tracking-[0.1em] text-text-dim">
                {g.source}
              </span>
            </div>
            <ul>
              {g.rows.map((r) => (
                <PendingRow key={r.id} row={r} canEdit={canEdit} />
              ))}
            </ul>
          </section>
        ))}

        {queue.total === 0 && (
          <div className="rounded-[12px] border border-rule bg-surface py-12 text-center">
            <div className="text-[13px] font-medium text-text">Nothing waiting.</div>
            <div className="mt-1 text-[12px] text-text-dim">
              Every item that came in unmatched has been checked.
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// Pending Stock Verification — /inventory/pending
//
// Stock physically in the showroom whose brand/collection could not be
// matched to the catalogue on import. Held here, deliberately excluded
// from StockBalance and every stock KPI, until someone reads the actual
// label.
//
// Simplified 2026-08-28 (owner: "make this page very simple as we can").
// It had four KPI cards, a three-line warning, a paragraph under every
// group heading, and a six-column table. The person who uses it is
// standing in the showroom holding a roll, and needs three things: which
// item, how many, and what to read off the label.
//
// What went, and why:
//   • The KPI row — "25" is already on the tab beside the page title.
//   • "Pending reason" — it repeated the group heading on every row.
//   • "Proposed mapping" — a guess, on a page whose whole point is not
//     to act on guesses. Keeping it invited exactly the mistake the
//     warning forbids.
//   • The group descriptions and the footer's source-file paths — one is
//     a restatement of the heading, the other is developer detail on a
//     screen used by store staff.

import { Topbar } from "@/components/layout/Topbar";
import { InventoryTabs } from "../_components/InventoryTabs";
import pendingData from "@/data/pending-stock.json";

export const dynamic = "force-dynamic";

interface PendingItem {
  id: string;
  catalogueName: string | null;
  code: string;
  qty: number;
  unit: string;
  lengthInches?: number | null;
  confirmNeeded: string;
}

interface PendingSection {
  key: string;
  label: string;
  source: string;
  items: PendingItem[];
}

export default function PendingStockPage() {
  const sections = pendingData.sections as PendingSection[];
  const total = sections.reduce((s, sec) => s + sec.items.length, 0);

  return (
    <>
      <Topbar title="" />

      <div className="mb-4">
        <h1 className="font-display text-[28px] font-semibold leading-none text-text">
          Pending Verification
        </h1>
        <div className="mt-1 text-[12px] text-text-dim">
          {total} items in the showroom waiting to be checked against their label
          {" · "}updated {pendingData.lastUpdated}
        </div>
      </div>

      <InventoryTabs active="pending" />

      {/* The one thing that must be said, said once. */}
      <p className="mb-5 rounded-[10px] border-l-2 border-fault bg-fault/8 px-4 py-2.5 text-[12.5px] text-text">
        These do not count in your stock totals. Read the physical label before
        adding any of them to the catalogue.
      </p>

      <div className="space-y-4 pb-10">
        {sections.map((sec) => (
          <Group key={sec.key} section={sec} />
        ))}
      </div>
    </>
  );
}

function Group({ section }: { section: PendingSection }) {
  return (
    <section className="overflow-hidden rounded-[12px] border border-rule bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-4 py-3">
        <span className="text-[13px] font-medium text-text">
          {section.label}
          <span className="tabular-nums ml-2 text-[11.5px] text-text-dim">
            {section.items.length}
          </span>
        </span>
        <span className="text-[10.5px] uppercase tracking-[0.1em] text-text-dim">
          {section.source}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-rule bg-surface-2">
              <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-text-dim">
                Item
              </th>
              <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-text-dim">
                Qty
              </th>
              <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-text-dim">
                Check on the label
              </th>
            </tr>
          </thead>
          <tbody>
            {section.items.map((item) => (
              <tr key={item.id} className="border-b border-rule/60 last:border-0">
                <td className="px-4 py-3 align-top">
                  <div className="font-medium text-text">
                    {item.catalogueName ?? <span className="italic text-text-dim">No name on the sheet</span>}
                  </div>
                  <div className="tabular-nums mt-0.5 font-mono text-[11px] text-text-dim">
                    {item.code}
                    {/* Length identifies a track when nothing else does, so it
                        stays — folded in here rather than as a column that is
                        empty for three groups out of four. */}
                    {item.lengthInches != null && ` · ${item.lengthInches} in`}
                  </div>
                </td>
                <td className="tabular-nums whitespace-nowrap px-4 py-3 text-right align-top text-text">
                  {item.qty} {item.unit.toLowerCase()}
                </td>
                <td className="px-4 py-3 align-top text-text">
                  {item.confirmNeeded}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

"use client";

// Left pane: the queue of open order lines needing material.
// Clicking a row updates ?line= — server re-renders with the right pane
// pointing at that line. No client-side data fetches.

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { Route } from "next";
import type { OpenOrderLineRow } from "@/modules/allocation/queries";

interface Props {
  rows: OpenOrderLineRow[];
  activeId: string | null;
}

export function OpenLinesTable({ rows, activeId }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (rows.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule p-8 text-center">
        <div className="font-display text-[18px] text-text mb-2">Nothing to allocate</div>
        <div className="text-[12.5px] text-text-dim max-w-[36ch] mx-auto">
          Every confirmed sales order has been fully reserved from stock. New allocations will appear here as orders come in or material lands in a GRN.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
      <div className="px-4 py-3 border-b border-rule flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-[0.12em] text-text-dim">
          Open lines · {rows.length}
        </div>
        <div className="text-[10.5px] text-text-faint">click to inspect</div>
      </div>
      <ul className="max-h-[calc(100vh-260px)] overflow-y-auto">
        {rows.map((r) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("line", r.id);
          const href = `${pathname}?${params.toString()}` as Route;
          const isActive = r.id === activeId;
          const hasLot = r.existingLotCount > 0;

          return (
            <li key={r.id}
                className={`border-b border-rule/60 last:border-0 ${isActive ? "bg-accent-tint" : ""}`}>
              <Link href={href}
                    className="block px-4 py-3 hover:bg-surface-hover transition-colors">
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <div className="min-w-0 flex-1">
                    <div className="tabular text-[11.5px] text-text-dim">{r.salesOrderNumber}</div>
                    <div className="text-[13px] text-text truncate">{r.productName}</div>
                    <div className="text-[11.5px] text-text-dim truncate">{r.clientName}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="tabular text-[13px] text-text">{r.neededQty}</div>
                    <div className="text-[10.5px] text-text-faint">{r.uom} needed</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {r.trackBatch ? (
                    <span className="inline-flex items-center gap-1 text-[10.5px] px-1.5 h-[18px] rounded bg-accent-tint text-accent">
                      dye-lot tracked
                    </span>
                  ) : (
                    <span className="text-[10.5px] text-text-faint">no batch tracking</span>
                  )}
                  {hasLot && (
                    <>
                      {r.existingLots.map((lot) => (
                        <span key={lot}
                              className="tabular text-[10.5px] px-1.5 h-[18px] inline-flex items-center rounded bg-surface-hover border border-rule text-text-dim">
                          {lot}
                        </span>
                      ))}
                    </>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

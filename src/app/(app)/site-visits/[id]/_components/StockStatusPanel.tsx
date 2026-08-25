// Server component — per-line stock status for HANDOVER visits.
// Batch C (25 Aug 2026). Shows what the visit will consume vs what's
// on hand; short lines get a "Raise PO" link back to /purchase/new
// pre-filled with the shortfall.

import Link from "next/link";
import type { Route } from "next";
import { Package, PackageCheck, PackageX, ArrowRight } from "lucide-react";
import { getProjectProcurement } from "@/modules/procurement/queries";
import type { RequestContext } from "@/kernel/auth/context";

interface Props {
  ctx:        RequestContext;
  projectId:  string;
}

export async function StockStatusPanel({ ctx, projectId }: Props) {
  const data = await getProjectProcurement(ctx, projectId);
  if (!data.order || data.rows.length === 0) return null;

  return (
    <section className="rounded-[14px] bg-surface border border-rule p-5 md:p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Package size={13} strokeWidth={1.75} className="text-text-dim" />
          <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
            Stock for install
          </div>
        </div>
        {data.hasShortfall && (
          <Link
            href={`/projects/${projectId}/procurement` as Route}
            className="inline-flex items-center gap-1 text-[11.5px] text-accent hover:underline"
          >
            Open procurement <ArrowRight size={11} />
          </Link>
        )}
      </div>

      <ul className="divide-y divide-rule">
        {data.rows.map((r) => {
          const needed    = Number(r.quantityNeeded);
          const procured  = Number(r.procuredQty);
          const onHand    = Number(r.onHandTotal);
          const shortfall = Number(r.shortfall);
          const remaining = Math.max(0, needed - procured);
          const inStock   = remaining <= onHand + 1e-6;
          return (
            <li key={r.orderLineId} className="grid grid-cols-[1fr_100px_120px] items-center gap-3 py-2.5">
              <div className="min-w-0">
                <div className="text-[13px] text-text truncate">{r.description}</div>
                <div className="text-[10.5px] text-text-dim mt-0.5">
                  Needed {needed.toFixed(2)} · Procured {procured.toFixed(2)} · On hand {onHand.toFixed(2)}
                </div>
              </div>
              <div className="text-right text-[11.5px]">
                {inStock ? (
                  <span className="inline-flex items-center gap-1 text-solid">
                    <PackageCheck size={12} /> In stock
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-fault">
                    <PackageX size={12} /> Short by {shortfall.toFixed(2)}
                  </span>
                )}
              </div>
              <div className="flex justify-end">
                {!inStock && r.colourwayId && (
                  <Link
                    href={`/purchase/new?project=${projectId}&colourway=${r.colourwayId}&qty=${shortfall.toFixed(3)}` as Route}
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-[6px] bg-accent/10 border border-accent/30 text-[11px] font-medium text-accent hover:bg-accent/20 transition-colors"
                  >
                    Raise PO
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 text-[10.5px] text-text-dim">
        Completing the visit deducts these quantities from stock automatically. Short items need a PO first.
      </div>
    </section>
  );
}

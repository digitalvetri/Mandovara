"use client";

// The stock-first procurement console. Per row shows what's needed vs
// what's on hand vs what's already been procured, then offers "Issue
// from stock" (when available) and "Raise PO for shortfall" actions.

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, PackageCheck, PackagePlus } from "lucide-react";
import { issueMaterialFromStock } from "@/modules/procurement/actions";
import type { ProcurementRow } from "@/modules/procurement/queries";

interface Props {
  projectId: string;
  rows:      ProcurementRow[];
  canIssue:  boolean;
  canPO:     boolean;
}

export function ProcurementConsole({ projectId, rows, canIssue, canPO }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyLineId, setBusyLineId] = useState<string | null>(null);

  function handleIssue(row: ProcurementRow, qty: number) {
    setError(null);
    setBusyLineId(row.orderLineId);
    start(async () => {
      const res = await issueMaterialFromStock({ orderLineId: row.orderLineId, qty });
      setBusyLineId(null);
      if (!res.ok) { setError(res.error ?? "Issue failed"); return; }
      router.refresh();
    });
  }

  return (
    <div className="rounded-[14px] border border-rule bg-surface overflow-hidden">
      <div className="grid grid-cols-[1fr_100px_100px_100px_100px_240px] gap-3 px-4 py-3 border-b border-rule bg-ink/10 text-[10px] uppercase tracking-[0.14em] text-text-dim font-semibold">
        <div>Item</div>
        <div className="text-right">Needed</div>
        <div className="text-right">Procured</div>
        <div className="text-right">On hand</div>
        <div className="text-right">Shortfall</div>
        <div className="text-right">Action</div>
      </div>

      {rows.length === 0 && (
        <div className="p-8 text-center text-[13px] text-text-dim">
          This order has no lines to procure.
        </div>
      )}

      {rows.map((r) => {
        const needed    = Number(r.quantityNeeded);
        const procured  = Number(r.procuredQty);
        const onHand    = Number(r.onHandTotal);
        const shortfall = Number(r.shortfall);
        const remaining = Math.max(0, needed - procured);
        const canIssueNow = onHand > 0 && remaining > 0;
        const toIssue     = Math.min(onHand, remaining);
        const fullyDone   = remaining < 1e-6;
        const isBusy      = busyLineId === r.orderLineId && pending;

        return (
          <div key={r.orderLineId} className="grid grid-cols-[1fr_100px_100px_100px_100px_240px] gap-3 px-4 py-3 border-b border-rule last:border-0 items-center hover:bg-ink/5 transition-colors">
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-text truncate">{r.description}</div>
              <div className="text-[11px] text-text-dim mt-0.5 flex items-center gap-2">
                {r.designCode && <span className="tabular-nums">{r.designCode}</span>}
                {r.colourName && <span>· {r.colourName}</span>}
                {r.family && <span className="text-text-dim/60">· {r.family}</span>}
              </div>
              {r.stockByLot.length > 0 && (
                <div className="text-[10.5px] text-text-dim/70 mt-1">
                  {r.stockByLot.map((l, i) => (
                    <span key={i} className="mr-2">
                      {l.dyeLot ? <span className="font-mono">{l.dyeLot}</span> : "no-lot"} · {l.available}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="text-right text-[12.5px] text-text tabular-nums">{needed.toFixed(3)} <span className="text-[10px] text-text-dim ml-0.5">{r.unit.toLowerCase()}</span></div>
            <div className="text-right text-[12.5px] text-text-dim tabular-nums">{procured.toFixed(3)}</div>
            <div className={`text-right text-[12.5px] tabular-nums ${onHand > 0 ? "text-solid" : "text-text-dim/50"}`}>{onHand.toFixed(3)}</div>
            <div className={`text-right text-[12.5px] tabular-nums ${shortfall > 0 ? "text-fault" : "text-text-dim/40"}`}>{shortfall.toFixed(3)}</div>
            <div className="flex items-center justify-end gap-2">
              {fullyDone ? (
                <span className="inline-flex items-center gap-1.5 text-[11.5px] text-solid">
                  <CheckCircle2 size={13} /> Procured
                </span>
              ) : (
                <>
                  {canIssue && canIssueNow && (
                    <button
                      type="button"
                      onClick={() => handleIssue(r, toIssue)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[7px] bg-solid/10 border border-solid/30 text-[11px] font-medium text-solid hover:bg-solid/20 disabled:opacity-60 transition-colors"
                    >
                      {isBusy ? <Loader2 size={11} className="animate-spin" /> : <PackageCheck size={11} />}
                      Issue {toIssue.toFixed(2)}
                    </button>
                  )}
                  {canPO && shortfall > 0 && (
                    <Link
                      href={`/purchase/new?project=${projectId}&colourway=${r.colourwayId ?? ""}&qty=${shortfall.toFixed(3)}` as Route}
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[7px] bg-accent/10 border border-accent/30 text-[11px] font-medium text-accent hover:bg-accent/20 transition-colors"
                    >
                      <PackagePlus size={11} />
                      PO {shortfall.toFixed(2)}
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}

      {error && (
        <div className="border-t border-rule bg-fault/5 px-4 py-2 text-[12px] text-fault">
          {error}
        </div>
      )}
    </div>
  );
}

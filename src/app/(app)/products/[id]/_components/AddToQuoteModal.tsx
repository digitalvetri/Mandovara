"use client";

// FIXES-01 §7.3 — PDP "Add to Quote" flow. Instead of always dumping
// the user on /quotations/quick (new-quote builder), open a modal
// listing every open (DRAFT/REVISED) quotation. User picks one to
// APPEND this SKU, or hits "Start new quote" to keep the old flow.
//
// Server:
//   - appendColourwayToQuotation({ quotationId, colourwayId }) adds
//     one line (qty 1, rate from Colourway.MRP price) and recomputes
//     the quotation totals in one transaction.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Loader2, X, Plus, ArrowRight } from "lucide-react";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import { appendColourwayToQuotation } from "@/modules/quotations/actions-lines";
import type { OpenQuotationOption } from "@/modules/quotations/queries";

interface Props {
  colourwayId: string;
  colourwayCode: string;
  openQuotations: OpenQuotationOption[];
  serializedTotals: string[]; // OpenQuotationOption.total as string[] to survive RSC boundary
}

export function AddToQuoteModal({ colourwayId, colourwayCode, openQuotations, serializedTotals }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pendingQid, setPendingQid] = useState<string | null>(null);
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  function appendTo(qid: string) {
    setError(null);
    setPendingQid(qid);
    start(async () => {
      const r = await appendColourwayToQuotation({ quotationId: qid, colourwayId });
      if (!r.ok || !r.data) { setError(r.error ?? "Could not add"); setPendingQid(null); return; }
      router.push(`/quotations/${r.data.quotationId}` as Route);
      router.refresh();
    });
  }

  function newQuote() {
    // Existing flow — party picker + fresh quotation.
    router.push("/quotations/quick" as Route);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group inline-flex items-center justify-center gap-2 w-full h-[48px] px-5 rounded-[10px] bg-gold text-ink font-display text-[15px] font-medium tracking-[-0.005em] hover:bg-gold-strong transition-colors"
      >
        Add to Quote
        <ArrowRight size={16} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-sm flex items-start justify-center pt-16 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="w-full max-w-[520px] rounded-[14px] border border-rule bg-surface shadow-xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 h-[52px] border-b border-rule">
              <div>
                <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim">Add to Quote</div>
                <div className="text-[13px] text-text tabular mt-0.5">{colourwayCode}</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="h-8 w-8 grid place-items-center rounded-md text-text-dim hover:text-text hover:bg-surface-hover"
              >
                <X size={14} />
              </button>
            </div>

            <div className="max-h-[420px] overflow-y-auto">
              {openQuotations.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <div className="text-[12.5px] text-text-dim mb-1">No open draft quotations.</div>
                  <p className="text-[11.5px] text-text-faint">Start a new one below.</p>
                </div>
              ) : (
                <ul className="divide-y divide-rule/60">
                  {openQuotations.map((q, i) => (
                    <li key={q.id}>
                      <button
                        type="button"
                        onClick={() => appendTo(q.id)}
                        disabled={pendingQid !== null}
                        className="w-full text-left px-5 py-3 hover:bg-surface-hover transition-colors flex items-center justify-between gap-3 disabled:opacity-60"
                      >
                        <div className="min-w-0">
                          <div className="text-[12.5px] text-text tabular">{q.number}</div>
                          <div className="text-[11px] text-text-dim truncate">{q.clientName}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[12px] tabular text-text">{formatINR(BigInt(serializedTotals[i]!))}</div>
                          <div className="text-[10.5px] text-text-dim tabular">{formatDate(q.date)}</div>
                        </div>
                        {pendingQid === q.id && <Loader2 size={12} className="animate-spin text-gold shrink-0" />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error && (
              <div className="px-5 py-2 text-[11.5px] text-fault border-t border-fault/40 bg-fault/5">
                {error}
              </div>
            )}

            <div className="px-5 py-3 border-t border-rule flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-[34px] px-3 text-[12.5px] text-text-dim hover:text-text transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={newQuote}
                className="inline-flex items-center gap-1.5 h-[34px] px-4 rounded-[8px] bg-gold text-ink text-[12.5px] font-semibold hover:bg-gold-strong transition-colors"
              >
                <Plus size={12} />
                Start new quote
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

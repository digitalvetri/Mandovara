"use client";

import { MapPin, FileText } from "lucide-react";
import { fmtRupee, rupeesToWords, stateLabel } from "./workspace-helpers";
import type { PreviewTotals } from "./QuotePreviewA4";

interface Props {
  isDraft:      boolean;
  isIntraState: boolean;
  posCode:      string;
  onPosCodeChange: (v: string) => void;
  totals:       PreviewTotals;
  totalRupees:  number;
}

export function QuotationSummaryBar({
  isDraft, isIntraState, posCode, onPosCodeChange, totals, totalRupees,
}: Props) {
  return (
    <div className="border-t border-rule grid grid-cols-1 md:grid-cols-2">

      {/* Tax & Details ──────────────────────────────────────────────── */}
      <div className="px-7 py-6 border-b md:border-b-0 md:border-r border-rule">
        <div className="text-[11.5px] uppercase tracking-[0.1em] text-text-dim mb-4">
          Tax &amp; Details
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[13px]">
            <MapPin size={14} strokeWidth={1.75} className="text-text-dim shrink-0" />
            <span className="text-text-dim">Place of Supply:</span>
            {isDraft ? (
              <div className="flex items-center gap-2 ml-1">
                <input
                  type="text"
                  maxLength={2}
                  value={posCode}
                  onChange={(e) => onPosCodeChange(e.target.value.toUpperCase())}
                  className="h-7 w-10 px-1.5 rounded-[5px] border border-rule bg-transparent text-[12px] tabular text-text text-center outline-none focus:border-accent"
                />
                <span className="text-text">{stateLabel(posCode)}</span>
              </div>
            ) : (
              <span className="text-text ml-1">{stateLabel(posCode)}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[13px]">
            <FileText size={14} strokeWidth={1.75} className="text-text-dim shrink-0" />
            <span className="text-text-dim">Tax Type:</span>
            <span className="text-text ml-1">
              {isIntraState ? "Intra-state (CGST + SGST)" : "Inter-state (IGST)"}
            </span>
          </div>
        </div>
      </div>

      {/* Final Total ────────────────────────────────────────────────── */}
      <div className="px-7 py-6 relative overflow-hidden">
        <div className="text-[11px] uppercase tracking-[0.12em] text-text-dim mb-3">
          Final Total (incl. GST)
        </div>
        <div className="font-display text-[38px] font-semibold text-text tabular leading-none mb-2">
          {fmtRupee(totals.total)}
        </div>
        <div className="text-[12.5px] text-text-dim leading-relaxed pr-16">
          {rupeesToWords(totalRupees)}
        </div>
        <span
          className="absolute right-4 bottom-0 text-[96px] font-bold leading-none select-none pointer-events-none"
          style={{ color: "oklch(0.72 0.115 85)", opacity: 0.06 }}
          aria-hidden
        >
          ₹
        </span>
      </div>
    </div>
  );
}

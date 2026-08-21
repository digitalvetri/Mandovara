"use client";

import { MapPin } from "lucide-react";
import { fmtRupee, rupeesToWords, stateLabel } from "./workspace-helpers";
import type { PreviewTotals } from "./QuotePreviewA4";

interface Props {
  isDraft:         boolean;
  isIntraState:    boolean;
  posCode:         string;
  onPosCodeChange: (v: string) => void;
  totals:          PreviewTotals;
  totalRupees:     number;
}

export function QuotationSummaryBar({
  isDraft, isIntraState, posCode, onPosCodeChange, totals, totalRupees,
}: Props) {
  return (
    <div className="border-t border-rule">
      {isDraft ? (
        // ── Draft: live total calculator so you can verify while editing ──
        <LiveTotals
          isIntraState={isIntraState}
          posCode={posCode}
          onPosCodeChange={onPosCodeChange}
          totals={totals}
          totalRupees={totalRupees}
        />
      ) : (
        // ── Locked: only the place-of-supply meta + amount in words ──────
        // Totals are already in the header card; don't duplicate them.
        <LockedFooter
          posCode={posCode}
          isIntraState={isIntraState}
          totalRupees={totalRupees}
        />
      )}
    </div>
  );
}

// ── Draft: full live calculator ─────────────────────────────────────────────

function LiveTotals({
  isIntraState, posCode, onPosCodeChange, totals, totalRupees,
}: Omit<Props, "isDraft">) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2">

      {/* Tax & Details */}
      <div className="px-6 py-5 border-b md:border-b-0 md:border-r border-rule">
        <div className="text-[9.5px] uppercase tracking-[0.18em] text-text-dim font-semibold mb-3.5">
          Tax &amp; Details
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MapPin size={12} strokeWidth={1.75} className="text-text-dim shrink-0" />
            <span className="text-[12.5px] text-text-dim">Place of Supply</span>
            <div className="flex items-center gap-2 ml-1">
              <input
                type="text"
                maxLength={2}
                value={posCode}
                onChange={(e) => onPosCodeChange(e.target.value.toUpperCase())}
                className="h-6 w-9 px-1 rounded-[5px] border border-rule bg-transparent text-[12px] tabular text-text text-center outline-none focus:border-accent"
              />
              <span className="text-[12.5px] text-text">{stateLabel(posCode)}</span>
            </div>
          </div>
          <div className="text-[12.5px] text-text-dim pl-5">
            {isIntraState ? "Intra-state — CGST + SGST" : "Inter-state — IGST"}
          </div>
        </div>
      </div>

      {/* Live Total */}
      <div className="px-6 py-5">
        <div className="text-[9.5px] uppercase tracking-[0.18em] text-text-dim font-semibold mb-3.5">
          Live Total
        </div>

        {/* Breakdown */}
        <div className="space-y-1.5 mb-4">
          <CalcRow label="Subtotal" value={fmtRupee(totals.taxable)} />
          {isIntraState ? (
            <>
              <CalcRow label="CGST" value={fmtRupee(totals.cgst)} />
              <CalcRow label="SGST" value={fmtRupee(totals.sgst)} />
            </>
          ) : (
            <CalcRow label="IGST" value={fmtRupee(totals.igst)} />
          )}
        </div>

        {/* Grand total */}
        <div className="border-t border-rule pt-3 flex items-baseline justify-between gap-4">
          <span className="text-[11px] uppercase tracking-[0.1em] text-text-dim">Total (incl. GST)</span>
          <span className="font-display text-[26px] font-bold text-text tabular leading-none">
            {fmtRupee(totals.total)}
          </span>
        </div>
        <div className="text-[11.5px] text-text-dim mt-1.5">
          {rupeesToWords(totalRupees)}
        </div>
      </div>
    </div>
  );
}

// ── Locked: minimal footer ──────────────────────────────────────────────────

function LockedFooter({
  posCode, isIntraState, totalRupees,
}: { posCode: string; isIntraState: boolean; totalRupees: number }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
      <div className="flex items-center gap-1.5 text-[12px] text-text-dim">
        <MapPin size={12} strokeWidth={1.75} className="shrink-0" />
        <span>Place of Supply:</span>
        <span className="text-text">{stateLabel(posCode)}</span>
        <span className="text-text-dim/50 mx-1">·</span>
        <span>{isIntraState ? "CGST + SGST" : "IGST"}</span>
      </div>
      <div className="text-[12px] text-text-dim italic">
        {rupeesToWords(totalRupees)}
      </div>
    </div>
  );
}

function CalcRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-[12.5px]">
      <span className="text-text-dim">{label}</span>
      <span className="tabular text-text">{value}</span>
    </div>
  );
}

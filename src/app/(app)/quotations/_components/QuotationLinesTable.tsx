"use client";

// The lines table of the quotation builder.
//
// Split out of QuotationBuilder on 2026-08-28 when the simplified
// column set pushed that file past CLAUDE.md §10's 300-line ceiling.
// Pure presentation — every piece of state still lives in the builder.
//
// Columns are Item · Unit · Qty · Rate · Amount, which is the whole
// quotation for most jobs (owner instruction). Room, per-line discount
// and per-line GST are one checkbox away and still submit exactly as
// before; they are simply not columns to scroll past on every quote.

import { Plus } from "lucide-react";
import { Th } from "./_builder-primitives";
import { LineRow } from "./LineRow";
import type { LineInput } from "./quotation-line-types";

interface Props {
  lines:         LineInput[];
  showDetail:    boolean;
  onShowDetail:  (v: boolean) => void;
  onChange:      (i: number, f: keyof LineInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onRemove:      (i: number) => void;
  onPickProduct: (i: number) => void;
  onAddLine:     () => void;
}

export function QuotationLinesTable({
  lines, showDetail, onShowDetail, onChange, onRemove, onPickProduct, onAddLine,
}: Props) {
  return (
    <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
      <div className="overflow-x-auto">
        <table className={`w-full text-[12.5px] ${showDetail ? "min-w-[960px]" : "min-w-[680px]"}`}>
          <thead>
            <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-muted">
              <Th width={28}>#</Th>
              <Th>Item</Th>
              {showDetail && <Th width={110}>Room</Th>}
              <Th width={90}>Unit</Th>
              <Th width={75}>Qty</Th>
              <Th width={105}>Rate (₹)</Th>
              {showDetail && <Th width={68}>Disc %</Th>}
              {showDetail && <Th width={65}>GST %</Th>}
              <Th width={105} align="right">Amount</Th>
              <Th width={36}></Th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <LineRow key={i} index={i} line={l} isOnly={lines.length === 1}
                       showDetail={showDetail}
                       onChange={onChange} onRemove={onRemove} onPickProduct={onPickProduct} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-t border-rule/60">
        <button type="button" onClick={onAddLine}
                className="flex items-center gap-1.5 h-[30px] px-3 rounded-[6px] text-[12px] text-text-muted hover:text-text hover:bg-surface-hover transition-colors">
          <Plus size={12} /> Add manual line (service, delivery, etc.)
        </button>

        <label className="flex items-center gap-2 text-[12px] text-text-muted cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showDetail}
            onChange={(e) => onShowDetail(e.target.checked)}
            className="h-[14px] w-[14px] accent-gold"
          />
          Show room, discount and GST columns
        </label>
      </div>
    </div>
  );
}

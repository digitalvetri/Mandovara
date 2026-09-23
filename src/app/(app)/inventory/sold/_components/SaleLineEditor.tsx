"use client";

// Adding ONE item to the sale being recorded.
//
// The buyer, the date and the note are typed once at the top of
// SellStockForm; this is the part that repeats — pick an item, say how
// many and at what price, add it, pick the next one. It reuses
// StockItemPicker unchanged, which is why that component takes its query
// and selection as props.
//
// The availability it shows has the rest of the basket already taken
// off (see _sale-lines.remainingItems), so a second line of the same SKU
// is measured against what the first one left.

import { Plus } from "lucide-react";
import { IndianRupee } from "lucide-react";
import type { SellableItem } from "@/modules/inventory/queries-sold";
import { StockItemPicker } from "./StockItemPicker";
import { fieldCls, labelCls } from "./_form-primitives";

interface Props {
  /** Sellable stock, already net of what the basket holds. */
  items:    SellableItem[];
  picked:   SellableItem | null;
  onPick:   (i: SellableItem) => void;
  onClear:  () => void;
  query:    string;
  setQuery: (q: string) => void;
  dyeLot:   string;
  setDyeLot: (v: string) => void;
  qty:      string;
  setQty:   (v: string) => void;
  rate:     string;
  setRate:  (v: string) => void;
  /** Why the item cannot be added yet, or null when it can. */
  blocker:  string | null;
  onAdd:    () => void;
}

export function SaleLineEditor({
  items, picked, onPick, onClear, query, setQuery,
  dyeLot, setDyeLot, qty, setQty, rate, setRate, blocker, onAdd,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-12">
      <StockItemPicker
        items={items}
        picked={picked}
        onPick={onPick}
        onClear={onClear}
        query={query}
        setQuery={setQuery}
      />

      {/* Everything below only means something once an item is chosen —
          showing empty quantity and price boxes over an empty picker is
          what made the old form look like it wanted them first. */}
      {picked && (
        <>
          {picked.dyeLots.length > 0 && (
            <div className="sm:col-span-3">
              <label className={labelCls}>Dye lot</label>
              <select
                value={dyeLot}
                onChange={(e) => setDyeLot(e.target.value)}
                className={fieldCls}
              >
                <option value="">Any lot</option>
                {picked.dyeLots.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          )}

          <div className={picked.dyeLots.length > 0 ? "sm:col-span-3" : "sm:col-span-4"}>
            <label className={labelCls}>
              How many? <span className="text-fault">*</span>
            </label>
            <div className="relative">
              <input
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                inputMode="decimal"
                placeholder="0"
                // Enter adds the line rather than submitting the sale —
                // the fast path at a counter is item, number, Enter.
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); if (!blocker) onAdd(); }
                }}
                className={`${fieldCls} tabular-nums pr-14`}
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10.5px] uppercase tracking-wide text-text-subtle">
                {picked.sellUnit}
              </span>
            </div>
          </div>

          <div className={picked.dyeLots.length > 0 ? "sm:col-span-3" : "sm:col-span-4"}>
            <label className={labelCls}>Sold at (per {picked.sellUnit.toLowerCase()})</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim">
                <IndianRupee size={13} strokeWidth={2} />
              </span>
              <input
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                inputMode="decimal"
                placeholder="0"
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); if (!blocker) onAdd(); }
                }}
                className={`${fieldCls} pl-7 tabular-nums`}
              />
            </div>
          </div>

          <div className="flex items-end sm:col-span-3">
            <button
              type="button"
              onClick={onAdd}
              disabled={blocker !== null}
              className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] border border-gold/60 bg-gold/10 px-4 text-[12.5px] font-semibold text-text transition-colors hover:bg-gold/20 disabled:cursor-not-allowed disabled:border-rule disabled:bg-surface-2 disabled:text-text-faint"
            >
              <Plus size={13} strokeWidth={2.2} />
              Add to sale
            </button>
          </div>

          {blocker && (
            <div className="text-[11px] text-text-dim sm:col-span-12">{blocker}</div>
          )}
        </>
      )}
    </div>
  );
}

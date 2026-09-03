"use client";

// Choosing WHICH item was sold.
//
// Split out of SellStockForm on 2026-09-04 — the form was over the §10
// 300-line ceiling, and this is the half that has its own idea: a search
// box over the sellable list, or, once something is chosen, a summary of
// it with a way back out.
//
// A search box rather than a <select> because a studio carries hundreds
// of SKUs and a native dropdown of 300 options is unusable on a phone,
// which is where a counter sale actually gets entered. Typing narrows on
// design, colour, code and brand at once, because the person at the
// counter has whichever of those the customer said.
//
// Availability shows on every row and again on the chosen item, so "how
// many can I sell" is answered before the quantity is typed rather than
// by a red error afterwards. The server re-checks it regardless
// (CLAUDE.md #11) — this is the courtesy, not the rule.

import { useMemo } from "react";
import { Search, X } from "lucide-react";
import type { SellableItem } from "@/modules/inventory/queries-sold";
import { fieldCls, labelCls } from "./_form-primitives";

interface Props {
  items:    SellableItem[];
  picked:   SellableItem | null;
  onPick:   (i: SellableItem) => void;
  onClear:  () => void;
  query:    string;
  setQuery: (q: string) => void;
}

/** How many suggestions to show at once. Enough to scan, few enough that
 *  the list never pushes the quantity field off a phone screen. */
const SUGGESTIONS = 8;

/** Mirrors PICKER_LIMIT in modules/inventory/queries-sold.ts. A list that
 *  comes back exactly this long was probably truncated, and the operator
 *  needs to know that before concluding an item isn't in stock. */
const SERVER_CAP = 300;

export function StockItemPicker({
  items, picked, onPick, onClear, query, setQuery,
}: Props) {
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, SUGGESTIONS);
    return items
      .filter((i) =>
        i.label.toLowerCase().includes(q) ||
        i.code.toLowerCase().includes(q) ||
        i.brandName.toLowerCase().includes(q))
      .slice(0, SUGGESTIONS);
  }, [items, query]);

  return (
    <div className="sm:col-span-12">
      <label className={labelCls}>
        Which item? <span className="text-fault">*</span>
      </label>

      {picked ? (
        <div className="flex items-center gap-3 rounded-[10px] border border-gold/50 bg-gold/[0.06] px-3.5 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-text">{picked.label}</div>
            <div className="mt-0.5 text-[11px] tabular-nums text-text-dim">
              {picked.code} · {picked.available} {picked.sellUnit.toLowerCase()} available
              {picked.onHand !== picked.available && (
                <span className="text-text-subtle">
                  {" "}({picked.onHand} in stock, rest committed)
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClear}
            aria-label="Choose a different item"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-[6px] text-text-dim transition-colors hover:bg-surface-hover hover:text-text"
          >
            <X size={13} />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by design, colour, code or brand"
              // pl-8 clears the search glyph at left-2.5.
              className={`${fieldCls} pl-8`}
            />
          </div>

          {items.length === 0 ? (
            <div className="mt-2 rounded-[8px] border border-dashed border-rule px-3 py-4 text-center text-[11.5px] text-text-dim">
              Nothing in stock to sell yet. Receive a GRN or adjust a quantity
              on the Stock tab first.
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-rule/60 overflow-hidden rounded-[10px] border border-rule">
              {matches.length === 0 && (
                <li className="px-3.5 py-3 text-[11.5px] text-text-dim">
                  Nothing matches “{query.trim()}”.
                </li>
              )}
              {matches.map((i) => (
                <li key={i.colourwayId}>
                  <button
                    type="button"
                    onClick={() => onPick(i)}
                    className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] text-text">{i.label}</span>
                      <span className="block truncate text-[10.5px] text-text-dim">
                        {i.brandName} · {i.code}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-[11.5px] tabular-nums text-text-dim">
                      {i.available}
                      <span className="ml-1 text-[10px] uppercase">{i.sellUnit}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {items.length >= SERVER_CAP && (
            <div className="mt-1.5 text-[10.5px] text-text-subtle">
              Showing the first {SERVER_CAP} items in stock. If something is
              missing, type more of its name to narrow the search.
            </div>
          )}
        </>
      )}
    </div>
  );
}

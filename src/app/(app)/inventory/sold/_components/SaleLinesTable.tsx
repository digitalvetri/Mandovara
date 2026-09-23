"use client";

// The items already added to the sale being recorded.
//
// Quantity and price stay editable here rather than forcing a
// remove-and-re-add: at a counter the correction ("no, six boxes") comes
// a moment after the line was typed, and the item is the part that was
// right.
//
// The line value and the running total are BigInt paise throughout
// (CLAUDE.md #8) — see _sale-lines.ts.

import { Trash2 } from "lucide-react";
import { formatINR } from "@/kernel/money/format";
import { basketTotalPaise, lineTotalPaise, type SaleLine } from "./_sale-lines";

interface Props {
  lines:      SaleLine[];
  /** Server-side complaints, keyed by basket index: "0" → message. */
  lineErrors: Record<number, string>;
  onChange:   (key: string, patch: Partial<Pick<SaleLine, "qty" | "rate">>) => void;
  onRemove:   (key: string) => void;
}

const cols = "md:grid-cols-[minmax(0,1fr)_110px_130px_110px_36px]";

export function SaleLinesTable({ lines, lineErrors, onChange, onRemove }: Props) {
  if (lines.length === 0) return null;

  const total = basketTotalPaise(lines);

  return (
    <div className="overflow-hidden rounded-[10px] border border-rule">
      <div className={`hidden ${cols} items-center gap-3 border-b border-rule bg-surface-2 px-3.5 py-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-text-dim md:grid`}>
        <span>Item</span>
        <span>Quantity</span>
        <span>Rate</span>
        <span className="text-right">Value</span>
        <span className="sr-only">Remove</span>
      </div>

      <ul className="divide-y divide-rule">
        {lines.map((l, i) => (
          <li
            key={l.key}
            className={`grid grid-cols-1 gap-2 px-3.5 py-3 ${cols} md:items-center md:gap-3`}
          >
            <div className="min-w-0">
              <div className="truncate text-[12.5px] text-text">{l.item.label}</div>
              <div className="mt-0.5 truncate text-[10.5px] tabular-nums text-text-dim">
                {l.item.code}
                {l.dyeLot ? ` · lot ${l.dyeLot}` : ""}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                value={l.qty}
                onChange={(e) => onChange(l.key, { qty: e.target.value })}
                inputMode="decimal"
                aria-label={`Quantity for ${l.item.label}`}
                className="h-9 w-[72px] rounded-[7px] border border-rule bg-transparent px-2 text-[12.5px] tabular-nums text-text outline-none transition-colors focus:border-gold"
              />
              <span className="text-[10px] uppercase tracking-wide text-text-subtle">
                {l.item.sellUnit}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[11px] text-text-dim">₹</span>
              <input
                value={l.rate}
                onChange={(e) => onChange(l.key, { rate: e.target.value })}
                inputMode="decimal"
                placeholder="0"
                aria-label={`Rate for ${l.item.label}`}
                className="h-9 w-[92px] rounded-[7px] border border-rule bg-transparent px-2 text-[12.5px] tabular-nums text-text outline-none transition-colors focus:border-gold"
              />
            </div>

            <div className="text-[12.5px] font-medium tabular-nums text-text md:text-right">
              <span className="mr-1 text-[10px] uppercase text-text-subtle md:hidden">Value</span>
              {formatINR(lineTotalPaise(l))}
            </div>

            <div className="md:justify-self-end">
              <button
                type="button"
                onClick={() => onRemove(l.key)}
                aria-label={`Remove ${l.item.label} from this sale`}
                className="grid h-8 w-8 place-items-center rounded-[6px] text-text-dim transition-colors hover:bg-surface-hover hover:text-fault"
              >
                <Trash2 size={13} />
              </button>
            </div>

            {lineErrors[i] && (
              <div className="text-[10.5px] leading-snug text-fault md:col-span-5">
                {lineErrors[i]}
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-3 border-t border-rule bg-surface-2 px-3.5 py-2.5">
        <span className="text-[11.5px] text-text-dim">
          {lines.length} {lines.length === 1 ? "item" : "items"} on this sale
        </span>
        <span className="text-[13px] font-semibold tabular-nums text-text">
          {formatINR(total)}
        </span>
      </div>
    </div>
  );
}

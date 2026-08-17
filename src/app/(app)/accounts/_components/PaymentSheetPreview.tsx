"use client";

// "This will clear" preview — pulled out of PaymentSheet.tsx to keep
// that file under the 300-line cap. Shows the oldest-first allocation
// in plain words with a per-row check-mark for fully-cleared bills, a
// warn dot for partial payments, and an "extra kept for later bills"
// line when the amount is over the total due.
//
// Advanced mode swaps each per-row amount for an editable input so the
// owner can tune allocations by hand.

import { Check, ChevronDown } from "lucide-react";
import { formatINR } from "@/kernel/money/format";
import { fmt } from "./_receipt-primitives";

export interface AllocPreviewBill {
  id:          string;
  number:      string;
  date:        Date;
  outstanding: bigint;
}

export interface AllocPreviewRow {
  bill: AllocPreviewBill;
  take: bigint;
}

interface Props {
  rows:         AllocPreviewRow[];
  kept:         bigint;
  over:         bigint;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  manualAlloc:  Record<string, string>;
  onManualAllocChange: (billId: string, value: string) => void;
}

export function PaymentSheetPreview({
  rows, kept, over, showAdvanced, onToggleAdvanced, manualAlloc, onManualAllocChange,
}: Props) {
  return (
    <div className="rounded-[14px] bg-surface border border-rule p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-[11px] uppercase tracking-[0.14em] text-text-dim">
          This will clear
        </div>
        <button
          type="button"
          onClick={onToggleAdvanced}
          className="inline-flex items-center gap-0.5 text-[11px] text-accent hover:underline"
        >
          {showAdvanced ? "Auto again" : "Change"}
          <ChevronDown size={12} strokeWidth={2.5}
                       className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
        </button>
      </div>

      <ul className="space-y-2">
        {rows.map(({ bill, take }) => {
          const fullyClears = take > 0n && take >= bill.outstanding;
          const partial     = take > 0n && take < bill.outstanding;
          const skipped     = take === 0n;
          return (
            <li key={bill.id} className="flex items-center gap-3">
              <span className={[
                "w-5 h-5 rounded-full grid place-items-center shrink-0",
                fullyClears ? "bg-solid/15 text-solid" :
                partial     ? "bg-warn/15  text-warn"  :
                              "bg-surface-2 text-text-faint",
              ].join(" ")}>
                {fullyClears ? <Check size={12} strokeWidth={3} /> : "·"}
              </span>
              <div className="flex-1 min-w-0">
                <div className={`text-[12.5px] tabular ${skipped ? "text-text-faint" : "text-text"} truncate`}>
                  {bill.number}
                  <span className="text-text-dim ml-2">· {fmt(bill.date)}</span>
                </div>
                {partial && (
                  <div className="text-[10.5px] text-warn tabular">
                    Part payment — {formatINR(bill.outstanding - take)} still due
                  </div>
                )}
              </div>
              {showAdvanced ? (
                <input
                  inputMode="decimal"
                  value={manualAlloc[bill.id] ?? ""}
                  onChange={(e) => onManualAllocChange(bill.id, e.target.value)}
                  placeholder="0"
                  className="w-24 h-9 rounded-[6px] border border-rule bg-transparent px-2 text-right text-[12px] tabular text-text outline-none focus:border-gold"
                />
              ) : (
                <div className={`tabular text-[12.5px] whitespace-nowrap ${skipped ? "text-text-faint" : "text-text"}`}>
                  {take > 0n ? formatINR(take) : "—"}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {(kept > 0n || over > 0n) && (
        <div className="mt-3 pt-3 border-t border-rule text-[12px]">
          {kept > 0n && (
            <div className="text-text-dim">
              <span className="tabular text-warn">{formatINR(kept)}</span>
              {" extra — kept for later bills"}
            </div>
          )}
          {over > 0n && (
            <div className="text-bad">
              Over by {formatINR(over)}. Reduce the allocations or lower the amount.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

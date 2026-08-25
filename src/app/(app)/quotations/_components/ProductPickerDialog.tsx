"use client";

// Product picker modal used by the measurement-driven quote builder.
// Search across the catalog, pick a colourway → dialog resolves with the
// full row so the builder can update its state AND persist the choice
// onto the measurement (via pickProductForMeasurementItem in the parent).

import { useEffect, useRef, useState, useTransition } from "react";
import { X, Loader2, Search } from "lucide-react";
import { searchColourwaysForPicker } from "@/modules/quotations/picker-actions";
import type { PickerRow } from "@/modules/quotations/picker-types";
import { formatINR } from "@/kernel/money/format";

interface Props {
  open:     boolean;
  onClose:  () => void;
  onPick:   (row: PickerRow) => void;
  /** Restrict picker to designs of the same product family as the
   *  measurement item (fabric-only for a curtain item, etc.) — avoids
   *  picking a wallpaper for a curtain measurement. */
  family?:  string;
}

export function ProductPickerDialog({ open, onClose, onPick, family }: Props) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<PickerRow[]>([]);
  const [pending, start] = useTransition();
  // The family from the measurement is a suggestion. If the catalog has
  // nothing matching it (small orgs won't have every family seeded), the
  // user can widen to all families with one click.
  const [strictFamily, setStrictFamily] = useState(true);
  const activeFamily = strictFamily ? family : undefined;
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset the toggle whenever the dialog reopens for a new row.
  useEffect(() => { if (open) setStrictFamily(true); }, [open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    // initial load with empty query — shows a starter set
    start(async () => {
      const r = await searchColourwaysForPicker({ family: activeFamily, limit: 20 });
      setRows(r);
    });
  }, [open, activeFamily]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      start(async () => {
        const r = await searchColourwaysForPicker({ q, family: activeFamily, limit: 30 });
        setRows(r);
      });
    }, 220);
    return () => clearTimeout(t);
  }, [q, open, activeFamily]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 backdrop-blur-sm p-4 sm:p-10 overflow-y-auto"
         onClick={onClose}>
      <div className="w-full max-w-[720px] rounded-[14px] bg-surface border border-rule shadow-2xl"
           onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-rule flex items-center justify-between">
          <div>
            <div className="text-[14px] font-display font-medium text-text">Pick a product</div>
            {family && (
              <div className="text-[11px] text-text-muted mt-0.5 flex items-center gap-2">
                {strictFamily ? (
                  <>
                    Filtered to {family.toLowerCase()} designs
                    <button
                      type="button"
                      onClick={() => setStrictFamily(false)}
                      className="underline underline-offset-2 text-gold hover:text-gold-strong"
                    >
                      Search all families
                    </button>
                  </>
                ) : (
                  <>
                    Searching all product families
                    <button
                      type="button"
                      onClick={() => setStrictFamily(true)}
                      className="underline underline-offset-2 text-gold hover:text-gold-strong"
                    >
                      Only {family.toLowerCase()}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
                  className="h-8 w-8 grid place-items-center rounded-[6px] text-text-muted hover:text-text hover:bg-surface-hover transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="p-4 border-b border-rule">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search designs, colours, brands, codes…"
              className="w-full h-[38px] pl-9 pr-3 bg-surface-2 border border-border rounded-[8px] text-[13px] outline-none focus:border-gold"
            />
          </div>
        </div>

        <div className="max-h-[480px] overflow-y-auto">
          {pending && rows.length === 0 && (
            <div className="p-8 text-center text-[12.5px] text-text-muted">
              <Loader2 size={16} className="mx-auto mb-2 animate-spin" />
              Searching…
            </div>
          )}
          {!pending && rows.length === 0 && (
            <div className="p-8 text-center text-[12.5px] text-text-muted space-y-3">
              <div>No products match. Try a different search.</div>
              {strictFamily && family && (
                <button
                  type="button"
                  onClick={() => setStrictFamily(false)}
                  className="inline-flex items-center gap-1.5 h-[30px] px-3 rounded-[6px] bg-gold/10 border border-gold/30 text-[12px] font-medium text-gold hover:bg-gold/20 transition-colors"
                >
                  Search all families instead
                </button>
              )}
            </div>
          )}
          <ul className="divide-y divide-rule/60">
            {rows.map((r) => (
              <li key={r.colourwayId}>
                <button
                  type="button"
                  onClick={() => onPick(r)}
                  className="w-full text-left px-4 py-3 hover:bg-surface-hover flex items-center gap-3 transition-colors"
                >
                  <div className="h-9 w-9 rounded-[6px] border border-rule shrink-0"
                       style={r.hex ? { backgroundColor: r.hex } : undefined} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-text truncate">
                      {r.displayName}
                    </div>
                    <div className="text-[11px] text-text-muted mt-0.5 flex items-center gap-2">
                      <span className="font-mono tabular">{r.code}</span>
                      <span>·</span>
                      <span>{r.brandName}</span>
                      <span>·</span>
                      <span className="uppercase tracking-[0.06em]">{r.family}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[12.5px] tabular text-text">
                      {formatINR(BigInt(r.ratePaise))}
                    </div>
                    <div className="text-[10.5px] text-text-muted uppercase tracking-[0.06em]">
                      per {r.sellUnit.toLowerCase()}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

"use client";

// Inline catalog picker. Search-as-you-type (debounced), returns
// colourway rows with a "Pick" button. When picked, the parent gets
// the full row so it can auto-fill sellUnit, gstRate, and default
// rate on the line.

import { useEffect, useState } from "react";
import { Search, Loader2, X } from "lucide-react";
import { searchColourwaysForPicker } from "@/modules/quotations/picker-actions";
import type { PickerRow } from "@/modules/quotations/picker-types";
import { formatINR } from "@/kernel/money/format";

interface CatalogPickerProps {
  onPick:   (row: PickerRow) => void;
  onClose:  () => void;
}

export function CatalogPicker({ onPick, onClose }: CatalogPickerProps) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<PickerRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = window.setTimeout(async () => {
      try {
        const r = await searchColourwaysForPicker({ q, limit: 25 });
        if (!cancelled) setRows(r);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [q]);

  return (
    <div
      className="fixed inset-0 z-40 bg-ink/70 backdrop-blur-sm flex items-start justify-center pt-[10vh] p-3"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-[640px] max-h-[80vh] flex flex-col rounded-[14px] bg-surface border border-rule overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-rule px-4">
          <Search size={14} className="text-text-dim shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search designs, brands, colourways…"
            autoFocus
            className="flex-1 h-[48px] bg-transparent text-[14px] text-text placeholder:text-text-faint outline-none"
          />
          {loading && <Loader2 size={14} className="animate-spin text-text-dim" />}
          <button
            type="button"
            onClick={onClose}
            className="h-[32px] w-[32px] grid place-items-center rounded-[6px] text-text-dim hover:text-text"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {rows.length === 0 ? (
            <div className="px-4 py-10 text-center text-[12px] text-text-dim">
              {q ? `No matches for "${q}".` : "Type to search — brand, design name, or colour."}
            </div>
          ) : (
            <ul>
              {rows.map((r) => (
                <li key={r.colourwayId} className="border-t border-rule first:border-0">
                  <button
                    type="button"
                    onClick={() => { onPick(r); onClose(); }}
                    className="w-full text-left px-4 py-3 grid grid-cols-[48px_1fr_auto_auto] gap-3 items-center hover:bg-surface-hover"
                  >
                    {r.imageUrl ? (
                      <img
                        src={r.imageUrl}
                        alt=""
                        className="h-[48px] w-[48px] object-cover rounded-[6px] border border-rule"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="h-[48px] w-[48px] rounded-[6px] border border-rule"
                        style={{ background: r.hex ?? "var(--color-gold)" }}
                        aria-hidden
                      />
                    )}
                    <div className="min-w-0">
                      <div className="text-[13px] text-text truncate">{r.displayName}</div>
                      <div className="text-[10.5px] text-text-dim truncate">
                        {r.brandName} · {r.code} · {r.family.replace(/_/g, " ").toLowerCase()} · HSN {r.hsn}
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-text-dim tabular">
                      {r.gstRate}% GST
                      <div className="text-[10.5px] text-text-faint">per {r.sellUnit.toLowerCase()}</div>
                    </div>
                    <div className="text-right text-[12.5px] tabular text-text font-medium">
                      {r.ratePaise === "0" ? "—" : formatINR(BigInt(r.ratePaise))}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

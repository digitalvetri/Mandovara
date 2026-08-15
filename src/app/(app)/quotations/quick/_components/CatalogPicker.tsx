"use client";

// Product picker: renders either as a floating modal overlay or
// inline within the quotation line card (inline=true).

import { useEffect, useState } from "react";
import { Search, Loader2, X, ArrowLeft, Check } from "lucide-react";
import { searchColourwaysForPicker } from "@/modules/quotations/picker-actions";
import type { PickerRow } from "@/modules/quotations/picker-types";
import { formatINR } from "@/kernel/money/format";

const FAMILY_TABS = [
  { key: "",                  label: "All" },
  { key: "CURTAIN_FABRIC",    label: "Curtains" },
  { key: "SHEER",             label: "Sheers" },
  { key: "BLIND",             label: "Blinds" },
  { key: "WALLPAPER",         label: "Wallpaper" },
  { key: "FLOORING",          label: "Flooring" },
  { key: "CARPET_ROLL",       label: "Carpet" },
  { key: "CARPET_TILE",       label: "Carpet Tile" },
  { key: "UPHOLSTERY_FABRIC", label: "Upholstery" },
  { key: "INTERIOR_FILM",     label: "Films" },
  { key: "VERTICAL_GARDEN",   label: "Vertical Garden" },
  { key: "MURAL",             label: "Mural" },
] as const;

interface CatalogPickerProps {
  onPick:   (row: PickerRow) => void;
  onClose:  () => void;
  inline?:  boolean;
}

export function CatalogPicker({ onPick, onClose, inline = false }: CatalogPickerProps) {
  const [q, setQ]               = useState("");
  const [family, setFamily]     = useState("");
  const [rows, setRows]         = useState<PickerRow[]>([]);
  const [loading, setLoading]   = useState(false);
  const [selected, setSelected] = useState<PickerRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = window.setTimeout(async () => {
      try {
        const r = await searchColourwaysForPicker({
          q,
          family: family || undefined,
          limit:  40,
        });
        if (!cancelled) setRows(r);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [q, family]);

  const panel = (
    <div
      className={
        inline
          ? "flex flex-col rounded-[8px] border border-rule bg-surface overflow-hidden"
          : "w-full max-w-[640px] max-h-[84vh] flex flex-col rounded-[14px] bg-surface border border-rule overflow-hidden"
      }
      onClick={!inline ? (e) => e.stopPropagation() : undefined}
    >
      {/* ── Search header ── */}
      <div className="flex items-center gap-3 border-b border-rule px-4 shrink-0">
        {selected ? (
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="text-text-dim hover:text-text shrink-0"
            aria-label="Back to results"
          >
            <ArrowLeft size={14} />
          </button>
        ) : (
          <Search size={14} className="text-text-dim shrink-0" />
        )}
        <input
          value={q}
          onChange={(e) => { setSelected(null); setQ(e.target.value); }}
          placeholder="Search designs, brands, colourways…"
          autoFocus
          className="flex-1 h-[44px] bg-transparent text-[13.5px] text-text placeholder:text-text-faint outline-none"
        />
        {loading && <Loader2 size={14} className="animate-spin text-text-dim shrink-0" />}
        <button
          type="button"
          onClick={onClose}
          className="h-[30px] w-[30px] grid place-items-center rounded-[6px] text-text-dim hover:text-text shrink-0"
          aria-label="Close picker"
        >
          <X size={14} />
        </button>
      </div>

      {/* ── Category filter tabs (hidden in detail view) ── */}
      {!selected && (
        <div
          className="flex items-center gap-1 px-3 py-2 border-b border-rule overflow-x-auto shrink-0"
          style={{ scrollbarWidth: "none" }}
        >
          {FAMILY_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFamily(tab.key)}
              className={[
                "shrink-0 h-[24px] px-2.5 rounded-[5px] text-[11px] whitespace-nowrap transition-colors",
                family === tab.key
                  ? "bg-gold-tint text-gold"
                  : "text-text-dim hover:text-text hover:bg-surface-hover",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Body ── */}
      <div
        className={[
          "overflow-y-auto min-h-0",
          inline ? "max-h-[300px]" : "flex-1",
        ].join(" ")}
      >
        {selected ? (
          <DetailPanel row={selected} onConfirm={() => { onPick(selected); onClose(); }} />
        ) : rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12px] text-text-dim">
            {loading ? "Loading…" : q ? `No matches for "${q}".` : "No products found."}
          </div>
        ) : (
          <ul>
            {rows.map((r) => (
              <li key={r.colourwayId} className="border-t border-rule first:border-0">
                <button
                  type="button"
                  onClick={() => setSelected(r)}
                  className="w-full text-left px-3 py-2.5 grid grid-cols-[40px_1fr_auto_auto] gap-2.5 items-center hover:bg-surface-hover"
                >
                  <Swatch row={r} size={40} />
                  <div className="min-w-0">
                    <div className="text-[12.5px] text-text truncate">{r.displayName}</div>
                    <div className="text-[10px] text-text-dim truncate">
                      {r.brandName} · {r.code} · {r.family.replace(/_/g, " ").toLowerCase()} · HSN {r.hsn}
                    </div>
                  </div>
                  <div className="text-right text-[10.5px] text-text-dim tabular shrink-0">
                    {r.gstRate}% GST
                    <div className="text-[10px] text-text-faint">per {r.sellUnit.toLowerCase()}</div>
                  </div>
                  <div className="text-right text-[12px] tabular text-text font-medium shrink-0">
                    {r.ratePaise === "0" ? "—" : formatINR(BigInt(r.ratePaise))}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  if (inline) return panel;

  return (
    <div
      className="fixed inset-0 z-40 bg-ink/70 backdrop-blur-sm flex items-start justify-center pt-[8vh] p-3"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {panel}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Swatch({ row, size }: { row: PickerRow; size: number }) {
  if (row.imageUrl) {
    return (
      <img
        src={row.imageUrl}
        alt=""
        className="rounded-[5px] border border-rule object-cover shrink-0"
        style={{ width: size, height: size }}
        loading="lazy"
      />
    );
  }
  return (
    <div
      className="rounded-[5px] border border-rule shrink-0"
      style={{ width: size, height: size, background: row.hex ?? "var(--color-gold)" }}
      aria-hidden
    />
  );
}

function DetailPanel({ row, onConfirm }: { row: PickerRow; onConfirm: () => void }) {
  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex gap-3 items-start">
        <Swatch row={row} size={72} />
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-text leading-snug mb-0.5">{row.displayName}</div>
          <div className="text-[11.5px] text-text-dim">{row.brandName}</div>
          {row.collectionName && (
            <div className="text-[11px] text-text-faint mt-0.5">{row.collectionName}</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 border border-rule rounded-[8px] p-3">
        <Field label="SKU / Code"  value={row.code}                        mono />
        <Field label="Category"    value={row.family.replace(/_/g, " ")}        />
        <Field label="HSN"         value={row.hsn}                         mono />
        <Field label="GST"         value={`${row.gstRate}%`}                    />
        <Field label="Unit"        value={row.sellUnit.toLowerCase()}            />
        <Field
          label="Price"
          value={row.ratePaise === "0" ? "—" : formatINR(BigInt(row.ratePaise))}
          mono
        />
      </div>

      <button
        type="button"
        onClick={onConfirm}
        className="flex items-center justify-center gap-2 h-10 rounded-[7px] bg-gold text-ink font-semibold text-[13px] hover:bg-gold-strong transition-colors"
      >
        <Check size={14} strokeWidth={2.5} />
        Select / Add Product
      </button>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[9.5px] text-text-faint uppercase tracking-wider mb-0.5">{label}</div>
      <div className={["text-[12px] text-text", mono ? "font-mono tabular" : ""].join(" ")}>
        {value}
      </div>
    </div>
  );
}

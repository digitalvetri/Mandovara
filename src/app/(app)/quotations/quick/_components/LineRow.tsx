"use client";

// One quick-quote line. The catalog picker opens inline within this
// card so the user never leaves the quotation form.

import { useState } from "react";
import { X, Package } from "lucide-react";
import { formatINR } from "@/kernel/money/format";
import { type LineDraft, lineAmount } from "./line-utils";
import type { PickerRow } from "@/modules/quotations/picker-types";
import { CatalogPicker } from "./CatalogPicker";

interface LineRowProps {
  line:      LineDraft;
  onChange:  (next: Partial<LineDraft>) => void;
  onRemove?: () => void;
}

export function LineRow({ line, onChange, onRemove }: LineRowProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  function handlePick(row: PickerRow) {
    const rateRupees =
      row.ratePaise === "0" ? "" : (Number(BigInt(row.ratePaise)) / 100).toFixed(2);
    onChange({
      colourwayId:  row.colourwayId,
      displayName:  row.displayName,
      sellUnit:     row.sellUnit,
      gstRate:      row.gstRate,
      ratePaise:    row.ratePaise,
      rateEditable: rateRupees,
      hex:          row.hex,
      family:       row.family,
      label:        line.label.length > 0 ? line.label : row.displayName,
    });
    setPickerOpen(false);
  }

  return (
    <div className="grid grid-cols-[3px_1fr] gap-2 rounded-[10px] border border-rule bg-surface overflow-hidden">
      <div
        className="self-stretch"
        style={{ background: line.hex ?? "var(--color-rule)" }}
        aria-hidden
      />
      <div className="p-3">
        {pickerOpen ? (
          <CatalogPicker
            inline
            onPick={handlePick}
            onClose={() => setPickerOpen(false)}
          />
        ) : (
          <>
            <div className="flex items-center gap-2 mb-2">
              {line.colourwayId ? (
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="min-w-0 flex-1 text-left text-[13px] text-text truncate hover:text-gold"
                >
                  {line.displayName}
                  <span className="ml-1 text-[10.5px] text-text-dim">Change</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="min-w-0 flex-1 min-h-[36px] rounded-[8px] border border-dashed border-rule text-text-dim inline-flex items-center justify-center gap-1.5 hover:border-gold hover:text-gold"
                >
                  <Package size={13} /> Pick product from catalog
                </button>
              )}
              {onRemove && (
                <button
                  type="button"
                  onClick={onRemove}
                  className="h-[36px] w-[36px] grid place-items-center text-text-dim hover:text-fault"
                  aria-label="Remove line"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
              <Input label="Room"        value={line.roomName}  onChange={(v) => onChange({ roomName: v })} />
              <Input label="Label"       value={line.label}     onChange={(v) => onChange({ label: v })} className="lg:col-span-2" />
              <Input label="Width (mm)"  value={line.widthMm}   onChange={(v) => onChange({ widthMm: v.replace(/[^0-9.]/g, "") })} inputMode="decimal" />
              <Input label="Height (mm)" value={line.heightMm}  onChange={(v) => onChange({ heightMm: v.replace(/[^0-9.]/g, "") })} inputMode="decimal" />
              <Input label="Qty"         value={line.quantity}  onChange={(v) => onChange({ quantity: v.replace(/[^0-9.]/g, "") })} inputMode="decimal" />
            </div>

            <div className="mt-2 grid grid-cols-2 lg:grid-cols-4 gap-2">
              <Input
                label={`Rate${line.sellUnit ? ` (per ${line.sellUnit.toLowerCase()})` : ""}`}
                value={line.rateEditable ?? ""}
                onChange={(v) => onChange({ rateEditable: v.replace(/[^0-9.]/g, "") })}
                inputMode="decimal"
              />
              <Input label="Disc %" value={line.discountPct} onChange={(v) => onChange({ discountPct: v.replace(/[^0-9.]/g, "") })} inputMode="decimal" />
              <div className="lg:col-span-2 flex items-end justify-end text-[10.5px] text-text-dim">
                {line.gstRate != null && <span className="mr-2">GST {line.gstRate}%</span>}
                <span className="tabular text-text">{formatINR(lineAmount(line))}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Input({ label, value, onChange, inputMode, className }: {
  label: string; value: string; onChange: (v: string) => void;
  inputMode?: "decimal" | "numeric" | "text"; className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <div className="text-[10px] uppercase tracking-[0.06em] text-text-dim mb-1">{label}</div>
      <input
        type="text"
        inputMode={inputMode ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-[36px] rounded-[6px] border border-rule bg-transparent px-2 text-[12.5px] tabular text-text"
      />
    </label>
  );
}

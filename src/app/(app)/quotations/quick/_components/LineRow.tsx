"use client";

import { X } from "lucide-react";
import { formatINR } from "@/kernel/money/format";
import { type LineDraft, lineAmount } from "./line-utils";

interface LineRowProps {
  line:      LineDraft;
  onChange:  (next: Partial<LineDraft>) => void;
  onRemove?: () => void;
}

const GST_RATES = [0, 5, 12, 18, 28] as const;

// Owner redesign (2026-08-26): the Quick Quote line matches the
// hand-crafted sample now — no width/height in millimetres, just
// Qty + Unit like "MTR 25", "ROLLS 8", "NOS 2". Site-measurement
// dimensions are captured elsewhere when they're actually needed.
const UNITS: { value: string; label: string }[] = [
  { value: "METRE",       label: "MTR (Metres)" },
  { value: "ROLL",        label: "ROLLS" },
  { value: "RUNNING_FT",  label: "RFT (Running feet)" },
  { value: "PIECE",       label: "NOS / Pieces" },
  { value: "SET",         label: "SET" },
  { value: "BOX",         label: "BOX" },
  { value: "SQFT",        label: "SQFT" },
  { value: "SQM",         label: "SQM" },
];

export function LineRow({ line, onChange, onRemove }: LineRowProps) {
  return (
    <div className="rounded-[10px] border border-rule bg-surface overflow-hidden">
      <div className="p-3">
        <div className="flex items-start gap-2 mb-2">
          <Input
            label="Description"
            value={line.label}
            onChange={(v) => onChange({ label: v })}
            placeholder="e.g. MBR Main, Track, Stitching charge"
            className="flex-1"
          />
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="mt-5 h-[36px] w-[36px] grid place-items-center text-text-dim hover:text-fault shrink-0"
              aria-label="Remove line"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <Input label="Room / Section" value={line.roomName} onChange={(v) => onChange({ roomName: v })} />
          <label className="block">
            <div className="text-[10px] uppercase tracking-[0.06em] text-text-dim mb-1">Unit</div>
            <select
              value={line.sellUnit ?? "METRE"}
              onChange={(e) => onChange({ sellUnit: e.target.value })}
              className="w-full h-[36px] rounded-[6px] border border-rule bg-transparent px-2 text-[12.5px] text-text"
            >
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </label>
          <Input label="Qty" value={line.quantity} onChange={(v) => onChange({ quantity: v.replace(/[^0-9.]/g, "") })} inputMode="decimal" />
          <Input
            label="Rate (₹)"
            value={line.rateEditable ?? ""}
            onChange={(v) => onChange({ rateEditable: v.replace(/[^0-9.]/g, "") })}
            inputMode="decimal"
          />
        </div>

        <div className="mt-2 grid grid-cols-2 lg:grid-cols-4 gap-2">
          <label className="block">
            <div className="text-[10px] uppercase tracking-[0.06em] text-text-dim mb-1">GST %</div>
            <select
              value={line.gstRate ?? 18}
              onChange={(e) => onChange({ gstRate: Number(e.target.value) })}
              className="w-full h-[36px] rounded-[6px] border border-rule bg-transparent px-2 text-[12.5px] text-text"
            >
              {GST_RATES.map((r) => (
                <option key={r} value={r}>{r}%</option>
              ))}
            </select>
          </label>
          <Input label="Disc %" value={line.discountPct} onChange={(v) => onChange({ discountPct: v.replace(/[^0-9.]/g, "") })} inputMode="decimal" />
          <div className="col-span-2 flex items-end justify-end text-[10.5px]">
            <span className="tabular text-text font-medium">{formatINR(lineAmount(line))}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, inputMode, className, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  inputMode?: "decimal" | "numeric" | "text"; className?: string; placeholder?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <div className="text-[10px] uppercase tracking-[0.06em] text-text-dim mb-1">{label}</div>
      <input
        type="text"
        inputMode={inputMode ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-[36px] rounded-[6px] border border-rule bg-transparent px-2 text-[12.5px] tabular text-text placeholder:text-text-faint"
      />
    </label>
  );
}

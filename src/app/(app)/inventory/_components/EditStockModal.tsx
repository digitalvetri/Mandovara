"use client";

// Inline edit sheet for a single SKU:
//   - Adjust stock (IN/OUT + qty + reason + optional dye lot + optional rate)
//   - Set reorder threshold (or clear it)
// Both write through the two adjustStock / setReorderLevel server
// actions. On success the sheet closes and the router refreshes so
// the row on the list picks up the new on-hand + low-stock flag.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, ArrowDown, ArrowUp, Bell } from "lucide-react";
import type { StockItemRow } from "@/modules/inventory/queries";
import { adjustStock, setReorderLevel } from "@/modules/inventory/actions";

const REASONS = [
  { key: "STOCK_TAKE", label: "Stock take" },
  { key: "DAMAGE",     label: "Damage" },
  { key: "THEFT",      label: "Theft" },
  { key: "EXPIRY",     label: "Expiry / obsolete" },
  { key: "OTHER",      label: "Other" },
];

interface Props {
  item: StockItemRow;
  open: boolean;
  onClose: () => void;
}

export function EditStockModal({ item, open, onClose }: Props) {
  const router = useRouter();
  const [direction, setDirection] = useState<"IN" | "OUT">("IN");
  const [qty, setQty]           = useState("");
  const [reason, setReason]     = useState(REASONS[0]!.key);
  const [dyeLot, setDyeLot]     = useState("");
  const [rate, setRate]         = useState("");
  const [reorder, setReorder]   = useState(item.reorderLevel ?? "");
  const [error, setError]       = useState<string | null>(null);
  const [pending, start]        = useTransition();

  if (!open) return null;

  function submit(): void {
    setError(null);
    const qNum = Number(qty);
    const rNum = reorder.trim() === "" ? null : Number(reorder);
    const rateNum = rate.trim() === "" ? undefined : Math.round(Number(rate) * 100);
    const wantsAdjust = qty.trim() !== "" && Number.isFinite(qNum) && qNum > 0;
    const wantsThreshold = reorder.trim() !== ""
      ? Number.isFinite(rNum) && rNum !== Number(item.reorderLevel ?? -1)
      : item.reorderLevel != null; // clearing

    if (!wantsAdjust && !wantsThreshold) {
      setError("Nothing to save — enter a quantity to adjust or change the reorder level.");
      return;
    }

    start(async () => {
      // Threshold first so the belowReorder check inside the adjust
      // action sees the new value if both changed.
      if (wantsThreshold) {
        const res = await setReorderLevel({ colourwayId: item.colourwayId, level: rNum });
        if (!res.ok) { setError(res.error ?? "Could not update reorder level"); return; }
      }
      if (wantsAdjust) {
        const delta = direction === "IN" ? qNum : -qNum;
        const res = await adjustStock({
          colourwayId: item.colourwayId,
          dyeLot:      dyeLot.trim() || undefined,
          delta,
          reason,
          ...(rateNum !== undefined && { ratePaise: rateNum }),
        });
        if (!res.ok) { setError(res.error ?? "Could not adjust stock"); return; }
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Edit stock for ${item.code}`}
    >
      <div className="w-full max-w-[520px] rounded-[14px] border border-rule bg-surface p-6">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-display text-[19px] font-semibold text-text">
              {item.designName} — {item.colourName}
            </h2>
            <div className="mt-0.5 text-[11.5px] text-text-dim">
              <span className="tabular-nums">{item.code}</span>
              <span className="mx-1.5 text-text-subtle">·</span>
              <span>On hand {item.onHand}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] p-1 text-text-dim hover:bg-surface-2 hover:text-text"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Adjust stock */}
        <section className="mt-5">
          <div className="mb-2 text-[10.5px] uppercase tracking-[0.14em] text-text-dim">Adjust stock</div>
          <div className="mb-3 inline-flex rounded-[8px] border border-rule bg-surface-2 p-1">
            <button
              type="button"
              onClick={() => setDirection("IN")}
              className={`inline-flex items-center gap-1 rounded-[6px] px-3 py-1 text-[12px] font-medium transition-colors ${
                direction === "IN" ? "bg-solid/15 text-solid" : "text-text-dim"
              }`}
            >
              <ArrowUp size={12} /> Add
            </button>
            <button
              type="button"
              onClick={() => setDirection("OUT")}
              className={`inline-flex items-center gap-1 rounded-[6px] px-3 py-1 text-[12px] font-medium transition-colors ${
                direction === "OUT" ? "bg-fault/15 text-fault" : "text-text-dim"
              }`}
            >
              <ArrowDown size={12} /> Remove
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.001"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className={inputCls}
                placeholder="0"
              />
            </Field>
            <Field label="Reason">
              <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}>
                {REASONS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </Field>
            <Field label="Dye lot (optional)">
              <input
                type="text"
                value={dyeLot}
                onChange={(e) => setDyeLot(e.target.value)}
                className={inputCls}
                placeholder="Same lot rule for wallpaper / fabric"
              />
            </Field>
            <Field label="Rate ₹ / unit (optional)">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className={inputCls}
                placeholder="0.00"
              />
            </Field>
          </div>
        </section>

        {/* Reorder threshold */}
        <section className="mt-5 border-t border-rule pt-4">
          <div className="mb-2 flex items-center gap-2 text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
            <Bell size={11} />
            Reorder threshold
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <Field label={`Notify Store + Owner when qty ≤ (leave blank to disable)`}>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.001"
                value={reorder}
                onChange={(e) => setReorder(e.target.value)}
                className={inputCls}
                placeholder="e.g. 10"
              />
            </Field>
            {item.reorderLevel != null && (
              <button
                type="button"
                onClick={() => setReorder("")}
                className="h-10 rounded-[8px] border border-rule px-3 text-[11.5px] text-text-dim hover:text-text"
              >
                Clear
              </button>
            )}
          </div>
        </section>

        {error && (
          <div className="mt-4 rounded-[8px] border border-fault/40 bg-fault/5 px-3 py-2 text-[11.5px] text-fault">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-[8px] px-4 py-2 text-[12.5px] text-text-dim hover:text-text disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-[8px] bg-gold px-5 py-2 text-[12.5px] font-semibold text-ink hover:bg-gold-strong disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? <Loader2 size={12} className="animate-spin" /> : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full h-10 rounded-[8px] border border-rule bg-surface-2 px-3 text-[12.5px] text-text outline-none focus:border-gold";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10.5px] uppercase tracking-[0.12em] text-text-dim">{label}</label>
      {children}
    </div>
  );
}

"use client";

// The pencil on a "Recent sales" row — correct a sale already recorded.
//
// Quantity, price, date and buyer can change. The item and dye lot are
// shown but fixed: selling a different item is a new sale, not an edit.
// Everything goes through updateStockSale, which moves the stock list by
// the difference when the quantity changes.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IndianRupee, Loader2, Pencil, X } from "lucide-react";
import { updateStockSale } from "@/modules/inventory/actions-sold-edit";
import { fieldCls, labelCls } from "./_form-primitives";

interface Props {
  sale: {
    id:        string;
    label:     string;
    code:      string;
    dyeLot:    string | null;
    quantity:  string;
    sellUnit:  string;
    /** Paise, as a string — BigInt does not cross the server boundary. */
    ratePaise: string;
    soldTo:    string | null;
    /** YYYY-MM-DD */
    soldOn:    string;
  };
}

export function EditSaleButton({ sale }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid h-8 w-8 place-items-center rounded-[6px] text-text-dim hover:bg-surface-2 hover:text-text"
        aria-label={`Edit sale of ${sale.label}`}
        title="Edit sale"
      >
        <Pencil size={13} />
      </button>
      {/* Mounted only while open, so every opening starts from the saved values. */}
      {open && <EditSaleModal sale={sale} onClose={() => setOpen(false)} />}
    </>
  );
}

function EditSaleModal({ sale, onClose }: Props & { onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [qty, setQty]       = useState(sale.quantity);
  const [rate, setRate]     = useState(paiseToRupees(sale.ratePaise));
  const [date, setDate]     = useState(sale.soldOn);
  const [soldTo, setSoldTo] = useState(sale.soldTo ?? "");

  const qtyNum   = Number(qty);
  const qtyValid = Number.isFinite(qtyNum) && qtyNum > 0;
  const unit     = sale.sellUnit.toLowerCase();

  function submit(e: React.FormEvent): void {
    e.preventDefault();
    if (!qtyValid) { setFieldErrors({ quantity: "Enter how many were sold" }); return; }
    setError(null); setFieldErrors({});
    start(async () => {
      const res = await updateStockSale({
        id:       sale.id,
        quantity: qtyNum,
        soldOn:   date,
        rate:     rate.trim(),
        soldTo:   soldTo.trim(),
      });
      if (!res.ok) {
        setFieldErrors(res.fieldErrors ?? {});
        // Field-level messages are shown by their field; only say
        // something up top when there is nothing more specific.
        if (!res.fieldErrors || Object.keys(res.fieldErrors).length === 0) {
          setError(res.error ?? "Could not update the sale");
        }
        return;
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
      aria-label={`Edit sale of ${sale.label}`}
      onKeyDown={(e) => { if (e.key === "Escape" && !pending) onClose(); }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-[520px] rounded-[14px] border border-rule bg-surface p-6"
      >
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-display text-[19px] font-semibold text-text">Edit sale</h2>
            <div className="mt-0.5 truncate text-[11.5px] text-text-dim">
              {sale.label}
              <span className="mx-1.5 text-text-subtle">·</span>
              <span className="tabular-nums">{sale.code}</span>
              {sale.dyeLot && <><span className="mx-1.5 text-text-subtle">·</span>lot {sale.dyeLot}</>}
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

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <label className={labelCls}>How many sold? <span className="text-fault">*</span></label>
            <div className="relative">
              <input
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                inputMode="decimal"
                autoFocus
                className={`${fieldCls} tabular-nums pr-14`}
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10.5px] uppercase tracking-wide text-text-subtle">
                {sale.sellUnit}
              </span>
            </div>
            {fieldErrors["quantity"] && (
              <div className="mt-1 text-[10.5px] leading-snug text-fault">{fieldErrors["quantity"]}</div>
            )}
          </div>

          <div>
            <label className={labelCls}>Sold at (per {unit})</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim">
                <IndianRupee size={13} strokeWidth={2} />
              </span>
              <input
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                inputMode="decimal"
                placeholder="0"
                className={`${fieldCls} pl-7 tabular-nums`}
              />
            </div>
            {fieldErrors["rate"] && (
              <div className="mt-1 text-[10.5px] text-fault">{fieldErrors["rate"]}</div>
            )}
          </div>

          <div>
            <label className={labelCls}>When?</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`${fieldCls} tabular-nums`}
            />
            {fieldErrors["soldOn"] && (
              <div className="mt-1 text-[10.5px] text-fault">{fieldErrors["soldOn"]}</div>
            )}
          </div>

          <div>
            <label className={labelCls}>Sold to / note</label>
            <input
              value={soldTo}
              onChange={(e) => setSoldTo(e.target.value)}
              maxLength={300}
              placeholder="Walk-in, or a name"
              className={fieldCls}
            />
          </div>
        </div>

        {qtyValid && qtyNum !== Number(sale.quantity) && (
          <div className="mt-3 text-[11px] text-text-dim">
            {Number(qty) > Number(sale.quantity)
              ? `Stock will drop by another ${trim(qtyNum - Number(sale.quantity))} ${unit}.`
              : `${trim(Number(sale.quantity) - qtyNum)} ${unit} will go back into stock.`}
          </div>
        )}

        {error && <div className="mt-3 text-[11.5px] text-fault">{error}</div>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-[8px] border border-rule px-4 text-[12.5px] text-text-dim hover:text-text"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!qtyValid || pending}
            className="inline-flex h-9 items-center gap-2 rounded-[8px] bg-gold px-4 text-[12.5px] font-medium text-ink hover:bg-gold-strong disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending && <Loader2 size={13} className="animate-spin" />}
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** "120050" → "1200.50". BigInt arithmetic, no float (CLAUDE.md #8). */
function paiseToRupees(p: string): string {
  let n: bigint;
  try { n = BigInt(p); } catch { return ""; }
  if (n <= 0n) return "";
  const r = n / 100n;
  const f = n % 100n;
  return f === 0n ? r.toString() : `${r}.${f.toString().padStart(2, "0")}`;
}

/** Display-only: drop float noise from a quantity difference. */
function trim(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

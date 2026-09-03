"use client";

// "Record a sale" — pick an item, say how many left, save.
//
// Choosing the item is its own component (StockItemPicker); this owns
// the quantity, price, date and buyer, and the submit. Field styles are
// shared through _form-primitives so the two halves cannot drift into
// looking like two different forms.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PackageMinus, IndianRupee } from "lucide-react";
import { recordStockSale } from "@/modules/inventory/actions-sold";
import type { SellableItem } from "@/modules/inventory/queries-sold";
import { StockItemPicker } from "./StockItemPicker";
import { fieldCls, labelCls } from "./_form-primitives";

interface Props {
  items: SellableItem[];
}

export function SellStockForm({ items }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<string | null>(null);

  const [query, setQuery]   = useState("");
  const [picked, setPicked] = useState<SellableItem | null>(null);
  const [dyeLot, setDyeLot] = useState("");
  const [qty, setQty]       = useState("");
  const [rate, setRate]     = useState("");
  const [soldTo, setSoldTo] = useState("");
  const [note, setNote]     = useState("");
  const [date, setDate]     = useState(iso(new Date()));

  const qtyNum    = Number(qty);
  const qtyValid  = Number.isFinite(qtyNum) && qtyNum > 0;
  const canSubmit = picked !== null && qtyValid && !pending;

  function choose(item: SellableItem): void {
    setPicked(item);
    setQuery("");
    setDyeLot("");
    setFieldErrors({});
    setError(null);
    // Pre-fill the selling price the catalogue already carries. It is a
    // starting point, not a decision — counter sales get discounted and
    // the field stays editable.
    setRate(item.ratePaise === "0" ? "" : (Number(item.ratePaise) / 100).toString());
  }

  function reset(): void {
    setPicked(null); setQty(""); setRate(""); setSoldTo("");
    setNote(""); setDyeLot(""); setQuery("");
  }

  function onSubmit(e: React.FormEvent): void {
    e.preventDefault();
    if (!picked) return;
    setError(null); setFieldErrors({}); setSaved(null);
    start(async () => {
      const res = await recordStockSale({
        colourwayId: picked.colourwayId,
        quantity:    qtyNum,
        soldOn:      date,
        ...(dyeLot        ? { dyeLot }            : {}),
        ...(rate.trim()   ? { rate: rate.trim() } : {}),
        ...(soldTo.trim() ? { soldTo: soldTo.trim() } : {}),
        ...(note.trim()   ? { note: note.trim() }     : {}),
      });
      if (!res.ok) {
        setError(res.error ?? "Could not record the sale");
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      setSaved(`${qty} ${picked.sellUnit.toLowerCase()} of ${picked.label} taken off stock.`);
      reset();
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mb-5 overflow-hidden rounded-[14px] border border-rule bg-surface"
    >
      <div className="flex items-start gap-3 border-b border-rule bg-surface-2 px-5 py-3.5">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-heat/10 text-heat">
          <PackageMinus size={15} strokeWidth={1.9} />
        </span>
        <div>
          <div className="text-[13px] font-semibold text-text">Record a sale</div>
          <div className="text-[11.5px] text-text-dim">
            Pick the item, say how many went out. The stock list drops by that much.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 p-5 sm:grid-cols-12">

        {/* ── Item ──────────────────────────────────────────────────── */}
        <StockItemPicker
          items={items}
          picked={picked}
          onPick={choose}
          onClear={reset}
          query={query}
          setQuery={setQuery}
        />

        {/* ── Dye lot, only when the SKU has them ───────────────────── */}
        {picked && picked.dyeLots.length > 0 && (
          <div className="sm:col-span-4">
            <label className={labelCls}>Dye lot</label>
            <select
              value={dyeLot}
              onChange={(e) => setDyeLot(e.target.value)}
              className={fieldCls}
            >
              <option value="">Any lot</option>
              {picked.dyeLots.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        )}

        {/* ── How many ──────────────────────────────────────────────── */}
        <div className="sm:col-span-4">
          <label className={labelCls}>
            How many sold? <span className="text-fault">*</span>
          </label>
          <div className="relative">
            <input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              className={`${fieldCls} tabular-nums pr-14`}
            />
            {picked && (
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10.5px] uppercase tracking-wide text-text-subtle">
                {picked.sellUnit}
              </span>
            )}
          </div>
          {fieldErrors["quantity"] && (
            <div className="mt-1 text-[10.5px] leading-snug text-fault">{fieldErrors["quantity"]}</div>
          )}
        </div>

        {/* ── Price ─────────────────────────────────────────────────── */}
        <div className="sm:col-span-4">
          <label className={labelCls}>Sold at (per {picked?.sellUnit.toLowerCase() ?? "unit"})</label>
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

        {/* ── When ──────────────────────────────────────────────────── */}
        <div className="sm:col-span-4">
          <label className={labelCls}>When?</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`${fieldCls} tabular-nums`}
          />
        </div>

        {/* ── Who ───────────────────────────────────────────────────── */}
        <div className="sm:col-span-4">
          <label className={labelCls}>Sold to</label>
          <input
            value={soldTo}
            onChange={(e) => setSoldTo(e.target.value)}
            maxLength={120}
            placeholder="Walk-in, or a name"
            className={fieldCls}
          />
        </div>

        <div className="sm:col-span-4">
          <label className={labelCls}>Note</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder="Optional"
            className={fieldCls}
          />
        </div>

        {error && (
          <div className="rounded-[8px] border border-fault/40 bg-fault/5 px-3 py-2 text-[11.5px] text-fault sm:col-span-12">
            {error}
          </div>
        )}
        {saved && (
          <div className="rounded-[8px] border border-solid/40 bg-solid/8 px-3 py-2 text-[11.5px] text-solid sm:col-span-12">
            {saved}
          </div>
        )}

        <div className="mt-1 flex flex-col gap-3 border-t border-rule pt-4 sm:col-span-12 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[11px] text-text-dim">
            {canSubmit
              ? "Ready — this comes straight off the stock list."
              : picked
              ? "Enter how many were sold."
              : "Pick the item that was sold."}
          </div>
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[8px] bg-gold px-5 text-[13px] font-semibold text-ink transition-colors hover:bg-gold-strong disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-text-faint"
          >
            {pending && <Loader2 size={12} className="animate-spin" />}
            Record sale
          </button>
        </div>
      </div>
    </form>
  );
}

function iso(d: Date): string { return d.toISOString().slice(0, 10); }

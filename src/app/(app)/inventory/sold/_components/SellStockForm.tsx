"use client";

// "Record a sale" — who bought, then everything they bought.
//
// Owner instruction, 2026-09-23: one client often buys many items, so
// the buyer is typed ONCE at the top and each item is marked underneath.
// The form is three parts, in the order the counter works in:
//
//   1. who it went to, when, and one note for the whole sale
//   2. an item at a time — pick, quantity, price, "Add to sale"
//      (SaleLineEditor)
//   3. what has been added, still editable, with the running total
//      (SaleLinesTable)
//
// One "Record sale" press writes the lot in a single transaction
// (recordStockSaleBatch), so a basket either lands whole or not at all.
// Each of its lines is still one SOLD_OUT row in the ledger — the Sold
// out list below is unchanged, and shows the items of one sale sharing a
// buyer and a date.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PackageMinus } from "lucide-react";
import { recordStockSaleBatch } from "@/modules/inventory/actions-sold-batch";
import type { SellableItem } from "@/modules/inventory/queries-sold";
import { SaleLineEditor } from "./SaleLineEditor";
import { SaleLinesTable } from "./SaleLinesTable";
import { lineQty, remainingItems, type SaleLine } from "./_sale-lines";
import { fieldCls, labelCls } from "./_form-primitives";

interface Props {
  items: SellableItem[];
}

export function SellStockForm({ items }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lineErrors, setLineErrors] = useState<Record<number, string>>({});
  const [saved, setSaved] = useState<string | null>(null);

  // The sale as a whole.
  const [soldTo, setSoldTo] = useState("");
  const [note, setNote]     = useState("");
  const [date, setDate]     = useState(iso(new Date()));
  const [lines, setLines]   = useState<SaleLine[]>([]);

  // The item currently being marked up, before it joins the basket.
  const [query, setQuery]   = useState("");
  const [picked, setPicked] = useState<SellableItem | null>(null);
  const [dyeLot, setDyeLot] = useState("");
  const [qty, setQty]       = useState("");
  const [rate, setRate]     = useState("");

  // What is still choosable: stock, less what the basket already holds.
  const choosable = useMemo(() => remainingItems(items, lines), [items, lines]);

  // The chosen item's headroom, measured after the basket's other lines.
  const headroom = picked
    ? Number(choosable.find((i) => i.colourwayId === picked.colourwayId)?.available
        ?? picked.available)
    : 0;

  const qtyNum = Number(qty);
  const blocker: string | null = !picked
    ? "Pick the item that was sold."
    : !Number.isFinite(qtyNum) || qtyNum <= 0
    ? "Enter how many were sold."
    : qtyNum > headroom
    ? `Only ${headroom} ${picked.sellUnit.toLowerCase()} left to sell${
        lines.some((l) => l.item.colourwayId === picked.colourwayId)
          ? ", counting what is already on this sale"
          : ""
      }.`
    : null;

  function choose(item: SellableItem): void {
    setPicked(item);
    setQuery("");
    setDyeLot("");
    setQty("");
    setError(null);
    // Pre-fill the catalogue's selling price. A starting point, not a
    // decision — counter sales get discounted and the field stays
    // editable.
    setRate(item.ratePaise === "0" ? "" : (Number(item.ratePaise) / 100).toString());
  }

  function clearPick(): void {
    setPicked(null); setQuery(""); setDyeLot(""); setQty(""); setRate("");
  }

  function addLine(): void {
    if (!picked || blocker) return;
    setLines((ls) => [...ls, {
      key:    `${picked.colourwayId}:${dyeLot}:${Date.now()}`,
      item:   picked,
      dyeLot,
      qty,
      rate,
    }]);
    setLineErrors({});
    setSaved(null);
    clearPick();
  }

  function patchLine(key: string, patch: Partial<Pick<SaleLine, "qty" | "rate">>): void {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    setLineErrors({});
  }

  function removeLine(key: string): void {
    setLines((ls) => ls.filter((l) => l.key !== key));
    setLineErrors({});
  }

  // Lines added, then edited to something unusable, must not be sent.
  const badLine = lines.findIndex((l) => {
    const q = lineQty(l);
    return !Number.isFinite(q) || q <= 0;
  });
  const canSubmit = lines.length > 0 && badLine === -1 && !pending;

  function onSubmit(e: React.FormEvent): void {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null); setLineErrors({}); setSaved(null);

    start(async () => {
      const res = await recordStockSaleBatch({
        soldOn: date,
        ...(soldTo.trim() ? { soldTo: soldTo.trim() } : {}),
        ...(note.trim()   ? { note:   note.trim() }   : {}),
        lines: lines.map((l) => ({
          colourwayId: l.item.colourwayId,
          quantity:    lineQty(l),
          ...(l.dyeLot        ? { dyeLot: l.dyeLot }        : {}),
          ...(l.rate.trim()   ? { rate:   l.rate.trim() }   : {}),
        })),
      });

      if (!res.ok) {
        setError(res.error === "Validation failed"
          ? "Some of these items could not be sold — see the lines marked below."
          : res.error ?? "Could not record the sale");
        // "lines.2.quantity" → the third row of the table.
        const byIndex: Record<number, string> = {};
        for (const [k, v] of Object.entries(res.fieldErrors ?? {})) {
          const m = /^lines\.(\d+)\./.exec(k);
          if (m?.[1] !== undefined) byIndex[Number(m[1])] = v;
        }
        setLineErrors(byIndex);
        return;
      }

      const n = res.data?.lineCount ?? lines.length;
      setSaved(
        `${n} ${n === 1 ? "item" : "items"} taken off stock${
          soldTo.trim() ? ` for ${soldTo.trim()}` : ""
        }.`,
      );
      setLines([]); setSoldTo(""); setNote(""); clearPick();
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
            Say who bought, then add every item they took. The stock list drops by
            the same amounts.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 p-5 sm:grid-cols-12">

        {/* ── The sale: typed once, however many items follow ───────── */}
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
          <label className={labelCls}>When?</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`${fieldCls} tabular-nums`}
          />
        </div>

        <div className="sm:col-span-4">
          <label className={labelCls}>Note</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder="Optional — applies to the whole sale"
            className={fieldCls}
          />
        </div>

        {/* ── The items, one at a time ──────────────────────────────── */}
        <div className="border-t border-rule pt-4 sm:col-span-12">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-dim">
            {lines.length === 0 ? "Add the items" : "Add another item"}
          </div>
          <SaleLineEditor
            items={choosable}
            picked={picked}
            onPick={choose}
            onClear={clearPick}
            query={query}
            setQuery={setQuery}
            dyeLot={dyeLot}
            setDyeLot={setDyeLot}
            qty={qty}
            setQty={setQty}
            rate={rate}
            setRate={setRate}
            blocker={blocker}
            onAdd={addLine}
          />
        </div>

        {lines.length > 0 && (
          <div className="sm:col-span-12">
            <SaleLinesTable
              lines={lines}
              lineErrors={lineErrors}
              onChange={patchLine}
              onRemove={removeLine}
            />
          </div>
        )}

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
            {lines.length === 0
              ? "Add at least one item to record the sale."
              : badLine >= 0
              ? `Line ${badLine + 1} needs a quantity.`
              : "Ready — this comes straight off the stock list."}
          </div>
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[8px] bg-gold px-5 text-[13px] font-semibold text-ink transition-colors hover:bg-gold-strong disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-text-faint"
          >
            {pending && <Loader2 size={12} className="animate-spin" />}
            {lines.length > 1 ? `Record sale · ${lines.length} items` : "Record sale"}
          </button>
        </div>
      </div>
    </form>
  );
}

function iso(d: Date): string { return d.toISOString().slice(0, 10); }

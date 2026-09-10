"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Plus, Trash2 } from "lucide-react";
import { formatINR, parseINR } from "@/kernel/money/format";
import { createPO } from "@/modules/purchase/actions";
import { POItemCell } from "./POItemCell";
import type { VendorPickerRow } from "@/modules/vendors/queries";
import type { ColourwayPickerRow } from "@/modules/purchase/queries";
import { GST_RATES, SELL_UNITS } from "@/modules/purchase/schema";
import { calcPOTotals, scaleQty } from "@/lib/calc/purchase-order";

type SellUnit = (typeof SELL_UNITS)[number];

// A catalogued line takes its unit from the colourway. A typed one has no
// colourway to take it from, so the buyer picks.
const UNIT_OPTIONS = SELL_UNITS;

interface Draft {
  colourwayId: string;
  /** Typed item name, used when the catalogue does not carry it yet. */
  freeTextItem: string;
  /** Which of the two the line is using. Only one is ever sent. */
  mode: "catalogue" | "typed";
  unit: SellUnit;
  quantity: string;
  rate: string;
  gstRate: string;
}

const EMPTY: Draft = {
  colourwayId: "", freeTextItem: "", mode: "catalogue",
  unit: "METRE", quantity: "1", rate: "", gstRate: "0",
};

interface Props {
  vendors:      VendorPickerRow[];
  colourways:   ColourwayPickerRow[];
  initialLines?: Draft[];
}

export function POBuilder({ vendors, colourways, initialLines }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const today = new Date();
  const nextMonth = new Date(); nextMonth.setDate(today.getDate() + 15);
  const [date, setDate] = useState<string>(iso(today));
  const [expectedAt, setExpectedAt] = useState<string>(iso(nextMonth));
  const [vendorId, setVendorId] = useState<string>("");
  const [lines, setLines] = useState<Draft[]>(initialLines?.length ? initialLines : [{ ...EMPTY }]);

  const colourwayMap = useMemo(() => new Map(colourways.map((c) => [c.id, c])), [colourways]);

  // Same pure calculation the server runs, so the figure on screen is the
  // figure that gets saved.
  const totals = useMemo(() => calcPOTotals(
    lines
      .filter((l) => (l.mode === "typed" ? l.freeTextItem.trim() : l.colourwayId))
      .map((l) => ({
        ratePaise:      safePaise(l.rate),
        quantityScaled: scaleQty(Number(l.quantity) || 0),
        gstRatePct:     Number(l.gstRate) || 0,
      })),
  ), [lines]);
  const gstValue = totals.cgst + totals.sgst + totals.igst;

  function updateLine(i: number, patch: Partial<Draft>) {
    setLines((ls) => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }
  function addLine()    { setLines((ls) => [...ls, { ...EMPTY }]); }
  function removeLine(i: number) {
    setLines((ls) => ls.length === 1 ? ls : ls.filter((_, idx) => idx !== i));
  }
  function onPickColourway(i: number, id: string) {
    const c = colourwayMap.get(id);
    updateLine(i, { colourwayId: id, unit: (c?.sellUnit as SellUnit) ?? "METRE" });
  }
  /** Flip a line between picking from the catalogue and typing a name.
   *  Clears the other side so a line can never carry both. */
  function setMode(i: number, mode: Draft["mode"]) {
    updateLine(i, mode === "typed"
      ? { mode, colourwayId: "" }
      : { mode, freeTextItem: "" });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    startTransition(async () => {
      const payload = {
        vendorId, date, expectedAt,
        lines: lines
          .filter((l) => (l.mode === "typed" ? l.freeTextItem.trim() : l.colourwayId))
          .map((l) => ({
            ...(l.mode === "typed"
              ? { freeTextItem: l.freeTextItem.trim() }
              : { colourwayId: l.colourwayId }),
            unit: l.unit,
            quantity: Number(l.quantity),
            rate: l.rate,
            gstRate: Number(l.gstRate) || 0,
          })),
      };
      const res = await createPO(payload);
      if (!res.ok) { setServerError(res.error ?? "Could not create PO"); return; }
      router.push(`/purchase/${res.data!.id}` as Route);
      router.refresh();
    });
  }

  // An empty catalogue no longer blocks the form: buying something the
  // catalogue does not carry is exactly what the typed line is for.
  if (vendors.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule py-14 text-center">
        <div className="text-[14px] text-text mb-2">Add a vendor first.</div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-[14px] bg-surface border border-rule p-5 grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <Field label="Vendor" required>
          <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={fieldCls}>
            <option value="">— pick a vendor —</option>
            {vendors.map((v) => (<option key={v.id} value={v.id}>{v.name}</option>))}
          </select>
        </Field>
        <Field label="PO date" required>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${fieldCls} tabular`} />
        </Field>
        <Field label="Expected by">
          <input type="date" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} className={`${fieldCls} tabular`} />
        </Field>
      </div>

      <div className="rounded-[14px] bg-surface border border-rule overflow-x-auto">
        <table className="min-w-[480px] w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
              <Th>Item</Th>
              <Th align="right" width={110}>Qty</Th>
              <Th align="right" width={140}>Rate (₹)</Th>
              <Th align="right" width={80}>GST %</Th>
              <Th align="right" width={140}>Amount (ex GST)</Th>
              <Th width={30}></Th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const rate = safePaise(l.rate);
              const qty = Number(l.quantity) || 0;
              const amount = (rate * BigInt(Math.round(qty * 10_000))) / 10_000n;
              return (
                <tr key={i} className="border-b border-rule/70 last:border-0 align-top">
                  <Td>
                    <POItemCell
                      line={l}
                      colourways={colourways}
                      onPick={(id) => onPickColourway(i, id)}
                      onType={(v) => updateLine(i, { freeTextItem: v })}
                      onMode={(m) => setMode(i, m)}
                    />
                  </Td>
                  <Td align="right">
                    <div className="inline-flex items-baseline gap-1">
                      <input inputMode="decimal" value={l.quantity}
                             onChange={(e) => updateLine(i, { quantity: e.target.value })}
                             className={`${cellCls} tabular text-right w-[64px]`} />
                      {l.mode === "typed" ? (
                        <select value={l.unit}
                                onChange={(e) => updateLine(i, { unit: e.target.value as SellUnit })}
                                aria-label="Unit"
                                className={`${cellCls} text-[10.5px] w-[86px]`}>
                          {UNIT_OPTIONS.map((u) => (
                            <option key={u} value={u}>{u.toLowerCase().replace("_", " ")}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-[10.5px] text-text-faint">{l.unit.toLowerCase()}</span>
                      )}
                    </div>
                  </Td>
                  <Td align="right">
                    <input inputMode="decimal" value={l.rate}
                           onChange={(e) => updateLine(i, { rate: e.target.value })}
                           className={`${cellCls} tabular text-right`} />
                  </Td>
                  <Td align="right">
                    <select value={l.gstRate}
                            onChange={(e) => updateLine(i, { gstRate: e.target.value })}
                            className={`${cellCls} text-right w-[56px]`}>
                      {GST_RATES.map((r) => (
                        <option key={r} value={String(r)}>{r}%</option>
                      ))}
                    </select>
                  </Td>
                  <Td align="right"><span className="tabular text-text font-medium">{formatINR(amount)}</span></Td>
                  <Td>
                    <button type="button" onClick={() => removeLine(i)} disabled={lines.length === 1}
                            aria-label="Remove"
                            className="h-[24px] w-[24px] grid place-items-center rounded-[4px] text-text-faint hover:text-bad hover:bg-bad/10 transition-colors disabled:opacity-30">
                      <Trash2 size={12} />
                    </button>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-4 py-2 border-t border-rule">
          <button type="button" onClick={addLine}
                  className="inline-flex items-center gap-1.5 h-[28px] px-3 rounded-[6px] text-[11.5px] text-text-dim hover:text-text hover:bg-surface-hover transition-colors">
            <Plus size={12} /> Add line
          </button>
        </div>
      </div>

      {serverError && <div className="text-[12px] text-bad">{serverError}</div>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <SumLine label="Subtotal" value={formatINR(totals.taxableAmount)} />
          <SumLine label="GST" value={formatINR(gstValue)} />
          {totals.roundOff !== 0n && (
            <SumLine label="Round off" value={formatINR(totals.roundOff)} />
          )}
          <div className="flex items-baseline gap-2">
            <span className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">Total</span>
            <span className="font-display text-[22px] font-semibold text-text tabular-nums">
              {formatINR(totals.total)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()}
                  className="h-[36px] px-4 rounded-[8px] text-[12.5px] text-text-dim hover:text-text hover:bg-surface-hover transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={pending}
                  className="h-[36px] px-5 rounded-[8px] bg-accent text-white text-[12.5px] font-medium hover:bg-accent-hover disabled:opacity-60 transition-colors">
            {pending ? "Saving…" : "Create purchase order"}
          </button>
        </div>
      </div>
    </form>
  );
}

const fieldCls =
  "w-full h-[34px] px-3 bg-white/60 border border-rule rounded-[6px] text-[12.5px] outline-none focus:border-accent transition-colors";
const cellCls =
  "w-full h-[28px] px-2 bg-white/60 border border-rule rounded-[4px] text-[12.5px] outline-none focus:border-accent";

function iso(d: Date): string { return d.toISOString().slice(0, 10); }
function safePaise(v: string): bigint {
  if (!v?.trim()) return 0n;
  try { return parseINR(v); } catch { return 0n; }
}
function Field({
  label, required, children,
}: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] tracking-[0.06em] uppercase text-text-dim">
        {label}{required && <span className="text-accent"> *</span>}
      </div>
      {children}
    </div>
  );
}
function Th({
  children, align = "left", width,
}: { children?: React.ReactNode; align?: "left" | "right"; width?: number }) {
  return (
    <th style={width ? { width } : undefined}
        className={`px-3 h-[34px] font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}
function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <td className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"}`}>{children}</td>;
}
function SumLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">{label}</span>
      <span className="text-[13px] text-text tabular-nums">{value}</span>
    </div>
  );
}

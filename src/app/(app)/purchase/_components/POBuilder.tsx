"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Plus, Trash2 } from "lucide-react";
import { formatINR, parseINR } from "@/kernel/money/format";
import { createPO } from "@/modules/purchase/actions";
import type { VendorPickerRow } from "@/modules/vendors/queries";
import type { ProductPickerRow as InvProductRow } from "@/modules/inventory/queries";
import type { BranchOption } from "@/modules/branches/queries";

interface Draft { productId: string; quantity: string; rate: string; description: string; }
const EMPTY: Draft = { productId: "", quantity: "1", rate: "", description: "" };

interface Props {
  vendors: VendorPickerRow[];
  products: InvinvExtended[];
  branches: BranchOption[];
}
type InvinvExtended = InvProductRow & { gstRate: number };

export function POBuilder({ vendors, products, branches }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const today = new Date();
  const nextMonth = new Date(); nextMonth.setDate(today.getDate() + 15);
  const [date, setDate] = useState<string>(iso(today));
  const [expectedDate, setExpectedDate] = useState<string>(iso(nextMonth));
  const [vendorId, setVendorId] = useState<string>("");
  const [branchId, setBranchId] = useState<string>(branches[0]?.id ?? "");
  const [lines, setLines] = useState<Draft[]>([{ ...EMPTY }]);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const preview = useMemo(() => {
    let taxable = 0n, gst = 0n;
    for (const l of lines) {
      const p = productMap.get(l.productId);
      if (!p) continue;
      const rate = safePaise(l.rate);
      const qty = Number(l.quantity) || 0;
      const gross = (rate * BigInt(Math.round(qty * 10_000))) / 10_000n;
      taxable += gross;
      gst += (gross * BigInt(Math.round(p.gstRate * 100))) / 10_000n;
    }
    return { taxable, gst, total: taxable + gst };
  }, [lines, productMap]);

  function updateLine(i: number, patch: Partial<Draft>) {
    setLines((ls) => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }
  function addLine()    { setLines((ls) => [...ls, { ...EMPTY }]); }
  function removeLine(i: number) {
    setLines((ls) => ls.length === 1 ? ls : ls.filter((_, idx) => idx !== i));
  }
  function onPick(i: number, id: string) {
    const p = productMap.get(id);
    updateLine(i, { productId: id, description: p?.name ?? "" });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    startTransition(async () => {
      const payload = {
        vendorId, branchId, date, expectedDate,
        lines: lines.map((l) => ({
          productId: l.productId, description: l.description,
          quantity: Number(l.quantity), rate: l.rate,
        })),
      };
      const res = await createPO(payload);
      if (!res.ok) { setServerError(res.error ?? "Could not create PO"); return; }
      router.push(`/purchase/${res.data!.id}` as Route);
      router.refresh();
    });
  }

  if (vendors.length === 0 || products.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule py-14 text-center">
        <div className="text-[14px] text-text mb-2">
          {vendors.length === 0 ? "Add a vendor first." : "Add a product first."}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-[14px] bg-surface border border-rule p-5 grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Field label="Vendor" required>
          <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={fieldCls}>
            <option value="">— pick a vendor —</option>
            {vendors.map((v) => (<option key={v.id} value={v.id}>{v.name}</option>))}
          </select>
        </Field>
        <Field label="Buying branch" required>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={fieldCls}>
            {branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
          </select>
        </Field>
        <Field label="PO date" required>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${fieldCls} tabular`} />
        </Field>
        <Field label="Expected by">
          <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className={`${fieldCls} tabular`} />
        </Field>
      </div>

      <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
              <Th>Product</Th>
              <Th align="right" width={80}>Qty</Th>
              <Th align="right" width={140}>Rate</Th>
              <Th align="right" width={80}>GST</Th>
              <Th align="right" width={130}>Amount</Th>
              <Th width={30}></Th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const p = productMap.get(l.productId);
              const rate = safePaise(l.rate);
              const qty = Number(l.quantity) || 0;
              const gross = (rate * BigInt(Math.round(qty * 10_000))) / 10_000n;
              const gst = p ? (gross * BigInt(Math.round(p.gstRate * 100))) / 10_000n : 0n;
              return (
                <tr key={i} className="border-b border-rule/70 last:border-0 align-top">
                  <Td>
                    <select value={l.productId} onChange={(e) => onPick(i, e.target.value)}
                            className={`${cellCls} min-w-[220px]`}>
                      <option value="">— select —</option>
                      {products.map((prod) => (
                        <option key={prod.id} value={prod.id}>{prod.code} — {prod.name}</option>
                      ))}
                    </select>
                    {p && (
                      <input value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })}
                             placeholder="Line description"
                             className={`${cellCls} mt-1 text-[11.5px] text-text-dim`} />
                    )}
                  </Td>
                  <Td align="right">
                    <input inputMode="decimal" value={l.quantity}
                           onChange={(e) => updateLine(i, { quantity: e.target.value })}
                           className={`${cellCls} tabular text-right`} />
                    {p && <div className="text-[10.5px] text-text-faint mt-1">{p.uom}</div>}
                  </Td>
                  <Td align="right">
                    <input inputMode="decimal" value={l.rate}
                           onChange={(e) => updateLine(i, { rate: e.target.value })}
                           className={`${cellCls} tabular text-right`} />
                  </Td>
                  <Td align="right"><span className="tabular text-text-dim">{p ? `${p.gstRate}%` : "—"}</span></Td>
                  <Td align="right"><span className="tabular text-text font-medium">{formatINR(gross + gst)}</span></Td>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-[14px] bg-surface border border-rule p-5">
          {serverError && <div className="text-[12px] text-bad mb-3">{serverError}</div>}
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => router.back()}
                    className="h-[36px] px-4 rounded-[8px] text-[12.5px] text-text-dim hover:text-text hover:bg-surface-hover transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={pending}
                    className="h-[36px] px-5 rounded-[8px] bg-accent text-white text-[12.5px] font-medium hover:bg-accent-hover disabled:opacity-60 transition-colors">
              {pending ? "Saving…" : "Issue purchase order"}
            </button>
          </div>
        </div>
        <div className="rounded-[14px] bg-surface border border-rule p-5">
          <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">Totals (preview)</div>
          <dl className="space-y-2 text-[12.5px]">
            <Row k="Taxable" v={formatINR(preview.taxable)} />
            <Row k="GST" v={formatINR(preview.gst)} />
            <div className="pt-2 mt-2 border-t border-rule flex items-baseline justify-between">
              <dt className="text-text uppercase text-[10.5px] tracking-[0.14em]">Grand total</dt>
              <dd className="font-display text-[20px] font-semibold text-text tabular-nums">{formatINR(preview.total)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-[10.5px] text-text-faint">Server recomputes on save.</p>
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
  if (v == null || v.trim() === "") return 0n;
  try { return parseINR(v); } catch { return 0n; }
}
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] tracking-[0.06em] uppercase text-text-dim">
        {label}{required && <span className="text-accent"> *</span>}
      </div>
      {children}
    </div>
  );
}
function Th({ children, align = "left", width }: { children?: React.ReactNode; align?: "left" | "right"; width?: number }) {
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
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-dim text-[11.5px]">{k}</dt>
      <dd className="text-text text-right tabular">{v}</dd>
    </div>
  );
}

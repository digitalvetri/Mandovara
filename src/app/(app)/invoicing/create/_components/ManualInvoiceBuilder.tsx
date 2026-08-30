"use client";

// Write the invoice yourself.
//
// Owner, 2026-08-30: "i want to create invoice by myself". The lines
// start prefilled from the project's current quotation — that is almost
// always the right starting point and saves retyping — but every field
// is editable and lines can be added or removed. Clear the lot and type
// something else if the job changed.
//
// Same five columns as the quotation builder and the printed document:
// Item, Unit, Qty, Rate, Amount. One vocabulary across the app.

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Plus, X, Loader2, FileText } from "lucide-react";
import { SELL_UNITS } from "@/modules/quotations/schema";
import { createManualInvoice } from "@/modules/invoices/actions-manual";

export interface SeedLine {
  description: string;
  unit:        string;
  quantity:    string;
  rate:        string;   // rupees, as text
  gstRate:     number;
}

interface Line extends SeedLine { key: string }

const GST_RATES = [0, 5, 12, 18, 28];

function newLine(seed?: SeedLine): Line {
  return {
    key: Math.random().toString(36).slice(2),
    description: seed?.description ?? "",
    unit:        seed?.unit ?? "PIECE",
    quantity:    seed?.quantity ?? "1",
    rate:        seed?.rate ?? "",
    gstRate:     seed?.gstRate ?? 18,
  };
}

function money(n: number): string {
  if (!isFinite(n)) return "₹0";
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function iso(d: Date): string { return d.toISOString().slice(0, 10); }

export function ManualInvoiceBuilder({
  projectId, projectName, clientName, seed, seededFrom,
}: {
  projectId: string;
  projectName: string;
  clientName: string;
  seed: SeedLine[];
  seededFrom: string | null;
}) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>(
    seed.length > 0 ? seed.map((s) => newLine(s)) : [newLine()],
  );
  const [date, setDate]       = useState(iso(new Date()));
  const [dueDate, setDueDate] = useState(iso(new Date(Date.now() + 30 * 86_400_000)));
  const [error, setError]     = useState<string | null>(null);
  const [pending, start]      = useTransition();

  function patch(i: number, next: Partial<Line>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...next } : l)));
  }

  const totals = useMemo(() => {
    let taxable = 0, gst = 0;
    for (const l of lines) {
      const q = parseFloat(l.quantity) || 0;
      const r = parseFloat(l.rate.replace(/[,\s₹]/g, "")) || 0;
      const t = q * r;
      taxable += t;
      gst += t * (l.gstRate / 100);
    }
    return { taxable, gst, total: taxable + gst };
  }, [lines]);

  function save() {
    setError(null);
    start(async () => {
      const r = await createManualInvoice({
        projectId, date, dueDate,
        lines: lines.map((l) => ({
          description: l.description.trim(),
          unit: l.unit, quantity: l.quantity, rate: l.rate, gstRate: l.gstRate,
        })),
      });
      if (!r.ok || !r.data) { setError(r.error ?? "Could not create the invoice."); return; }
      router.push(`/invoicing/${r.data.id}` as Route);
    });
  }

  return (
    <div className="space-y-4 pb-10">
      {/* Who and when */}
      <div className="grid grid-cols-1 gap-4 rounded-[14px] border border-rule bg-surface p-5 sm:grid-cols-4">
        <Meta label="Client"  value={clientName} />
        <Meta label="Project" value={projectName} />
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-[0.1em] text-text-dim">Invoice date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={FIELD} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-[0.1em] text-text-dim">Due date</span>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={FIELD} />
        </label>
      </div>

      {seededFrom && (
        <p className="text-[12.5px] text-text-dim">
          Lines start from <span className="text-text">{seededFrom}</span> — edit anything, or clear them and type your own.
        </p>
      )}

      {/* Lines */}
      <div className="overflow-hidden rounded-[14px] border border-rule bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className="border-b border-rule">
                <Th>Item</Th>
                <Th width={110}>Unit</Th>
                <Th width={80} align="right">Qty</Th>
                <Th width={120} align="right">Rate (₹)</Th>
                <Th width={80} align="right">GST %</Th>
                <Th width={110} align="right">Amount</Th>
                <th className="w-[40px]" />
              </tr>
            </thead>
            <tbody className="divide-y divide-rule/60">
              {lines.map((l, i) => {
                const amt = (parseFloat(l.quantity) || 0) * (parseFloat(l.rate.replace(/[,\s₹]/g, "")) || 0);
                return (
                  <tr key={l.key}>
                    <Td>
                      <input value={l.description} onChange={(e) => patch(i, { description: e.target.value })}
                             placeholder="e.g. MBR main curtain, Installation charge" className={FIELD} />
                    </Td>
                    <Td>
                      <select value={l.unit} onChange={(e) => patch(i, { unit: e.target.value })} className={FIELD}>
                        {SELL_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </Td>
                    <Td>
                      <input value={l.quantity} inputMode="decimal"
                             onChange={(e) => patch(i, { quantity: e.target.value.replace(/[^0-9.]/g, "") })}
                             className={`${FIELD} text-right`} />
                    </Td>
                    <Td>
                      <input value={l.rate} inputMode="decimal" placeholder="0.00"
                             onChange={(e) => patch(i, { rate: e.target.value.replace(/[^0-9.]/g, "") })}
                             className={`${FIELD} text-right`} />
                    </Td>
                    <Td>
                      <select value={l.gstRate} onChange={(e) => patch(i, { gstRate: Number(e.target.value) })}
                              className={`${FIELD} text-right`}>
                        {GST_RATES.map((g) => <option key={g} value={g}>{g}%</option>)}
                      </select>
                    </Td>
                    <Td align="right">
                      <span className="text-[13.5px] font-medium tabular-nums text-text">{money(amt)}</span>
                    </Td>
                    <td className="px-2 text-right">
                      <button type="button" onClick={() => setLines((ls) => ls.filter((_, x) => x !== i))}
                              disabled={lines.length === 1} aria-label="Remove line"
                              className="grid h-7 w-7 place-items-center rounded-[5px] text-text-dim transition-colors hover:bg-heat/10 hover:text-heat disabled:opacity-30">
                        <X size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t border-rule/60 p-3">
          <button type="button" onClick={() => setLines((ls) => [...ls, newLine()])}
                  className="inline-flex h-8 items-center gap-1.5 rounded-[6px] px-3 text-[12.5px] text-text-dim transition-colors hover:bg-surface-2 hover:text-text">
            <Plus size={13} /> Add line
          </button>
        </div>
      </div>

      {/* Totals + save */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {error && <p className="mb-2 text-[13px] text-heat" role="alert">{error}</p>}
          <button type="button" onClick={save} disabled={pending}
                  className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-gold px-5 text-[13.5px] font-semibold text-ink transition-colors hover:bg-gold-strong disabled:opacity-50">
            {pending ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            Create invoice
          </button>
        </div>

        <div className="w-full max-w-[280px] rounded-[12px] border border-rule bg-surface p-4">
          <Row k="Sub-total" v={money(totals.taxable)} />
          <Row k="GST"       v={money(totals.gst)} />
          <div className="mt-2 flex items-baseline justify-between border-t border-rule pt-2">
            <span className="text-[12px] uppercase tracking-[0.1em] text-text-dim">Total</span>
            <span className="font-display text-[19px] font-semibold tabular-nums text-text">{money(totals.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const FIELD =
  "h-[34px] w-full rounded-[6px] border border-rule bg-surface-2 px-2.5 text-[13px] text-text outline-none transition-colors placeholder:text-text-faint focus:border-accent";

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.1em] text-text-dim">{label}</div>
      <div className="mt-1 text-[14px] font-medium text-text">{value}</div>
    </div>
  );
}

function Th({ children, width, align }: { children?: React.ReactNode; width?: number; align?: "right" }) {
  return (
    <th style={width ? { width } : undefined}
        className={`px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-dim ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function Td({ children, align }: { children?: React.ReactNode; align?: "right" }) {
  return <td className={`px-3 py-2 ${align === "right" ? "text-right" : ""}`}>{children}</td>;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between py-1 text-[13px]">
      <span className="text-text-dim">{k}</span>
      <span className="tabular-nums text-text">{v}</span>
    </div>
  );
}

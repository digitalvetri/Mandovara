"use client";

// Wire serialisation and shared UI primitives for ReceiptRecorder.
// BigInts don't survive JSON — the API route sends strings, we widen back here.

import type { OutstandingInvoice } from "@/modules/receipts/queries";

// ── wire serialisation ───────────────────────────────────────────

export interface OutstandingInvoiceWire {
  id: string;
  number: string;
  date: string;
  dueDate: string;
  total: string;
  paidTotal: string;
  advanceAdjusted: string;
  outstanding: string;
}

export function wireToBigInt(w: OutstandingInvoiceWire): OutstandingInvoice {
  return {
    id: w.id, number: w.number,
    date: new Date(w.date), dueDate: new Date(w.dueDate),
    total: BigInt(w.total), paidTotal: BigInt(w.paidTotal),
    advanceAdjusted: BigInt(w.advanceAdjusted),
    outstanding: BigInt(w.outstanding),
  };
}

// ── CSS constants ────────────────────────────────────────────────

export const fieldCls =
  "w-full h-[34px] px-3 bg-white/60 border border-rule rounded-[6px] text-[12.5px] outline-none focus:border-accent transition-colors";

export const cellCls =
  "w-full h-[28px] px-2 bg-white/60 border border-rule rounded-[4px] text-[12.5px] outline-none focus:border-accent";

// ── helpers ──────────────────────────────────────────────────────

import { parseINR } from "@/kernel/money/format";

export function iso(d: Date): string { return d.toISOString().slice(0, 10); }
export function fmt(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" });
}
export function safePaise(v: string): bigint {
  if (v == null || v.trim() === "") return 0n;
  try { return parseINR(v); } catch { return 0n; }
}

// ── UI primitives ────────────────────────────────────────────────

export function Field({
  label, required, error, hint, span = 1, children,
}: { label: string; required?: boolean; error?: string; hint?: string; span?: 1 | 2 | 3;
     children: React.ReactNode }) {
  const spanCls = span === 3 ? "col-span-3" : span === 2 ? "lg:col-span-2" : undefined;
  return (
    <div className={spanCls}>
      <div className="mb-1 text-[11px] tracking-[0.06em] uppercase text-text-dim">
        {label}{required && <span className="text-accent"> *</span>}
      </div>
      {children}
      <div className="mt-1 min-h-[14px] text-[11px]">
        {error ? <span className="text-bad">{error}</span>
              : hint ? <span className="text-text-faint">{hint}</span> : null}
      </div>
    </div>
  );
}

export function Th({ children, align = "left", width }: {
  children: React.ReactNode; align?: "left" | "right"; width?: number;
}) {
  return (
    <th
      style={width ? { width } : undefined}
      className={`px-3 h-[34px] font-medium ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

export function Td({ children, align = "left", className = "" }: {
  children: React.ReactNode; align?: "left" | "right"; className?: string;
}) {
  return (
    <td className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"} ${className}`}>
      {children}
    </td>
  );
}

export function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-dim text-[11.5px]">{k}</dt>
      <dd className="text-text text-right tabular">{v}</dd>
    </div>
  );
}

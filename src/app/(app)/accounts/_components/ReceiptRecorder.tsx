"use client";

// Record-receipt page. Pick a client → their outstanding invoices load →
// enter a total received → auto-suggest oldest-first allocation → user can
// tune per-invoice amounts → live "applied" / "on account" summary → save.
//
// Server recomputes and refuses over-allocation (per-invoice + total).

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Wand2 } from "lucide-react";
import { formatINR, parseINR } from "@/kernel/money/format";
import { createReceipt } from "@/modules/receipts/actions";
import { PAYMENT_MODES, type PaymentMode } from "@/modules/receipts/schema";
import type {
  ClientForReceiptOption, OutstandingInvoice,
} from "@/modules/receipts/queries";
import type { BranchOption } from "@/modules/branches/queries";

interface Props {
  clients: ClientForReceiptOption[];
  branches: BranchOption[];
}

export function ReceiptRecorder({ clients, branches }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [clientId, setClientId] = useState<string>("");
  const [branchId, setBranchId] = useState<string>(branches[0]?.id ?? "");
  const [date, setDate] = useState<string>(iso(new Date()));
  const [mode, setMode] = useState<PaymentMode>("UPI");
  const [reference, setReference] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [outstanding, setOutstanding] = useState<OutstandingInvoice[]>([]);
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const [loadingOutstanding, setLoadingOutstanding] = useState(false);

  // Load outstanding invoices whenever the client changes.
  useEffect(() => {
    if (!clientId) { setOutstanding([]); setAlloc({}); return; }
    setLoadingOutstanding(true);
    fetch(`/api/receipts/outstanding?clientId=${clientId}`)
      .then((r) => r.json())
      .then((rows: OutstandingInvoiceWire[]) => {
        setOutstanding(rows.map(wireToBigInt));
        setAlloc({});
      })
      .finally(() => setLoadingOutstanding(false));
  }, [clientId]);

  const totalPaise = safePaise(amount);
  const allocatedPaise = useMemo(
    () => Object.values(alloc).reduce((s, v) => s + safePaise(v), 0n),
    [alloc],
  );
  const unallocated = totalPaise > allocatedPaise ? totalPaise - allocatedPaise : 0n;
  const over = allocatedPaise > totalPaise ? allocatedPaise - totalPaise : 0n;

  function autoAllocate() {
    // Oldest-first waterfall. Only fills invoices; the leftover stays as
    // "on account" (unallocated on the receipt row).
    let left = totalPaise;
    const next: Record<string, string> = {};
    for (const inv of outstanding) {
      if (left <= 0n) { next[inv.id] = ""; continue; }
      const take = left >= inv.outstanding ? inv.outstanding : left;
      next[inv.id] = (Number(take) / 100).toString();
      left -= take;
    }
    setAlloc(next);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    setFieldErrors({});
    startTransition(async () => {
      const allocations = Object.entries(alloc)
        .filter(([, v]) => v && v.trim() !== "" && safePaise(v) > 0n)
        .map(([invoiceId, v]) => ({ invoiceId, amount: v }));
      const payload = {
        clientId, branchId, date, mode, reference, amount, allocations,
      };
      const res = await createReceipt(payload);
      if (!res.ok) {
        setServerError(res.error ?? "Could not record receipt");
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      router.push(`/accounts/${res.data!.id}` as Route);
      router.refresh();
    });
  }

  if (clients.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule py-14 text-center">
        <div className="text-[14px] text-text mb-2">No clients yet.</div>
        <p className="text-[12px] text-text-dim">Add a client first, then record a receipt against their invoices.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-[14px] bg-surface border border-rule p-5 grid grid-cols-5 gap-4">
        <Field label="Client" required error={fieldErrors["clientId"]} span={2}>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={fieldCls}>
            <option value="">— pick a client —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name} · {c.mobile}</option>
            ))}
          </select>
        </Field>
        <Field label="Branch" required error={fieldErrors["branchId"]}>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={fieldCls}>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        <Field label="Date" required>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${fieldCls} tabular`} />
        </Field>
        <Field label="Mode" required>
          <select value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)} className={fieldCls}>
            {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Amount received" required error={fieldErrors["amount"]}>
          <input value={amount} onChange={(e) => setAmount(e.target.value)}
                 inputMode="decimal" placeholder="e.g. 25000 or 25k"
                 className={`${fieldCls} tabular`} />
        </Field>
        <Field label="Reference" span={2} hint="UPI txn id, cheque no., NEFT ref">
          <input value={reference} onChange={(e) => setReference(e.target.value)}
                 className={`${fieldCls} tabular`} />
        </Field>
        <div className="lg:col-span-2 flex items-end">
          <button type="button" onClick={autoAllocate}
                  disabled={!clientId || totalPaise <= 0n || outstanding.length === 0}
                  className="inline-flex items-center gap-1.5 h-[34px] px-3 rounded-[6px] border border-accent text-accent text-[12px] font-medium hover:bg-accent/10 disabled:opacity-40 transition-colors">
            <Wand2 size={13} />
            Auto-allocate oldest first
          </button>
        </div>
      </div>

      <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
        <div className="px-4 py-2 border-b border-rule flex items-baseline justify-between">
          <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
            Outstanding invoices
          </div>
          <div className="text-[10.5px] text-text-dim tabular">
            {clientId
              ? (loadingOutstanding ? "Loading…" : `${outstanding.length} invoice${outstanding.length === 1 ? "" : "s"}`)
              : "Pick a client to load invoices"}
          </div>
        </div>
        {outstanding.length === 0 ? (
          <div className="py-8 text-center text-[12px] text-text-faint">
            {clientId && !loadingOutstanding ? "This client has no outstanding invoices." : ""}
          </div>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                <Th>Number</Th>
                <Th>Date</Th>
                <Th>Due</Th>
                <Th align="right">Total</Th>
                <Th align="right">Received earlier</Th>
                <Th align="right">Outstanding</Th>
                <Th align="right" width={140}>Allocate now</Th>
              </tr>
            </thead>
            <tbody>
              {outstanding.map((inv) => {
                const err = fieldErrors[`allocations.${inv.id}`];
                return (
                  <tr key={inv.id} className="border-b border-rule/60 last:border-0 align-top">
                    <Td><span className="tabular text-text">{inv.number}</span></Td>
                    <Td className="text-text-dim tabular">{fmt(inv.date)}</Td>
                    <Td className="text-text-dim tabular">{fmt(inv.dueDate)}</Td>
                    <Td align="right"><span className="tabular text-text-dim">{formatINR(inv.total)}</span></Td>
                    <Td align="right"><span className="tabular text-text-dim">{formatINR(inv.paidTotal)}</span></Td>
                    <Td align="right"><span className="tabular text-text">{formatINR(inv.outstanding)}</span></Td>
                    <Td align="right">
                      <input inputMode="decimal" value={alloc[inv.id] ?? ""}
                             onChange={(e) => setAlloc((a) => ({ ...a, [inv.id]: e.target.value }))}
                             placeholder="0"
                             className={`${cellCls} tabular text-right`} />
                      {err && <div className="mt-1 text-[10.5px] text-bad text-right">{err}</div>}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-[14px] bg-surface border border-rule p-5">
          {serverError && <div className="text-[12px] text-bad mb-3">{serverError}</div>}
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => router.back()}
                    className="h-[36px] px-4 rounded-[8px] text-[12.5px] text-text-dim hover:text-text hover:bg-surface-hover transition-colors">
              Cancel
            </button>
            <button type="submit"
                    disabled={pending || totalPaise <= 0n || over > 0n || allocatedPaise === 0n}
                    className="h-[36px] px-5 rounded-[8px] bg-accent text-white text-[12.5px] font-medium hover:bg-accent-hover disabled:opacity-60 transition-colors">
              {pending ? "Saving…" : "Record receipt"}
            </button>
          </div>
        </div>
        <div className="rounded-[14px] bg-surface border border-rule p-5">
          <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">Summary</div>
          <dl className="space-y-2 text-[12.5px]">
            <Row k="Amount received" v={formatINR(totalPaise)} />
            <Row k="Applied to invoices" v={formatINR(allocatedPaise)} />
            <div className="pt-2 mt-2 border-t border-rule flex items-baseline justify-between">
              <dt className={`uppercase text-[10.5px] tracking-[0.14em] ${over > 0n ? "text-bad" : "text-text"}`}>
                {over > 0n ? "Over-allocated" : "On account (residual)"}
              </dt>
              <dd className={`font-display text-[18px] font-semibold tabular-nums ${over > 0n ? "text-bad" : (unallocated > 0n ? "text-warn" : "text-text-faint")}`}>
                {over > 0n ? formatINR(over) : (unallocated > 0n ? formatINR(unallocated) : "₹0")}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-[10.5px] text-text-faint">
            Residual stays on the receipt as unallocated and can be applied later.
          </p>
        </div>
      </div>
    </form>
  );
}

// ── serialisation for wire ───────────────────────────────────────
// BigInts don't survive JSON; the API route sends strings, we widen back.

interface OutstandingInvoiceWire {
  id: string;
  number: string;
  date: string;
  dueDate: string;
  total: string;
  paidTotal: string;
  advanceAdjusted: string;
  outstanding: string;
}
function wireToBigInt(w: OutstandingInvoiceWire): OutstandingInvoice {
  return {
    id: w.id, number: w.number,
    date: new Date(w.date), dueDate: new Date(w.dueDate),
    total: BigInt(w.total), paidTotal: BigInt(w.paidTotal),
    advanceAdjusted: BigInt(w.advanceAdjusted),
    outstanding: BigInt(w.outstanding),
  };
}

// ── primitives ───────────────────────────────────────────────────

const fieldCls =
  "w-full h-[34px] px-3 bg-white/60 border border-rule rounded-[6px] text-[12.5px] outline-none focus:border-accent transition-colors";
const cellCls =
  "w-full h-[28px] px-2 bg-white/60 border border-rule rounded-[4px] text-[12.5px] outline-none focus:border-accent";

function iso(d: Date): string { return d.toISOString().slice(0, 10); }
function fmt(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" });
}
function safePaise(v: string): bigint {
  if (v == null || v.trim() === "") return 0n;
  try { return parseINR(v); } catch { return 0n; }
}
function Field({
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
function Th({ children, align = "left", width }: { children: React.ReactNode; align?: "left" | "right"; width?: number }) {
  return (
    <th style={width ? { width } : undefined}
        className={`px-3 h-[34px] font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}
function Td({ children, align = "left", className = "" }: { children: React.ReactNode; align?: "left" | "right"; className?: string }) {
  return <td className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"} ${className}`}>{children}</td>;
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-dim text-[11.5px]">{k}</dt>
      <dd className="text-text text-right tabular">{v}</dd>
    </div>
  );
}

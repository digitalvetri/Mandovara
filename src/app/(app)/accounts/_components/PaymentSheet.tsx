"use client";

// The 3-tap payment recorder per docs/ACCOUNTS-PAGE.md §8.
// Amount → Mode → Save. Client is picked from the URL (?clientId=X) or
// via the picker at the top when opened directly.
//
// Auto-allocates oldest-first to that client's open bills and shows in
// plain English which bills will clear. "Change" toggles an advanced
// view for per-bill tweaking. Extra beyond the bills is labelled
// "kept for later bills" — never "unallocated".

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { IndianRupee, Loader2 } from "lucide-react";
import { formatINR } from "@/kernel/money/format";
import { createReceipt } from "@/modules/receipts/actions";
import type { PaymentMode } from "@/modules/receipts/schema";
import type { ClientForReceiptOption } from "@/modules/receipts/queries";
import type { BranchOption } from "@/modules/branches/queries";
import { safePaise, iso, type OutstandingInvoiceWire } from "./_receipt-primitives";
import { PaymentSheetPreview } from "./PaymentSheetPreview";
import { PaymentSheetMode } from "./PaymentSheetMode";

interface Props {
  clients:            ClientForReceiptOption[];
  branches:           BranchOption[];
  initialClientId?:   string;
  /** Pre-loaded outstanding rows for the initial client — skips the first fetch. */
  initialOutstanding?: OutstandingInvoiceWire[];
}

interface OutstandingBills {
  id:         string;
  number:     string;
  date:       Date;
  dueDate:    Date;
  outstanding: bigint;
}

function toWire(rows: OutstandingInvoiceWire[]): OutstandingBills[] {
  return rows.map((r) => ({
    id:          r.id,
    number:      r.number,
    date:        new Date(r.date),
    dueDate:     new Date(r.dueDate),
    outstanding: BigInt(r.outstanding),
  }));
}

export function PaymentSheet({ clients, branches, initialClientId, initialOutstanding }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const [clientId, setClientId] = useState<string>(initialClientId ?? "");
  const [bills, setBills] = useState<OutstandingBills[]>(() =>
    initialClientId && initialOutstanding ? toWire(initialOutstanding) : []);
  const [loadingBills, setLoadingBills] = useState(false);

  // Refetch bills whenever the client changes (skip the initial one — already loaded).
  useEffect(() => {
    if (!clientId) { setBills([]); return; }
    if (clientId === initialClientId && initialOutstanding) return;
    setLoadingBills(true);
    fetch(`/api/receipts/outstanding?clientId=${clientId}`)
      .then((r) => r.json())
      .then((rows: OutstandingInvoiceWire[]) => setBills(toWire(rows)))
      .finally(() => setLoadingBills(false));
  }, [clientId, initialClientId, initialOutstanding]);

  const fullOutstanding = useMemo(() => bills.reduce((s, b) => s + b.outstanding, 0n), [bills]);

  const [amount, setAmount] = useState<string>("");
  useEffect(() => {
    // Pre-fill with full outstanding once bills arrive — user can override.
    // Intentionally only depends on fullOutstanding: we don't want to
    // re-fill if the user has already typed and then changes amount.
    if (fullOutstanding > 0n && amount === "") {
      setAmount((Number(fullOutstanding) / 100).toString());
    }
  }, [fullOutstanding]);

  const totalPaise = safePaise(amount);
  const [mode, setMode] = useState<PaymentMode>("UPI");
  const [reference, setReference] = useState<string>("");
  const [chequeDate, setChequeDate] = useState<string>(iso(new Date()));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [manualAlloc, setManualAlloc] = useState<Record<string, string>>({});

  // Auto-allocate oldest-first — always. Advanced mode overrides per-bill.
  const autoAllocation = useMemo(() => {
    let left = totalPaise;
    return bills.map((b) => {
      if (left <= 0n) return { bill: b, take: 0n };
      const take = left >= b.outstanding ? b.outstanding : left;
      left -= take;
      return { bill: b, take };
    });
  }, [bills, totalPaise]);

  const effectiveAllocation = useMemo(() => {
    if (!showAdvanced) return autoAllocation;
    return bills.map((b) => ({ bill: b, take: safePaise(manualAlloc[b.id] ?? "") }));
  }, [showAdvanced, autoAllocation, bills, manualAlloc]);

  const allocatedTotal = effectiveAllocation.reduce((s, x) => s + x.take, 0n);
  const kept           = totalPaise > allocatedTotal ? totalPaise - allocatedTotal : 0n;
  const over           = allocatedTotal > totalPaise ? allocatedTotal - totalPaise : 0n;

  const canSubmit = clientId && totalPaise > 0n && over === 0n && !pending;

  const selectedClient = clients.find((c) => c.id === clientId);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    start(async () => {
      const allocations = effectiveAllocation
        .filter((x) => x.take > 0n)
        .map((x) => ({ invoiceId: x.bill.id, amount: x.take.toString() }));

      const res = await createReceipt({
        clientId,
        branchId:   branches[0]?.id ?? "",
        date:       iso(new Date()),
        mode,
        reference:  reference.trim() || undefined,
        chequeDate: mode === "CHEQUE" ? chequeDate : undefined,
        amount:     totalPaise.toString(),
        allocations,
      });
      if (!res.ok) {
        setServerError(res.error ?? "Could not save the payment. Please try again.");
        return;
      }
      router.push(`/accounts/${res.data!.id}` as Route);
      router.refresh();
    });
  }

  if (clients.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule py-14 text-center">
        <div className="text-[14px] text-text mb-2">Nobody has an open bill right now.</div>
        <p className="text-[12px] text-text-dim">
          Raise an invoice on a client first — then you can record their payment against it here.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-[560px] mx-auto space-y-5">
      {/* Header — who is paying */}
      <div className="rounded-[14px] bg-surface border border-rule p-5">
        <div className="text-[11px] uppercase tracking-[0.14em] text-text-dim mb-2">
          Got paid from
        </div>
        {selectedClient ? (
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[15.5px] text-text font-medium truncate">{selectedClient.name}</div>
              <div className="text-[11.5px] text-text-dim tabular mt-0.5">{selectedClient.mobile}</div>
            </div>
            {clients.length > 1 && (
              <button type="button"
                      onClick={() => setClientId("")}
                      className="text-[11.5px] text-accent hover:underline whitespace-nowrap">
                Change client
              </button>
            )}
          </div>
        ) : (
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full h-11 rounded-[10px] border border-rule bg-transparent px-3 text-[13.5px] text-text outline-none focus:border-gold"
          >
            <option value="">Pick a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name} · {c.mobile}</option>
            ))}
          </select>
        )}
      </div>

      {clientId && (
        <>
          {/* Step 1 — How much? */}
          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[11px] uppercase tracking-[0.14em] text-text-dim mb-2">
              How much?
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim">
                <IndianRupee size={17} strokeWidth={2} />
              </span>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full h-14 rounded-[10px] border border-rule bg-transparent pl-10 pr-3 text-[22px] font-display tabular-nums text-text outline-none focus:border-gold"
              />
            </div>
            {fullOutstanding > 0n && (
              <div className="flex gap-2 mt-2.5">
                <QuickBtn
                  active={totalPaise === fullOutstanding}
                  onClick={() => setAmount((Number(fullOutstanding) / 100).toString())}
                >
                  Full · {formatINR(fullOutstanding)}
                </QuickBtn>
                <QuickBtn
                  active={totalPaise > 0n && totalPaise < fullOutstanding}
                  onClick={() => setAmount("")}
                >
                  Part
                </QuickBtn>
              </div>
            )}
            {loadingBills && (
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-text-dim">
                <Loader2 size={11} className="animate-spin" />
                Loading their bills…
              </div>
            )}
          </div>

          {/* Step 2 — How? (modes + cheque date + reference) */}
          <PaymentSheetMode
            mode={mode}
            onModeChange={setMode}
            chequeDate={chequeDate}
            onChequeDateChange={setChequeDate}
            reference={reference}
            onReferenceChange={setReference}
          />

          {/* Step 3 — Preview what this clears */}
          {totalPaise > 0n && bills.length > 0 && (
            <PaymentSheetPreview
              rows={effectiveAllocation}
              kept={kept}
              over={over}
              showAdvanced={showAdvanced}
              onToggleAdvanced={() => setShowAdvanced((v) => !v)}
              manualAlloc={manualAlloc}
              onManualAllocChange={(id, v) => setManualAlloc((a) => ({ ...a, [id]: v }))}
            />
          )}

          {serverError && (
            <div className="rounded-[10px] border border-fault/40 bg-fault/5 px-4 py-2.5 text-[12px] text-fault">
              {serverError}
            </div>
          )}

          {/* Save — ≥56px, hero-gold */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full h-14 rounded-[12px] bg-gold text-ink text-[14.5px] font-semibold hover:bg-gold-strong disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
          >
            {pending && <Loader2 size={16} className="animate-spin" />}
            Record payment
          </button>
        </>
      )}
    </form>
  );
}

// ── Bits ──────────────────────────────────────────────────────────

function QuickBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "h-9 px-3.5 rounded-[8px] border text-[12px] font-medium transition-colors tabular",
        active
          ? "border-gold bg-gold/10 text-text"
          : "border-rule text-text-dim hover:text-text hover:border-text-dim",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

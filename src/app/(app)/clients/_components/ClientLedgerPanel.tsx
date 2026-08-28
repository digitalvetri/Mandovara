"use client";

// Bills and payments for one client.
//
// The owner's report: "The payment ledger is not easily understandable".
// It was a dense two-list panel in 10–12px type that opened with the
// phrase "Payment Ledger" and left you to add the rows up yourself to
// learn the one thing you came for — how much this client still owes.
//
// Rewritten around that number. It leads, in words, at a size you can
// read across a desk; the bills and the payments follow underneath as
// supporting detail. Copy follows src/kernel/copy/accounts-lexicon.ts,
// which is the house dictionary for this surface: "ledger" is a banned
// term there and becomes History, and "overdue by" becomes "N days
// late". Same props, same data, same Record Payment modal.

import { useState } from "react";
import { ReceiptText, Plus, CheckCircle2 } from "lucide-react";
import { RecordPaymentModal } from "./RecordPaymentModal";

export interface InvoiceLedgerRow {
  id: string;
  number: string;
  date: string;        // ISO
  dueDate: string;     // ISO
  total: string;       // paise
  outstanding: string; // paise
}

export interface ReceiptLedgerRow {
  id: string;
  number: string;
  date: string;        // ISO
  mode: string;
  amount: string;      // paise
  reference: string | null;
  chequeStatus: string | null;
}

interface Props {
  clientId: string;
  branchId: string;
  openInvoices: InvoiceLedgerRow[];
  receipts: ReceiptLedgerRow[];
  canRecord: boolean;
}

const MODE_CHIP: Record<string, string> = {
  CASH: "bg-good/10 text-good",
  UPI:  "bg-accent/10 text-accent",
  NEFT: "bg-info/10 text-info",
  RTGS: "bg-info/10 text-info",
  CHEQUE: "bg-gold/12 text-gold",
  CARD: "bg-heat/10 text-heat",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  });
}

function fmtShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", timeZone: "Asia/Kolkata",
  });
}

function rsFromPaise(paise: string): string {
  return "₹" + (Number(paise) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 0, maximumFractionDigits: 2,
  });
}

function isOverdue(dueDateIso: string): boolean {
  return new Date(dueDateIso) < new Date();
}

/** Whole days between the due date and today. Never negative. */
function daysLate(dueDateIso: string): number {
  const ms = Date.now() - new Date(dueDateIso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function ClientLedgerPanel({
  clientId, branchId, openInvoices, receipts, canRecord,
}: Props) {
  const [showModal, setShowModal] = useState(false);

  const hasInvoices = openInvoices.length > 0;
  const hasReceipts = receipts.length > 0;
  const totalDue = openInvoices.reduce((sum, i) => sum + BigInt(i.outstanding), 0n);

  return (
    <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
      {/* Header — the answer first, in words. */}
      <div className="border-b border-rule px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-[13px] text-text-dim">
              <ReceiptText size={13} strokeWidth={1.75} />
              Bills and payments
            </div>
            {totalDue > 0n ? (
              <>
                <div className="mt-1.5 font-display text-[26px] font-semibold leading-none text-fault tabular-nums">
                  {rsFromPaise(totalDue.toString())}
                </div>
                <div className="mt-1.5 text-[13.5px] text-text-dim">
                  still to collect from this client
                  {" · "}
                  {openInvoices.length} {openInvoices.length === 1 ? "bill" : "bills"} unpaid
                </div>
              </>
            ) : (
              <>
                <div className="mt-1.5 flex items-center gap-1.5 font-display text-[22px] font-semibold leading-none text-good">
                  <CheckCircle2 size={18} strokeWidth={2} />
                  Nothing to collect
                </div>
                <div className="mt-1.5 text-[13.5px] text-text-dim">
                  Every bill sent to this client has been paid.
                </div>
              </>
            )}
          </div>
          {canRecord && (
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-[6px] border border-accent/40 bg-accent/10 px-3.5 text-[13px] font-medium text-accent transition-colors hover:bg-accent/20"
            >
              <Plus size={14} strokeWidth={2.5} />
              Record a payment
            </button>
          )}
        </div>
      </div>

      {/* The bills themselves — detail under the headline, not instead
          of it. Only rendered when there is something unpaid; the
          "nothing to collect" case is already answered above. */}
      {hasInvoices && (
        <div className="px-5 py-4">
          <div className="mb-2.5 text-[13px] font-medium text-text">
            Bills not yet paid
          </div>

          {openInvoices.map((inv) => {
            const late = isOverdue(inv.dueDate);
            const days = daysLate(inv.dueDate);
            return (
              <div key={inv.id}
                className="flex flex-wrap items-center gap-2 border-b border-rule/50 py-2.5 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-medium text-text tabular-nums">
                      {inv.number}
                    </span>
                    {late && (
                      <span className="rounded-[4px] bg-fault/10 px-1.5 py-0.5 text-[11.5px] font-semibold text-fault">
                        {days === 0 ? "Due today" : `${days} ${days === 1 ? "day" : "days"} late`}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[13px] text-text-dim">
                    {late ? "Was due" : "Due"} {fmtShortDate(inv.dueDate)}
                    <span className="mx-1 text-text-faint">·</span>
                    Bill sent {fmtShortDate(inv.date)}
                  </div>
                </div>
                <span className="shrink-0 text-[15px] font-semibold text-fault tabular-nums">
                  {rsFromPaise(inv.outstanding)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent payments */}
      {hasReceipts && (
        <div className="border-t border-rule px-5 py-3.5">
          <div className="mb-2.5 text-[13px] font-medium text-text">
            Payments received
          </div>
          {receipts.map((r) => {
            const chipCls = MODE_CHIP[r.mode] ?? "bg-text-dim/10 text-text-dim";
            const bounced = r.chequeStatus === "BOUNCED";
            return (
              <div key={r.id}
                className="flex items-center gap-2 py-2 border-b border-rule/50 last:border-0">
                <span className={`shrink-0 rounded-[4px] px-2 py-0.5 text-[11.5px] font-semibold ${chipCls}`}>
                  {r.mode}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[14px] font-medium text-text tabular-nums">{r.number}</span>
                    {bounced && (
                      <span className="rounded-[4px] bg-fault/10 px-1.5 py-0.5 text-[11.5px] font-semibold text-fault">
                        Cheque bounced
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[13px] text-text-dim">
                    {fmtDate(r.date)}
                    {r.reference ? ` · ${r.reference}` : ""}
                  </div>
                </div>
                <span className={`shrink-0 text-[15px] font-semibold tabular-nums ${bounced ? "text-fault line-through" : "text-good"}`}>
                  +{rsFromPaise(r.amount)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <RecordPaymentModal
        open={showModal}
        onClose={() => setShowModal(false)}
        clientId={clientId}
        branchId={branchId}
        openInvoices={openInvoices.map((inv) => ({
          id: inv.id,
          number: inv.number,
          outstanding: inv.outstanding,
        }))}
      />
    </div>
  );
}

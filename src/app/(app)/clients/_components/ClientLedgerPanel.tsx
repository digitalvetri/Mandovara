"use client";

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

export function ClientLedgerPanel({
  clientId, branchId, openInvoices, receipts, canRecord,
}: Props) {
  const [showModal, setShowModal] = useState(false);

  const hasInvoices = openInvoices.length > 0;
  const hasReceipts = receipts.length > 0;

  return (
    <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-rule">
        <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
          <ReceiptText size={11} strokeWidth={1.75} />
          Payment Ledger
        </div>
        {canRecord && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-accent hover:text-accent-strong transition-colors"
          >
            <Plus size={11} strokeWidth={2.5} />
            Record Payment
          </button>
        )}
      </div>

      {/* Open invoices */}
      <div className="px-5 py-3.5">
        <div className="text-[10px] uppercase tracking-[0.12em] text-text-faint mb-2">
          Open Invoices
        </div>

        {hasInvoices ? (
          <div>
            {openInvoices.map((inv) => (
              <div key={inv.id}
                className="flex items-center gap-2 py-2 border-b border-rule/50 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12.5px] text-text tabular font-medium">
                      {inv.number}
                    </span>
                    {isOverdue(inv.dueDate) && (
                      <span className="text-[9.5px] uppercase font-semibold tracking-[0.06em] text-fault">
                        Overdue
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-text-dim">
                    Due {fmtShortDate(inv.dueDate)}
                    <span className="mx-1 text-text-faint">·</span>
                    Invoiced {fmtShortDate(inv.date)}
                  </div>
                </div>
                <span className="text-[13px] font-semibold text-fault tabular shrink-0">
                  {rsFromPaise(inv.outstanding)}
                </span>
              </div>
            ))}

            {openInvoices.length > 1 && (
              <div className="flex justify-between items-center pt-2.5">
                <span className="text-[10.5px] uppercase tracking-[0.1em] text-text-dim">Total outstanding</span>
                <span className="text-[14px] font-bold text-fault tabular">
                  {rsFromPaise(
                    openInvoices
                      .reduce((s, i) => s + BigInt(i.outstanding), 0n)
                      .toString(),
                  )}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 py-1 text-[12px] text-good">
            <CheckCircle2 size={13} strokeWidth={1.75} />
            All invoices settled
          </div>
        )}
      </div>

      {/* Recent payments */}
      {hasReceipts && (
        <div className="border-t border-rule px-5 py-3.5">
          <div className="text-[10px] uppercase tracking-[0.12em] text-text-faint mb-2">
            Recent Payments
          </div>
          {receipts.map((r) => {
            const chipCls = MODE_CHIP[r.mode] ?? "bg-text-dim/10 text-text-dim";
            const bounced = r.chequeStatus === "BOUNCED";
            return (
              <div key={r.id}
                className="flex items-center gap-2 py-2 border-b border-rule/50 last:border-0">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-[3px] shrink-0 ${chipCls}`}>
                  {r.mode}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] text-text tabular">{r.number}</span>
                    {bounced && (
                      <span className="text-[9.5px] font-semibold uppercase tracking-[0.06em] text-fault">
                        Bounced
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-text-dim">
                    {fmtDate(r.date)}
                    {r.reference ? ` · ${r.reference}` : ""}
                  </div>
                </div>
                <span className={`text-[13px] font-semibold tabular shrink-0 ${bounced ? "text-fault line-through" : "text-good"}`}>
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

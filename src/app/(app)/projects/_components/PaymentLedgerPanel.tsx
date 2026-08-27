// The client's running statement for this project.
//
// Owner instruction 2026-08-27: seeing payments received alongside the
// quotation and invoice totals, in one place. This is the view you read
// out when a client rings to ask what they still owe.
//
// Deliberately a ledger and not a summary: four totals cannot explain a
// balance, and "why do I owe this?" is the question that actually gets
// asked. Oldest first, running balance on every line, bounced cheques
// left visible with a zero credit so the history stays honest.

import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import type { ProjectLedger, LedgerKind } from "@/modules/projects/queries-ledger";

const KIND_TONE: Record<LedgerKind, string> = {
  QUOTATION: "bg-text-dim/10 text-text-dim",
  ADVANCE:   "bg-good/12 text-good",
  INVOICE:   "bg-accent/12 text-accent",
  RECEIPT:   "bg-good/12 text-good",
};

const KIND_LABEL: Record<LedgerKind, string> = {
  QUOTATION: "Quote",
  ADVANCE:   "Advance",
  INVOICE:   "Invoice",
  RECEIPT:   "Receipt",
};

export function PaymentLedgerPanel({ ledger }: { ledger: ProjectLedger }) {
  if (ledger.rows.length === 0) {
    return (
      <div className="py-6 text-center text-[12.5px] text-text-dim">
        No money has moved on this project yet. Quotations, advances, invoices
        and receipts will appear here in order.
      </div>
    );
  }

  const owed = ledger.balance;

  return (
    <div className="space-y-4">
      {/* Totals — the four numbers, before the story that explains them. */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-rule bg-rule sm:grid-cols-4">
        <Total k="Quoted"   v={formatINR(ledger.quoted)} />
        <Total k="Invoiced" v={formatINR(ledger.invoiced)} />
        <Total k="Received" v={formatINR(ledger.received)} tone="text-good" />
        <Total
          k={owed >= 0n ? "Balance due" : "In credit"}
          v={formatINR(owed >= 0n ? owed : -owed)}
          tone={owed > 0n ? "text-warn" : "text-good"}
        />
      </div>

      {/* Wide content scrolls inside itself — the page never goes sideways. */}
      <div className="overflow-x-auto rounded-[10px] border border-rule">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="border-b border-rule bg-surface-2">
              <Th>Date</Th>
              <Th>Reference</Th>
              <Th>Detail</Th>
              <Th right>Charged</Th>
              <Th right>Received</Th>
              <Th right>Balance</Th>
            </tr>
          </thead>
          <tbody>
            {ledger.rows.map((r) => (
              <tr key={`${r.kind}-${r.id}`} className="border-b border-rule/60 last:border-0">
                <td className="tabular whitespace-nowrap px-3 py-2.5 text-[12px] text-text-dim">
                  {formatDate(r.date)}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-block rounded-[3px] px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.06em] ${KIND_TONE[r.kind]}`}>
                    {KIND_LABEL[r.kind]}
                  </span>
                  <span className="tabular ml-2 text-[12px] text-text">{r.ref}</span>
                </td>
                <td className="px-3 py-2.5 text-[12px] text-text-dim">
                  {r.label}
                  {r.note && <span className="ml-1.5 text-text-faint">· {r.note}</span>}
                </td>
                <td className="tabular whitespace-nowrap px-3 py-2.5 text-right text-[12px] text-text">
                  {r.debit > 0n ? formatINR(r.debit) : "—"}
                </td>
                <td className="tabular whitespace-nowrap px-3 py-2.5 text-right text-[12px] text-good">
                  {r.credit > 0n ? formatINR(r.credit) : "—"}
                </td>
                <td className="tabular whitespace-nowrap px-3 py-2.5 text-right text-[12px] font-medium text-text">
                  {formatINR(r.balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ledger.advances > 0n && (
        <p className="text-[11.5px] text-text-dim">
          {formatINR(ledger.advances)} was received as advance and is adjusted against
          invoices as they are raised.
        </p>
      )}
    </div>
  );
}

function Total({ k, v, tone = "text-text" }: { k: string; v: string; tone?: string }) {
  return (
    <div className="bg-surface-2 px-3.5 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.12em] text-text-dim">{k}</div>
      <div className={`tabular mt-1 text-[15px] font-medium ${tone}`}>{v}</div>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-dim ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

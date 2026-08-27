// One vendor's statement — what we were billed, what we paid, what is left.
//
// Owner instruction 2026-08-27: "we need to maintain a ledger for those
// purchasing items so we can have data on whom we need to pay, how much,
// and what was the amount we paid before."
//
// Same shape as the client-side project ledger, pointed the other way:
// bills are what we came to owe, payments are what we settled, and the
// running balance answers the only question that matters when the vendor
// rings — how far behind are we.

import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import type { VendorLedger, VendorLedgerKind } from "@/modules/purchase/vendor-ledger";

const KIND_TONE: Record<VendorLedgerKind, string> = {
  BILL:    "bg-accent/12 text-accent",
  PAYMENT: "bg-good/12 text-good",
  PO:      "bg-text-dim/10 text-text-dim",
};

const KIND_LABEL: Record<VendorLedgerKind, string> = {
  BILL: "Bill", PAYMENT: "Paid", PO: "PO",
};

export function VendorLedgerPanel({ ledger }: { ledger: VendorLedger }) {
  const owed = ledger.payable;

  return (
    <section className="overflow-hidden rounded-[12px] border border-rule bg-surface">
      <div className="border-b border-rule px-5 py-3.5">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">Ledger</div>
      </div>

      <div className="space-y-4 p-5">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-rule bg-rule sm:grid-cols-4">
          <Total k="Billed to us" v={formatINR(ledger.billed)} />
          <Total k="We paid"      v={formatINR(ledger.paid)} tone="text-good" />
          <Total
            k={owed >= 0n ? "Still to pay" : "Advance with them"}
            v={formatINR(owed >= 0n ? owed : -owed)}
            tone={owed > 0n ? "text-warn" : "text-good"}
          />
          <Total k="On account" v={formatINR(ledger.advances)} />
        </div>

        {ledger.rows.length === 0 ? (
          <div className="py-6 text-center text-[12.5px] text-text-dim">
            Nothing billed or paid yet. Bills raised against this vendor&apos;s
            purchase orders will appear here.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[10px] border border-rule">
            <table className="w-full min-w-[620px] border-collapse">
              <thead>
                <tr className="border-b border-rule bg-surface-2">
                  <Th>Date</Th><Th>Reference</Th><Th>Detail</Th>
                  <Th right>Billed</Th><Th right>Paid</Th><Th right>Balance</Th>
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
        )}
      </div>
    </section>
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

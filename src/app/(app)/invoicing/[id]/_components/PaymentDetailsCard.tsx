// Payment Details — what was paid against this invoice, and how.
//
// Owner, 2026-08-29: show payment mode, date and reference number, and
// put the card under the product table on the left rather than in the
// right rail. The rail was already the taller column, so a card there
// left a band of white space beside a long line list.
//
// Lives in its own file because the page hit CLAUDE.md §10's 300-line
// ceiling.

import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import type { InvoicePaymentRow } from "@/modules/receipts/queries";

interface Props {
  payments: InvoicePaymentRow[];
  canView:  boolean;
}

export function PaymentDetailsCard({ payments, canView }: Props) {
  if (!canView) return null;

  return (
    <div className="mt-4 rounded-[14px] border border-rule bg-surface p-5">
      <div className="mb-3 text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
        Payment details
      </div>

      {payments.length === 0 ? (
        <p className="text-[13px] text-text-dim">
          No payments recorded against this invoice yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse">
            <thead>
              <tr className="border-b border-rule text-left">
                <Th>Receipt</Th>
                <Th>Date</Th>
                <Th>Mode</Th>
                <Th>Reference</Th>
                <Th align="right">Amount</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule/60">
              {payments.map((p) => (
                <tr key={p.receiptId}>
                  <Td className="tabular-nums text-text">{p.number}</Td>
                  <Td className="tabular-nums text-text-dim">{formatDate(p.date)}</Td>
                  <Td className="text-text-dim">{p.mode}</Td>
                  <Td className="text-text-dim">{p.reference ?? "—"}</Td>
                  <Td align="right" className="font-medium tabular-nums text-good">
                    {formatINR(p.applied)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children, align }: { children?: React.ReactNode; align?: "right" }) {
  return (
    <th className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-dim ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function Td({ children, className, align }: { children?: React.ReactNode; className?: string; align?: "right" }) {
  return (
    <td className={`px-3 py-2.5 text-[13px] ${align === "right" ? "text-right" : ""} ${className ?? ""}`}>
      {children}
    </td>
  );
}

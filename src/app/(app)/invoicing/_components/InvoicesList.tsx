// One-line invoice rows — replaces the wide multi-column DataTable.
// Reference style (from GreenEcocare screenshot): client bold on the
// left, number + tax mode small next to it, second line has the order
// ref + invoice date, amount right-aligned + View link.
//
// Superseded / cancelled / credit-note rows use muted styling so the
// list scans by "what's outstanding right now."

import Link from "next/link";
import type { Route } from "next";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import type { InvoiceRow } from "@/modules/invoices/queries";
import { EmptyState } from "@/components/data/DataTable";
import { StatusPill } from "./StatusPill";

interface Props { rows: InvoiceRow[] }

export function InvoicesList({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No invoices in this view."
        body="Invoices are raised from an Order after installation or an approved milestone. Head to the Orders module to bill one."
      />
    );
  }

  return (
    <ul className="rounded-[14px] border border-rule bg-surface overflow-hidden divide-y divide-rule">
      {rows.map((r) => <Row key={r.id} r={r} />)}
    </ul>
  );
}

function Row({ r }: { r: InvoiceRow }) {
  const isCancelled = r.status === "CANCELLED";
  const isPaid      = r.outstanding <= 0n && r.status !== "DRAFT";
  const isOverdue   = !isCancelled && !isPaid && r.overdueBy > 0;

  return (
    <li className="relative flex items-center gap-4 px-5 py-3 hover:bg-surface-2/40 cursor-pointer">
      {/* full-row link */}
      <Link href={`/invoicing/${r.id}` as Route} className="absolute inset-0" aria-label={`View invoice ${r.number}`} />

      {/* left: client + number + status */}
      <div className="relative min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className={`text-[13.5px] font-semibold ${isCancelled ? "text-text-dim line-through" : "text-text"}`}>
            {r.clientName}
          </span>
          <span className="tabular-nums text-[11px] text-text-dim">
            {shortNumber(r.number)}
          </span>
          <StatusPill status={r.status} />
          {isOverdue && (
            <span className="text-[10px] uppercase tracking-[0.1em] text-fault">
              {r.overdueBy}d late
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px] text-text-dim">
          {r.orderNumber && (
            <>
              <span className="tabular-nums">{shortNumber(r.orderNumber)}</span>
              <span aria-hidden>·</span>
            </>
          )}
          <span className="tabular-nums">{formatDate(r.date)}</span>
        </div>
      </div>

      {/* right: amount */}
      <div className="relative text-right shrink-0">
        <div className={`tabular-nums text-[13.5px] font-medium ${isCancelled ? "text-text-dim" : "text-text"}`}>
          {formatINR(r.total)}
        </div>
        {r.outstanding > 0n && !isCancelled && (
          <div className="text-[10.5px] tabular-nums text-fault">
            {formatINR(r.outstanding)} due
          </div>
        )}
      </div>
    </li>
  );
}

function shortNumber(n: string): string {
  const parts = n.split("/");
  return parts[parts.length - 1] ?? n;
}

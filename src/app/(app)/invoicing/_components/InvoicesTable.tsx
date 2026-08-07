"use client";

import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import type { InvoiceRow } from "@/modules/invoices/queries";
import { DataTable, EmptyState, type Column } from "@/components/data/DataTable";
import { IrnPill, StatusPill } from "./StatusPill";

const COLUMNS: readonly Column<InvoiceRow>[] = [
  { key: "number", header: "Number", render: (r) => <span className="text-text tabular">{r.number}</span> },
  { key: "client", header: "Client", render: (r) => r.clientName },
  { key: "order",  header: "Order",  cellClassName: "text-text-dim tabular text-[11.5px]",
    render: (r) => r.orderNumber ?? "—" },
  { key: "date",   header: "Date",   cellClassName: "text-text-dim tabular", render: (r) => formatDate(r.date) },
  {
    key: "due", header: "Due",
    render: (r) => {
      const overdue = r.status !== "CANCELLED" && r.status !== "PAID" && r.overdueBy > 0;
      return (
        <div className={overdue ? "tabular text-bad" : "text-text-dim tabular"}>
          {formatDate(r.dueDate)}
          {overdue && <div className="text-[10px] text-bad">{r.overdueBy}d late</div>}
        </div>
      );
    },
  },
  { key: "total",  header: "Total", align: "right",
    render: (r) => <span className="tabular text-text">{formatINR(r.total)}</span> },
  {
    key: "outstanding", header: "Outstanding", align: "right",
    render: (r) => (
      <span className={`tabular ${r.outstanding > 0n ? "text-text" : "text-text-faint"}`}>
        {r.outstanding > 0n ? formatINR(r.outstanding) : "—"}
      </span>
    ),
  },
  { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
  { key: "irn",    header: "IRN",    render: (r) => <IrnPill status={r.irnStatus} /> },
];

export function InvoicesTable({ rows }: { rows: InvoiceRow[] }) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(r) => r.id}
      rowHref={(r) => `/invoicing/${r.id}`}
      ariaLabel="Invoices"
      emptyState={
        <EmptyState
          title="No invoices in this view."
          body="Invoices are minted from a Sales Order once goods are dispatched."
        />
      }
    />
  );
}

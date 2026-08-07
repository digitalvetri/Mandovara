"use client";

import Link from "next/link";
import type { Route } from "next";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import type { OrderRow } from "@/modules/orders/queries";
import { DataTable, EmptyState, type Column } from "@/components/data/DataTable";
import { StatusPill } from "./StatusPill";

const COLUMNS: readonly Column<OrderRow>[] = [
  { key: "number", header: "Number", render: (r) => <span className="text-text tabular">{r.number}</span> },
  { key: "client", header: "Client", render: (r) => r.clientName },
  { key: "quote",  header: "From quote", cellClassName: "text-text-dim tabular text-[11.5px]",
    render: (r) => r.quotationNumber ?? "—" },
  { key: "lines",  header: "Lines", align: "right",
    render: (r) => <span className="tabular text-text-dim">{r.lineCount}</span> },
  { key: "date",   header: "Date", cellClassName: "text-text-dim tabular", render: (r) => formatDate(r.date) },
  { key: "delivery", header: "Delivery by", cellClassName: "text-text-dim tabular",
    render: (r) => (r.deliveryBy ? formatDate(r.deliveryBy) : "—") },
  { key: "total",  header: "Total", align: "right",
    render: (r) => <span className="tabular text-text">{formatINR(r.total)}</span> },
  { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
];

export function OrdersTable({ rows }: { rows: OrderRow[] }) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(r) => r.id}
      rowHref={(r) => `/orders/${r.id}`}
      ariaLabel="Sales orders"
      emptyState={
        <EmptyState
          title="No sales orders yet."
          body={
            <>
              Convert an accepted quotation to create your first order. →{" "}
              <Link href={"/quotations" as Route} className="text-accent hover:underline">
                Open Quotations
              </Link>
            </>
          }
        />
      }
    />
  );
}

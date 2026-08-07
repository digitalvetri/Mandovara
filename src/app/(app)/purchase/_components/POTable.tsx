"use client";

import Link from "next/link";
import type { Route } from "next";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import type { PORow } from "@/modules/purchase/queries";
import { DataTable, EmptyState, type Column } from "@/components/data/DataTable";
import { POStatusPill } from "./StatusPill";

const COLUMNS: readonly Column<PORow>[] = [
  { key: "number", header: "Number", render: (r) => <span className="text-text tabular">{r.number}</span> },
  { key: "vendor", header: "Vendor", render: (r) => r.vendorName },
  { key: "lines",  header: "Lines", align: "right",
    render: (r) => <span className="tabular text-text-dim">{r.lineCount}</span> },
  { key: "date",   header: "Date",  cellClassName: "text-text-dim tabular", render: (r) => formatDate(r.date) },
  { key: "expected", header: "Expected by", cellClassName: "text-text-dim tabular",
    render: (r) => (r.expectedDate ? formatDate(r.expectedDate) : "—") },
  { key: "total",  header: "Total", align: "right",
    render: (r) => <span className="tabular text-text">{formatINR(r.total)}</span> },
  { key: "status", header: "Status", render: (r) => <POStatusPill status={r.status} /> },
];

export function POTable({ rows }: { rows: PORow[] }) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(r) => r.id}
      rowHref={(r) => `/purchase/${r.id}`}
      ariaLabel="Purchase orders"
      emptyState={
        <EmptyState
          title="No purchase orders yet."
          body={
            <>
              Add a vendor and raise your first PO to start receiving stock. →{" "}
              <Link href={"/purchase/new" as Route} className="text-accent hover:underline">
                New purchase order
              </Link>
            </>
          }
        />
      }
    />
  );
}

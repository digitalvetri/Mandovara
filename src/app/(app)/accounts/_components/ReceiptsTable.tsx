"use client";

import Link from "next/link";
import type { Route } from "next";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import type { ReceiptRow } from "@/modules/receipts/queries";
import { DataTable, EmptyState, type Column } from "@/components/data/DataTable";
import { ModePill } from "./ModePill";

const COLUMNS: readonly Column<ReceiptRow>[] = [
  { key: "number", header: "Number", render: (r) => <span className="text-text tabular">{r.number}</span> },
  { key: "date",   header: "Date",   cellClassName: "text-text-dim tabular", render: (r) => formatDate(r.date) },
  { key: "client", header: "Client", render: (r) => r.clientName },
  { key: "mode",   header: "Mode",   render: (r) => <ModePill mode={r.mode} /> },
  { key: "ref",    header: "Reference", cellClassName: "text-text-dim tabular text-[11.5px]",
    render: (r) => r.reference ?? "—" },
  { key: "applied", header: "Applied", align: "right",
    render: (r) => <span className="tabular text-text">{formatINR(r.amount - r.unallocated)}</span> },
  {
    key: "onaccount", header: "On account", align: "right",
    render: (r) => (
      <span className={`tabular ${r.unallocated > 0n ? "text-warn" : "text-text-faint"}`}>
        {r.unallocated > 0n ? formatINR(r.unallocated) : "—"}
      </span>
    ),
  },
  { key: "total", header: "Total", align: "right",
    render: (r) => <span className="tabular text-text font-medium">{formatINR(r.amount)}</span> },
];

export function ReceiptsTable({ rows }: { rows: ReceiptRow[] }) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(r) => r.id}
      rowHref={(r) => `/accounts/${r.id}`}
      ariaLabel="Receipts"
      emptyState={
        <EmptyState
          title="No receipts recorded yet."
          body={
            <>
              Record a payment against an outstanding invoice to get started. →{" "}
              <Link href={"/accounts/new" as Route} className="text-accent hover:underline">
                Record receipt
              </Link>
            </>
          }
        />
      }
    />
  );
}

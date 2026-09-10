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
  // What the money was for. A payment booked to a job is placed — it is
  // waiting for the bill that comes at the end, which is how the studio
  // works. Only a payment with neither a job nor a bill behind it is
  // genuinely stray, and only that one reads as such.
  {
    key: "for", header: "For",
    render: (r) =>
      r.projectName
        ? <span className="text-text">{r.projectName}</span>
        : r.unallocated < r.amount
          ? <span className="text-text-dim">Bills</span>
          : <span className="text-warn">Not linked yet</span>,
  },
  { key: "mode",   header: "Mode",   render: (r) => <ModePill mode={r.mode} /> },
  { key: "ref",    header: "Reference", cellClassName: "text-text-dim tabular text-[11.5px]",
    render: (r) => r.reference ?? "—" },
  { key: "applied", header: "On a bill", align: "right",
    render: (r) => <span className="tabular text-text">{formatINR(r.amount - r.unallocated)}</span> },
  {
    key: "onaccount", header: "Against the job", align: "right",
    render: (r) => (
      <span className={`tabular ${
        r.unallocated === 0n ? "text-text-faint" : r.projectId ? "text-text" : "text-warn"
      }`}>
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
          title="No payments recorded yet."
          body={
            <>
              Record what a client pays you against their job to get started. →{" "}
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

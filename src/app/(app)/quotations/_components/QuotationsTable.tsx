"use client";

import Link from "next/link";
import type { Route } from "next";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import type { QuotationRow } from "@/modules/quotations/queries";
import { DataTable, EmptyState, type Column } from "@/components/data/DataTable";
import { StatusPill } from "./StatusPill";

const COLUMNS: readonly Column<QuotationRow>[] = [
  { key: "number", header: "Number", render: (r) => <span className="text-text tabular">{r.number}</span> },
  { key: "client", header: "Client", render: (r) => r.clientName },
  { key: "lines",  header: "Lines",  align: "right", render: (r) => <span className="tabular text-text-dim">{r.lineCount}</span> },
  { key: "date",   header: "Date",   cellClassName: "text-text-dim tabular", render: (r) => formatDate(r.date) },
  { key: "valid",  header: "Valid until", cellClassName: "text-text-dim tabular", render: (r) => formatDate(r.validUntil) },
  { key: "total",  header: "Total",  align: "right", render: (r) => <span className="tabular text-text">{formatINR(r.total)}</span> },
  { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
];

export function QuotationsTable({ rows }: { rows: QuotationRow[] }) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(r) => r.id}
      rowHref={(r) => `/quotations/${r.id}`}
      ariaLabel="Quotations"
      emptyState={
        <EmptyState
          title="No quotations yet."
          body={
            <>
              Create a quote from a lead or straight from a client. →{" "}
              <Link href={"/quotations/new" as Route} className="text-accent hover:underline">
                New quotation
              </Link>
            </>
          }
        />
      }
    />
  );
}

"use client";

import Link from "next/link";
import type { Route } from "next";
import { formatINR } from "@/kernel/money/format";
import type { ClientRow } from "@/modules/clients/queries";
import { DataTable, EmptyState, type Column } from "@/components/data/DataTable";
import { StatusPill } from "./StatusPill";

const TYPE_LABEL: Record<string, string> = {
  DEALER: "Dealer", DISTRIBUTOR: "Distributor", RETAIL: "Retail",
  PROJECT: "Project", GOVERNMENT: "Government",
};

const COLUMNS: readonly Column<ClientRow>[] = [
  {
    key: "name",
    header: "Name",
    render: (r) => (
      <>
        <span className="text-text">{r.name}</span>
        {r.gstin && (
          <div className="text-[10.5px] tabular text-text-faint">{r.gstin}</div>
        )}
      </>
    ),
  },
  { key: "type",    header: "Type",   cellClassName: "text-text-dim", render: (r) => TYPE_LABEL[r.type] ?? r.type },
  { key: "mobile",  header: "Mobile", render: (r) => <span className="tabular">{r.primaryMobile}</span> },
  {
    key: "city", header: "City / State", cellClassName: "text-text-dim",
    render: (r) => <>{r.city ?? "—"} <span className="text-text-faint">/ {r.stateCode}</span></>,
  },
  {
    key: "credit", header: "Credit limit", align: "right",
    render: (r) => <span className="tabular text-text">{r.creditLimit ? formatINR(r.creditLimit) : "—"}</span>,
  },
  {
    key: "outstanding", header: "Outstanding", align: "right",
    render: (r) => (
      <span className={`tabular ${r.outstanding > 0n ? "text-text" : "text-text-faint"}`}>
        {r.outstanding > 0n ? formatINR(r.outstanding) : "—"}
      </span>
    ),
  },
  { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
];

export function ClientsTable({ rows }: { rows: ClientRow[] }) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(r) => r.id}
      rowHref={(r) => `/clients/${r.id}`}
      ariaLabel="Clients"
      emptyState={
        <EmptyState
          title="No clients yet."
          body={
            <>
              Add your first client to start building the 360° view. →{" "}
              <Link href={"/clients/new" as Route} className="text-accent hover:underline">
                New client
              </Link>
            </>
          }
        />
      }
    />
  );
}

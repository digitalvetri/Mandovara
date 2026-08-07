"use client";

import Link from "next/link";
import type { Route } from "next";
import { formatINR } from "@/kernel/money/format";
import type { LeadRow } from "@/modules/leads/queries";
import { DataTable, EmptyState, type Column } from "@/components/data/DataTable";
import { StatusPill } from "./StatusPill";

const SOURCE_LABEL: Record<string, string> = {
  WEBSITE: "Website", REFERRAL: "Referral", WHATSAPP: "WhatsApp",
  WALK_IN: "Walk-in", EXHIBITION: "Exhibition", COLD_CALL: "Cold call", OTHER: "Other",
};

const COLUMNS: readonly Column<LeadRow>[] = [
  {
    key: "name",
    header: "Name",
    render: (r) => (
      <>
        <span className="text-text">{r.name}</span>
        {r.requirement && (
          <div className="text-[11px] text-text-dim truncate max-w-[280px]">{r.requirement}</div>
        )}
      </>
    ),
  },
  { key: "mobile",  header: "Mobile",  render: (r) => <span className="tabular">{r.mobile}</span> },
  { key: "company", header: "Company", cellClassName: "text-text-dim", render: (r) => r.companyName ?? "—" },
  { key: "source",  header: "Source",  cellClassName: "text-text-dim", render: (r) => SOURCE_LABEL[r.source] ?? r.source },
  { key: "status",  header: "Status",  render: (r) => <StatusPill status={r.status} /> },
  {
    key: "expected", header: "Expected", align: "right",
    render: (r) => <span className="tabular text-text">{r.expectedValue ? formatINR(r.expectedValue) : "—"}</span>,
  },
  {
    key: "created", header: "Created", align: "right",
    cellClassName: "text-text-dim tabular",
    render: (r) => formatDate(r.createdAt),
  },
];

export function LeadsTable({ rows }: { rows: LeadRow[] }) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(r) => r.id}
      rowHref={(r) => `/leads/${r.id}`}
      ariaLabel="Leads"
      emptyState={
        <EmptyState
          title="No leads match this filter."
          body={
            <>
              Clear the filter, adjust your search, or{" "}
              <Link href={"/leads/new" as Route} className="text-accent hover:underline">create a new lead</Link>.
            </>
          }
        />
      }
    />
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" });
}

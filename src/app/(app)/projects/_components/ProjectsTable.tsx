"use client";

import Link from "next/link";
import type { Route } from "next";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import { shortNumber } from "@/lib/short-number";
import type { ProjectRow } from "@/modules/projects/queries";
import { DataTable, EmptyState, type Column } from "@/components/data/DataTable";
import { ProjectStatusPill } from "./StatusPill";

const COLUMNS: readonly Column<ProjectRow>[] = [
  {
    key: "number", header: "Number",
    render: (r) => <span className="text-text tabular">{shortNumber(r.number, "P-")}</span>,
  },
  { key: "name",   header: "Name",   render: (r) => r.name },
  { key: "client", header: "Client", cellClassName: "text-text-dim", render: (r) => r.clientName },
  { key: "start",  header: "Start",  cellClassName: "text-text-dim tabular", render: (r) => formatDate(r.startDate) },
  { key: "end",    header: "Target end", cellClassName: "text-text-dim tabular",
    render: (r) => (r.targetEndDate ? formatDate(r.targetEndDate) : "—") },
  { key: "value",  header: "Value",  align: "right",
    render: (r) => <span className="tabular text-text">{formatINR(r.orderValue)}</span> },
  {
    key: "milestones", header: "Milestones", align: "right",
    render: (r) => {
      const pct = r.milestoneCount === 0 ? 0 : Math.round((r.completedMilestones / r.milestoneCount) * 100);
      return (
        <>
          <div className="tabular text-text-dim text-[11.5px]">{r.completedMilestones}/{r.milestoneCount}</div>
          {r.milestoneCount > 0 && (
            <div className="mt-1 ml-auto h-[3px] w-[80px] bg-rule/70 rounded-full overflow-hidden">
              <div className="h-full bg-good rounded-full" style={{ width: `${pct}%` }} />
            </div>
          )}
        </>
      );
    },
  },
  { key: "status", header: "Status", render: (r) => <ProjectStatusPill status={r.status} /> },
];

export function ProjectsTable({ rows }: { rows: ProjectRow[] }) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(r) => r.id}
      rowHref={(r) => `/projects/${r.id}`}
      ariaLabel="Projects"
      emptyState={
        <EmptyState
          title="No projects yet."
          body={
            <>
              Convert an accepted quote into a project or create one directly. →{" "}
              <Link href={"/projects/new" as Route} className="text-accent hover:underline">
                New project
              </Link>
            </>
          }
        />
      }
    />
  );
}

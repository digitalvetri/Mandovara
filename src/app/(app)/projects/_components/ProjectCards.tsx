// Card-based project list — replaces the wide multi-column table.
// Each card: number (top-left) · status pill (top-right) · project name
// (bold) · client + city (dim) · progress bar · % complete / order value.

import Link from "next/link";
import type { Route } from "next";
import { formatINR } from "@/kernel/money/format";
import type { ProjectRow } from "@/modules/projects/queries";
import { EmptyState } from "@/components/data/DataTable";
import { phaseForStage, PROJECT_PHASES } from "@/modules/projects/next-action";
import { InteractiveStagePill } from "./InteractiveStagePill";

interface Props {
  rows:         ProjectRow[];
  /** True when the user can move a project's stage from the card pill. */
  canEditStage?: boolean;
}

export function ProjectCards({ rows, canEditStage = false }: Props) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No projects in this view."
        body="Every project starts from a lead. Convert one in Lead Management to seed the first project."
      />
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => <Card key={r.id} r={r} canEditStage={canEditStage} />)}
    </ul>
  );
}

// ── Card ──────────────────────────────────────────────────
function Card({ r, canEditStage }: { r: ProjectRow; canEditStage: boolean }) {
  const isCancelled = r.stage === "CANCELLED";
  const milestonePct = r.milestonesTotal > 0
    ? Math.round((r.milestonesDone / r.milestonesTotal) * 100)
    : progressForStage(r.stage);

  return (
    <li>
      <Link
        href={`/projects/${r.id}` as Route}
        className="block h-full rounded-[14px] border border-rule bg-surface p-4 transition-colors hover:border-gold/40"
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <span className="tabular-nums text-[11px] text-text-dim">
            {shortNumber(r.number)}
          </span>
          <InteractiveStagePill projectId={r.id} stage={r.stage} canEdit={canEditStage} />
        </div>

        <div className={`mb-1 line-clamp-2 text-[14.5px] font-semibold ${isCancelled ? "text-text-dim" : "text-text"}`}>
          {r.name}
        </div>
        <div className="mb-3 truncate text-[11.5px] text-text-dim">
          {r.clientName}
        </div>

        {/* Progress */}
        <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className={`h-full rounded-full ${isCancelled ? "bg-text-dim/40" : "bg-solid"}`}
            style={{ width: `${milestonePct}%` }}
          />
        </div>

        <div className="flex items-baseline justify-between gap-2 text-[11px]">
          <span className="text-text-dim tabular-nums">
            {r.milestonesTotal > 0
              ? `${r.milestonesDone}/${r.milestonesTotal} milestones`
              : `${milestonePct}% complete`}
          </span>
          <span className={`tabular-nums text-[13px] font-medium ${isCancelled ? "text-text-dim" : "text-text"}`}>
            {formatINR(r.orderValue)}
          </span>
        </div>

        {r.nextMilestoneName && !isCancelled && (
          <div className="mt-2 truncate text-[11px] text-text-dim">
            Next: <span className="text-text">{r.nextMilestoneName}</span>
          </div>
        )}
      </Link>
    </li>
  );
}

function progressForStage(stage: string): number {
  const phase = phaseForStage(stage);
  if (phase === "CANCELLED") return 0;
  const i = PROJECT_PHASES.indexOf(phase);
  if (i < 0) return 0;
  return Math.round(((i + 1) / PROJECT_PHASES.length) * 100);
}

function shortNumber(n: string): string {
  const parts = n.split("/");
  return parts[parts.length - 1] ?? n;
}

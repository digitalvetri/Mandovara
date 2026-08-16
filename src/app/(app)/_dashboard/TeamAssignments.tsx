// Owner cockpit widget: "who owns what right now?".
// Lists every user with at least one live project, sorted by workload
// (heaviest first). Each row shows count + a few project chips linking
// through to the project detail page.

import Link from "next/link";
import type { Route } from "next";
import type { TeamAssignmentRow } from "./types";
import { PHASE_LABEL, phaseForStage } from "@/modules/projects/next-action";

interface Props {
  rows: TeamAssignmentRow[];
}

export function TeamAssignments({ rows }: Props) {
  return (
    <section className="rounded-[14px] border border-rule bg-surface p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">Team assignments</div>
        <span className="text-[11px] tabular-nums text-text-dim">
          {rows.length} owner{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-rule px-4 py-6 text-center text-[11.5px] text-text-dim">
          No live projects assigned yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => <MemberRow key={r.userId} row={r} />)}
        </ul>
      )}
    </section>
  );
}

function MemberRow({ row }: { row: TeamAssignmentRow }) {
  return (
    <li className="rounded-[10px] border border-rule/70 bg-surface-2/40 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="truncate text-[13px] font-semibold text-text">{row.userName}</span>
          <span className="text-[10px] uppercase tracking-[0.1em] text-text-dim">
            {row.role.replace(/_/g, " ").toLowerCase()}
          </span>
        </div>
        <span className="shrink-0 rounded-full bg-gold-tint px-2 py-[1px] text-[10.5px] font-semibold tabular-nums text-gold">
          {row.activeCount} live
        </span>
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {row.projects.map((p) => (
          <li key={p.id}>
            <Link
              href={`/projects/${p.id}` as Route}
              className="inline-flex items-baseline gap-1.5 rounded-[6px] border border-rule bg-surface px-2 py-1 text-[11px] text-text hover:border-gold/40"
              title={`${p.number} · ${p.name}`}
            >
              <span className="truncate max-w-[140px]">{p.name}</span>
              <span className="text-[9.5px] uppercase tracking-[0.1em] text-text-dim">
                {phaseFor(p.stage)}
              </span>
            </Link>
          </li>
        ))}
        {row.activeCount > row.projects.length && (
          <li className="inline-flex items-center text-[11px] text-text-dim">
            +{row.activeCount - row.projects.length} more
          </li>
        )}
      </ul>
    </li>
  );
}

function phaseFor(stage: string): string {
  const phase = phaseForStage(stage);
  return phase === "CANCELLED" ? "Cancelled" : PHASE_LABEL[phase];
}

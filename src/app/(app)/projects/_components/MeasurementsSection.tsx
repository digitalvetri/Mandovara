// Measurements section — lists every round for the project. Superseded
// rounds collapse UNDER their replacement (spec §5.1 / redesign §4).
//
// Columns: number · visit date · measured by · status pill · item count ·
// rooms covered · revision. Row click routes to the round detail.

import Link from "next/link";
import type { Route } from "next";
import { formatDate } from "@/kernel/datetime";
import type { ProjectMeasurementRow } from "@/modules/projects/queries";

interface Props {
  projectId: string;
  rounds: ProjectMeasurementRow[];
}

export function MeasurementsSection({ projectId, rounds }: Props) {
  // Fold superseded rounds under their replacement. A round appears as a
  // top-level row if nothing else supersedes it; otherwise it hangs from
  // the parent that superseded it.
  const supersededBy = new Map<string, ProjectMeasurementRow[]>();
  const roots: ProjectMeasurementRow[] = [];
  for (const r of rounds) {
    if (r.supersedesId) {
      const list = supersededBy.get(r.supersedesId) ?? [];
      list.push(r);
      supersededBy.set(r.supersedesId, list);
    } else {
      roots.push(r);
    }
  }
  // Rounds whose parent isn't in the list — treat as roots too.
  const rootIds = new Set(roots.map((r) => r.id));
  for (const r of rounds) {
    if (r.supersedesId && !rounds.some((x) => x.id === r.supersedesId) && !rootIds.has(r.id)) {
      roots.push(r);
      rootIds.add(r.id);
    }
  }

  return (
    <div className="rounded-[14px] border border-rule bg-surface p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">Measurements</div>
        <Link
          href={`/projects/${projectId}/measurements` as Route}
          className="text-[11px] text-text-dim hover:text-text"
        >
          View all →
        </Link>
      </div>

      {rounds.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-rule px-4 py-6 text-center text-[11.5px] text-text-dim">
          No measurement rounds yet. The "Start measurement" action creates the first one.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {roots.map((r) => (
            <li key={r.id}>
              <RoundRow projectId={projectId} r={r} />
              {(supersededBy.get(r.id) ?? []).map((child) => (
                <div key={child.id} className="ml-6 border-l border-rule pl-3">
                  <RoundRow projectId={projectId} r={child} superseded />
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RoundRow({
  projectId, r, superseded,
}: { projectId: string; r: ProjectMeasurementRow; superseded?: boolean }) {
  return (
    <Link
      href={`/projects/${projectId}/measurements/${r.id}` as Route}
      className={[
        "grid grid-cols-[110px_88px_1fr_84px_96px] items-center gap-3 rounded-[8px] px-3 py-2 text-[12px] transition-colors",
        superseded ? "text-text-dim opacity-70 hover:opacity-100" : "hover:bg-surface-2/40",
      ].join(" ")}
    >
      <span className="tabular-nums text-text">{shortNumber(r.number)}</span>
      <span className="tabular-nums text-text-dim">{formatDate(r.visitedAt)}</span>
      <span className="truncate text-text">{r.measuredByName}</span>
      <span className="tabular-nums text-text-dim">
        {r.itemCount} item{r.itemCount === 1 ? "" : "s"}
        <span className="mx-1 text-text-subtle">·</span>
        {r.roomsCovered} room{r.roomsCovered === 1 ? "" : "s"}
      </span>
      <span className="flex items-center justify-end gap-2">
        {r.revision > 0 && (
          <span className="rounded-[3px] border border-rule px-1.5 py-[1px] text-[9.5px] uppercase tracking-[0.1em] text-text-dim">
            rev {r.revision}
          </span>
        )}
        <StatusPill status={r.status} />
      </span>
    </Link>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    DRAFT:      { color: "text-heat",     label: "Draft" },
    SUBMITTED:  { color: "text-info",     label: "Submitted" },
    APPROVED:   { color: "text-solid",    label: "Approved" },
    SUPERSEDED: { color: "text-text-dim", label: "Superseded" },
  };
  const cfg = map[status] ?? { color: "text-text-dim", label: status };
  return (
    <span className={`text-[10.5px] uppercase tracking-[0.1em] ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function shortNumber(n: string): string {
  // MDV/MEA-2608-0087 → M-2608-0087
  const parts = n.split("/");
  return parts[parts.length - 1] ?? n;
}

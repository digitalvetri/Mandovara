// /install — the per-visit calendar (§5.2 Phase 5c office view).
//
// Rows = crews (one row for "Unassigned"), columns = next 7 days.
// Cells = scheduled visits (client + status + install %). Click any
// cell to open /install/[visitId]. The measurement-of-progress is
// intentionally coarse — this is the operations dashboard, not the
// per-line control surface.
//
// This screen is distinct from /installations (Milestones + snags
// across the whole project pipeline). The sidebar labels them as
// "Site Schedule" (that older one) and "Install Visits" (this one).

import Link from "next/link";
import type { Route } from "next";
import { Topbar } from "@/components/layout/Topbar";
import { formatDate } from "@/kernel/datetime";
import { shortNumber } from "@/lib/short-number";
import { devContext } from "@/lib/dev-context";
import { listUpcomingVisits, listCrews, type CalendarVisit } from "@/modules/install/queries";

export const dynamic = "force-dynamic";

const WINDOW_DAYS = 7;

export default async function InstallPage() {
  const ctx = await devContext();
  const [visits, crews] = await Promise.all([
    listUpcomingVisits(ctx, WINDOW_DAYS),
    listCrews(ctx),
  ]);

  // Bucket visits by (crewId ?? "unassigned") × day-key.
  const days: { key: string; date: Date }[] = [];
  const start = new Date(); start.setHours(0, 0, 0, 0);
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    days.push({ key: d.toISOString().slice(0, 10), date: d });
  }

  const grid = new Map<string, CalendarVisit[]>();
  for (const v of visits) {
    const bucket = `${v.crewId ?? "unassigned"}::${v.scheduledAt.toISOString().slice(0, 10)}`;
    (grid.get(bucket) ?? grid.set(bucket, []).get(bucket)!).push(v);
  }

  const activeCrews = crews.filter((c) => c.isActive);
  const rows: { id: string | null; label: string }[] = [
    ...activeCrews.map((c) => ({ id: c.id, label: c.name })),
    { id: null, label: "Unassigned" },
  ];

  return (
    <>
      <Topbar
        title="Install Visits"
        eyebrow={`${visits.length} visit${visits.length === 1 ? "" : "s"} across next ${WINDOW_DAYS} days · ${activeCrews.length} active crew${activeCrews.length === 1 ? "" : "s"}`}
      />

      <div className="rounded-[14px] bg-surface border border-rule overflow-x-auto pb-10">
        <table className="min-w-[900px] w-full">
          <thead>
            <tr className="border-b border-rule text-[10px] uppercase tracking-[0.14em] text-text-dim">
              <th className="text-left px-3 h-[36px] w-[180px] font-medium">Crew</th>
              {days.map((d) => (
                <th key={d.key} className="text-left px-3 h-[36px] font-medium">
                  <div className="text-text">{formatDate(d.date)}</div>
                  <div className="text-[9.5px] text-text-faint mt-0.5">
                    {d.date.toLocaleDateString("en-IN", { weekday: "short" })}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id ?? "unassigned"} className="border-b border-rule/60 align-top">
                <td className="px-3 py-3 text-[12.5px] text-text">
                  {row.label}
                </td>
                {days.map((d) => {
                  const cell = grid.get(`${row.id ?? "unassigned"}::${d.key}`) ?? [];
                  return (
                    <td key={d.key} className="px-2 py-2 min-w-[130px] align-top">
                      {cell.length === 0 ? (
                        <div className="h-full min-h-[54px] rounded-[8px] border border-dashed border-rule/60" />
                      ) : (
                        <div className="space-y-2">
                          {cell.map((v) => <VisitCard key={v.id} v={v} />)}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const STATUS_TONE: Record<string, string> = {
  SCHEDULED:   "text-info    bg-info/[0.10]",
  IN_PROGRESS: "text-heat    bg-heat/[0.10]",
  COMPLETED:   "text-good    bg-good/[0.10]",
  PARTIAL:     "text-heat    bg-heat/[0.10]",
  RESCHEDULED: "text-text-dim bg-white/[0.03]",
  CANCELLED:   "text-bad    bg-bad/[0.08]",
};

function VisitCard({ v }: { v: CalendarVisit }) {
  return (
    <Link
      href={`/install/${v.id}` as Route}
      className="block rounded-[8px] border border-rule bg-bg/50 hover:border-accent/40 hover:bg-bg p-2 transition-colors"
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="tabular text-[11.5px] text-text font-medium truncate">
          {shortNumber(v.number, "INS-")}
        </div>
        <span className={`tabular text-[9.5px] uppercase tracking-[0.06em] px-1 py-0.5 rounded-[3px] ${STATUS_TONE[v.status] ?? ""}`}>
          {v.status.toLowerCase()}
        </span>
      </div>
      <div className="text-[11.5px] text-text mt-0.5 truncate">
        {v.clientName}
      </div>
      <div className="mt-1 flex items-baseline justify-between text-[10px] text-text-dim">
        <span className="tabular">{shortNumber(v.orderNumber, "SO-")}</span>
        <span className="tabular">{v.installedPct}%</span>
      </div>
      {v.hasSignature && (
        <div className="text-[9.5px] text-good mt-0.5">✓ signed</div>
      )}
    </Link>
  );
}

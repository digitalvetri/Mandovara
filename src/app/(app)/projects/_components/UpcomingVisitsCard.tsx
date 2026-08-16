// Upcoming site visits for a project. Renders under the Next Action card
// on the project detail page so scheduled visits are immediately visible
// — the ScheduleVisitSheet closes with a success toast, but users also
// want to see the row land somewhere obvious. This is that somewhere.

import Link from "next/link";
import type { Route } from "next";
import { CalendarClock, ArrowRight } from "lucide-react";
import { formatDate } from "@/kernel/datetime";
import type { SiteVisitRow } from "@/modules/site-visits/queries";

interface Props {
  visits: SiteVisitRow[];
}

const STATUS_TONE: Record<string, string> = {
  SCHEDULED:   "text-info",
  IN_PROGRESS: "text-heat",
  COMPLETED:   "text-solid",
  RESCHEDULED: "text-heat",
  CANCELLED:   "text-text-dim",
};

export function UpcomingVisitsCard({ visits }: Props) {
  const upcoming = visits.filter(
    (v) => v.status === "SCHEDULED" || v.status === "IN_PROGRESS" || v.status === "RESCHEDULED",
  );
  if (upcoming.length === 0) return null;

  return (
    <section className="rounded-[14px] border border-rule bg-surface p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
          Upcoming visits
        </div>
        <Link
          href={"/site-visits" as Route}
          className="text-[11px] text-text-dim hover:text-text"
        >
          All visits →
        </Link>
      </div>
      <ul className="space-y-2">
        {upcoming.slice(0, 5).map((v) => (
          <li key={v.id}>
            <Link
              href={`/site-visits/${v.id}` as Route}
              className="group flex items-center gap-3 rounded-[10px] border border-rule/60 bg-surface-2/40 px-3 py-2.5 text-[12.5px] transition-colors hover:border-gold/40"
            >
              <CalendarClock size={14} className="shrink-0 text-text-dim" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-text">{v.purpose}</span>
                  <span className={`text-[10px] uppercase tracking-[0.1em] ${STATUS_TONE[v.status] ?? "text-text-dim"}`}>
                    {v.status.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[11px] text-text-dim tabular-nums">
                  {formatDate(v.scheduledAt)} · {v.assignedTo}
                </div>
              </div>
              <ArrowRight size={13} className="shrink-0 text-text-dim opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

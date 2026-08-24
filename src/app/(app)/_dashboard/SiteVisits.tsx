import Link from "next/link";
import type { Route } from "next";
import { AlertTriangle } from "lucide-react";
import type { SiteVisit } from "./types";

export function SiteVisits({ visits }: { visits: SiteVisit[] }) {
  const overdue  = visits.filter((v) => v.isOverdue);
  const upcoming = visits.filter((v) => !v.isOverdue);

  return (
    <div className="rounded-[14px] bg-surface border border-rule p-6">
      <div className="mb-5">
        <div className="font-display text-[18px] font-semibold text-text">
          Site visits
        </div>
      </div>

      {/* Overdue / missed */}
      {overdue.length > 0 && (
        <div className="mb-4 rounded-[10px] border border-fault/30 bg-fault/5 p-3">
          <div className="flex items-center gap-1.5 mb-2 text-[10.5px] uppercase tracking-[0.1em] text-fault font-medium">
            <AlertTriangle size={11} />
            {overdue.length} visit{overdue.length > 1 ? "s" : ""} overdue — no update received
          </div>
          <div className="space-y-1">
            {overdue.map((v) => (
              <Link
                key={v.id}
                href={`/site-visits/${v.id}` as Route}
                className="flex items-center justify-between gap-3 rounded-[8px] px-2 py-1.5 hover:bg-fault/8 transition-colors group"
              >
                <div className="min-w-0">
                  <div className="text-[12.5px] text-text truncate group-hover:text-fault">{v.name}</div>
                  <div className="text-[11px] text-text-dim truncate">{v.meta}</div>
                </div>
                <span className="shrink-0 text-[10.5px] text-fault/80 tabular whitespace-nowrap">
                  {v.day} {v.month} · {v.assignee}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length === 0 && overdue.length === 0 && (
        <div className="py-8 text-center text-[12px] text-text-dim">
          No site visits scheduled in the next 14 days.
        </div>
      )}

      {upcoming.length > 0 && (
        <>
          {overdue.length > 0 && (
            <div className="mb-2 text-[10px] uppercase tracking-[0.1em] text-text-dim">Upcoming</div>
          )}
          <div className="space-y-1">
            {upcoming.map((v, i) => (
              <Link
                key={v.id}
                href={`/site-visits/${v.id}` as Route}
                className={[
                  "flex items-center gap-4 py-2.5 hover:bg-surface-2 -mx-2 px-2 rounded-[8px] transition-colors",
                  i < upcoming.length - 1 ? "border-b border-rule/70" : "",
                ].join(" ")}
              >
                <div className="w-11 flex flex-col items-center gap-0.5 shrink-0">
                  <div className="tabular text-[18px] leading-none font-medium text-accent">{v.day}</div>
                  <div className="text-[9.5px] tracking-[0.16em] text-text-dim">{v.month}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-text truncate">{v.name}</div>
                  <div className="text-[11.5px] text-text-dim truncate">{v.meta}</div>
                </div>
                <span className={[
                  "text-[10.5px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0",
                  v.status === "IN_PROGRESS"
                    ? "bg-heat/12 text-heat"
                    : "bg-surface-2 text-text-dim",
                ].join(" ")}>
                  {v.assignee}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

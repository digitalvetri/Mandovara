import Link from "next/link";
import type { SiteVisit } from "./types";

export function SiteVisits({ visits }: { visits: SiteVisit[] }) {
  return (
    <div className="rounded-[14px] bg-surface border border-rule p-6">
      <div className="flex items-baseline justify-between mb-5">
        <div className="font-display text-[18px] font-semibold text-text">
          Upcoming site visits
        </div>
        <Link
          href="/projects"
          className="text-[11px] text-text-dim hover:text-accent transition-colors"
        >
          View all →
        </Link>
      </div>

      {visits.length === 0 && (
        <div className="py-8 text-center text-[12px] text-text-dim">
          No upcoming site visits scheduled.
        </div>
      )}
      <div className="space-y-1">
        {visits.map((v, i) => (
          <div
            key={v.id}
            className={[
              "flex items-center gap-4 py-2.5",
              i < visits.length - 1 ? "border-b border-rule/70" : "",
            ].join(" ")}
          >
            <div className="w-11 flex flex-col items-center gap-0.5 shrink-0">
              <div className="tabular text-[18px] leading-none font-medium text-accent">
                {v.day}
              </div>
              <div className="text-[9.5px] tracking-[0.16em] text-text-dim">
                {v.month}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] text-text truncate">{v.name}</div>
              <div className="text-[11.5px] text-text-dim truncate">{v.meta}</div>
            </div>
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-good/12 text-good font-medium whitespace-nowrap">
              {v.owner}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

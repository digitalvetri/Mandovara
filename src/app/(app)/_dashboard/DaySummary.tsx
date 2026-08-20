import Link from "next/link";
import {
  Users, CalendarCheck, Ruler, Wrench, AlertCircle,
  Package, ClipboardList, FileText, UserCheck, IndianRupee,
  CheckCircle2, type LucideIcon,
} from "lucide-react";
import type { DaySummaryItem } from "@/modules/dashboard/day-summary";

// The dashboard's hero band.
//
// This space used to hold a greeting and a live clock on a dark slab: the
// largest, heaviest object above the fold, carrying a name and the time. §1.3
// says what an owner wants here — "every live project's stage, what's stuck,
// and what money is due, in 30 seconds" — so the band now carries the day's
// actual work, and the greeting is one line of it rather than the whole thing.
//
// Chips use the *-chrome tokens. The ordinary status colours are solved
// against white and measure 3.52:1 on this ground; the chrome variants give
// 5.8–9.6:1. See §6.2 and docs/DECISIONS.md.
const ICONS: Record<DaySummaryItem["icon"], LucideIcon> = {
  Users, CalendarCheck, Ruler, Wrench, AlertCircle,
  Package, ClipboardList, FileText, UserCheck, IndianRupee,
};

const URGENCY = {
  normal: "border-white/15 bg-white/[0.07] text-sidebar-text hover:bg-white/[0.13]",
  warn:   "border-heat-chrome/30  bg-heat-chrome/10  text-heat-chrome  hover:bg-heat-chrome/20",
  hot:    "border-fault-chrome/35 bg-fault-chrome/12 text-fault-chrome hover:bg-fault-chrome/20",
} as const;

function greet(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function buildNarrative(items: DaySummaryItem[]): string {
  const active = items.filter((i) => i.count > 0);
  if (active.length === 0) return "Nothing urgent today.";
  const parts = active.slice(0, 3).map((i) => `${i.count} ${i.label}`);
  if (parts.length === 1) return `${parts[0]} needs you.`;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}.`;
  return `${parts[0]}, ${parts[1]}, and ${parts[2]}.`;
}

interface Props {
  items: DaySummaryItem[];
  userName: string;
  /** IST hour, resolved on the server so the copy does not flicker on hydrate. */
  hour: number;
  dateLabel: string;
}

export function DaySummary({ items, userName, hour, dateLabel }: Props) {
  const active    = items.filter((i) => i.count > 0);
  const allClear  = active.length === 0;
  const firstName = userName.split(" ")[0] || "there";

  return (
    <div className="relative overflow-hidden rounded-[16px] bg-sidebar text-sidebar-text">
      <div aria-hidden className="pointer-events-none absolute inset-0 chrome-veil" />
      <div aria-hidden className="pointer-events-none absolute inset-0 hero-facets" />

      <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-1.5 text-[11px] font-medium tracking-[0.04em] text-sidebar-dim">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent-chrome" />
            {dateLabel}
          </div>
          {!allClear && (
            <span className="text-[11.5px] text-sidebar-dim">
              {active.length} action{active.length === 1 ? "" : "s"} today
            </span>
          )}
        </div>

        <p className="mt-5 text-[12.5px] text-sidebar-dim">
          {greet(hour)}, {firstName}
        </p>

        {/* The day itself, at display scale — this is the sentence the owner
            came to read, so it gets the size the clock used to have. */}
        <h2 className="mt-1.5 max-w-[46ch] font-display text-[24px] sm:text-[30px] font-[560] leading-[1.18] tracking-[-0.015em] text-sidebar-text">
          {buildNarrative(items)}
        </h2>

        {allClear ? (
          <div className="mt-4 inline-flex items-center gap-2 text-[12.5px] text-solid-chrome">
            <CheckCircle2 size={14} strokeWidth={2} aria-hidden />
            <span>Nothing on your plate — enjoy the calm.</span>
          </div>
        ) : (
          <div className="mt-5 flex flex-wrap gap-2">
            {active.map((item) => {
              const Icon = ICONS[item.icon];
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={[
                    "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5",
                    "text-[12px] font-medium transition-colors duration-140",
                    URGENCY[item.urgency],
                  ].join(" ")}
                >
                  <Icon size={13} strokeWidth={2} aria-hidden />
                  <span className="tabular-nums font-semibold">{item.count}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

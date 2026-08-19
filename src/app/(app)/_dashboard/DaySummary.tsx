import Link from "next/link";
import {
  Users, CalendarCheck, Ruler, Wrench, AlertCircle,
  Package, ClipboardList, FileText, UserCheck, IndianRupee,
  CheckCircle2, type LucideIcon,
} from "lucide-react";
import type { DaySummaryItem } from "@/modules/dashboard/day-summary";

const ICONS: Record<DaySummaryItem["icon"], LucideIcon> = {
  Users, CalendarCheck, Ruler, Wrench, AlertCircle,
  Package, ClipboardList, FileText, UserCheck, IndianRupee,
};

const URGENCY = {
  normal: { chip: "bg-surface-2 text-text-muted border-rule",  icon: "text-text-dim"  },
  warn:   { chip: "bg-heat/8  text-heat  border-heat/20",      icon: "text-heat"      },
  hot:    { chip: "bg-fault/8 text-fault border-fault/20",     icon: "text-fault"     },
};

function buildNarrative(items: DaySummaryItem[]): string {
  const active = items.filter((i) => i.count > 0);
  if (active.length === 0) return "You’re all caught up — nothing urgent today.";
  const parts  = active.slice(0, 3).map((i) => `${i.count} ${i.label}`);
  if (parts.length === 1) return `You have ${parts[0]}.`;
  if (parts.length === 2) return `You have ${parts[0]} and ${parts[1]}.`;
  return `You have ${parts[0]}, ${parts[1]}, and ${parts[2]}.`;
}

interface Props {
  items: DaySummaryItem[];
}

export function DaySummary({ items }: Props) {
  const allClear  = items.every((i) => i.count === 0) || items.length === 0;
  const narrative = buildNarrative(items);

  return (
    <div className="rounded-[14px] bg-surface border border-rule shadow-sm px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-text-dim">
          Your day
        </h3>
        {!allClear && (
          <span className="text-[11px] text-text-subtle">
            {items.filter((i) => i.count > 0).length} action{items.filter((i) => i.count > 0).length === 1 ? "" : "s"} today
          </span>
        )}
      </div>

      <p className="mt-2 text-[13px] text-text-muted leading-snug">{narrative}</p>

      {allClear ? (
        <div className="mt-3 flex items-center gap-2 text-solid text-[12.5px]">
          <CheckCircle2 size={14} strokeWidth={2} aria-hidden />
          <span>Nothing on your plate — enjoy the calm.</span>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.filter((i) => i.count > 0).map((item) => {
            const Icon   = ICONS[item.icon];
            const tone   = URGENCY[item.urgency];
            return (
              <Link
                key={item.id}
                href={item.href}
                className={[
                  "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5",
                  "text-[12px] font-medium transition-opacity hover:opacity-75",
                  tone.chip,
                ].join(" ")}
              >
                <Icon size={13} strokeWidth={2} className={tone.icon} aria-hidden />
                <span className="tabular-nums font-semibold">{item.count}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

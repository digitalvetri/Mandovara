// Employee dashboard chips and rows (§10 split).

import Link from "next/link";
import type { Route } from "next";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";

export function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PRESENT:  { label: "Present",  cls: "bg-solid/15 text-solid"       },
    HALF_DAY: { label: "Half Day", cls: "bg-heat/15 text-heat"         },
    ABSENT:   { label: "Absent",   cls: "bg-fault/15 text-fault"       },
    LEAVE:    { label: "On Leave", cls: "bg-info/15 text-info"         },
    HOLIDAY:  { label: "Holiday",  cls: "bg-gold/15 text-gold"         },
    WEEK_OFF: { label: "Week Off", cls: "bg-surface-2 text-text-muted" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "bg-surface-2 text-text-muted" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

export function StatRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-text-muted">{label}</span>
      <span className={`font-data tabular-nums text-[13px] font-semibold ${color}`}>
        {value}
      </span>
    </div>
  );
}

export function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href as Route}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-[8px] border border-border bg-surface-2 text-[12px] text-text-muted hover:text-text hover:border-gold/40 transition-colors"
    >
      <span className="text-gold">{icon}</span>
      {label}
    </Link>
  );
}

export function LeaveStateBadge({ state }: { state: string }) {
  if (state === "APPROVED") return (
    <span className="flex items-center gap-1 text-[11px] font-semibold text-solid">
      <CheckCircle2 size={12} /> Approved
    </span>
  );
  if (state === "REJECTED") return (
    <span className="flex items-center gap-1 text-[11px] font-semibold text-fault">
      <XCircle size={12} /> Rejected
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-[11px] font-semibold text-heat">
      <AlertCircle size={12} /> Pending
    </span>
  );
}

export function humaniseType(t: string) {
  const map: Record<string, string> = {
    CASUAL: "Casual", SICK: "Sick", EARNED: "Earned",
    UNPAID: "Unpaid", COMP_OFF: "Comp off",
  };
  return map[t] ?? t;
}

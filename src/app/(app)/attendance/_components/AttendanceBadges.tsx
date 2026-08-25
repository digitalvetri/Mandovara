// Small attendance badges and chips (§10 split).

// Attendance calendar helpers and views, split out of page.tsx (§10).

import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";

export function SummaryChip({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={`rounded-[12px] border border-border ${bg} px-4 py-3 flex items-center justify-between`}>
      <div>
        <p className="text-[10.5px] text-text-muted mb-0.5">{label}</p>
        <p className={`font-data tabular-nums text-[22px] font-semibold leading-none ${color}`}>{value}</p>
      </div>
      <span className="text-[10px] text-text-subtle">{value === 1 ? "day" : "days"}</span>
    </div>
  );
}

export function AttendanceBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PRESENT:  { label: "Present",  cls: "bg-solid/12 text-solid"       },
    HALF_DAY: { label: "Half Day", cls: "bg-heat/15 text-heat"         },
    ABSENT:   { label: "Absent",   cls: "bg-fault/12 text-fault"       },
    LEAVE:    { label: "Leave",    cls: "bg-info/12 text-info"         },
    HOLIDAY:  { label: "Holiday",  cls: "bg-gold/12 text-gold"         },
    WEEK_OFF: { label: "Week Off", cls: "bg-surface-2 text-text-muted" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "bg-surface-2 text-text-muted" };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

export function LeaveStateBadge({ state }: { state: string }) {
  if (state === "APPROVED") return (
    <span className="flex items-center gap-1 text-[11px] font-semibold text-solid shrink-0">
      <CheckCircle2 size={11} /> Approved
    </span>
  );
  if (state === "REJECTED") return (
    <span className="flex items-center gap-1 text-[11px] font-semibold text-fault shrink-0">
      <XCircle size={11} /> Rejected
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-[11px] font-semibold text-heat shrink-0">
      <AlertCircle size={11} /> Pending
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

export function BandCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  const accents: Record<string, string> = {
    solid: "border-l-solid", fault: "border-l-fault",
    heat:  "border-l-heat",  info:  "border-l-info",
  };
  return (
    <div className={`rounded-[14px] bg-surface border border-border border-l-[3px] ${accents[tone] ?? ""} p-5`}>
      <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-muted">{label}</div>
      <div className="mt-3 font-display text-[36px] font-semibold text-text tabular-nums leading-none">{value}</div>
    </div>
  );
}

export function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 h-[34px] font-medium text-left">{children}</th>;
}
export function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2 ${className}`}>{children}</td>;
}

// Attendance calendar helpers and views, split out of page.tsx (§10).


export const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export const DAY_LABELS  = ["Su","Mo","Tu","We","Th","Fr","Sa"];

export const LEAVE_DEFAULTS: Record<string, { label: string; total: number }> = {
  CASUAL:   { label: "Casual Leave",  total: 12 },
  SICK:     { label: "Sick Leave",    total: 8  },
  EARNED:   { label: "Earned Leave",  total: 15 },
  COMP_OFF: { label: "Comp Off",      total: 5  },
};

export function fmtTime(d: Date) {
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  });
}
export function fmtDate(d: Date) {
  return d.toLocaleDateString("en-IN", {
    day: "numeric", month: "short", timeZone: "Asia/Kolkata",
  });
}
export function fmtDateFull(d: Date) {
  return d.toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  });
}

export function workedStr(inAt: Date, outAt: Date | null, now: Date): string | null {
  if (!inAt) return null;
  const end  = outAt ?? now;
  const mins = Math.max(0, Math.floor((end.getTime() - inAt.getTime()) / 60000));
  const h    = Math.floor(mins / 60);
  const m    = mins % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export function calendarDotColor(status: string | undefined): string {
  const m: Record<string, string> = {
    PRESENT:  "bg-solid",
    HALF_DAY: "bg-heat",
    ABSENT:   "bg-fault",
    LEAVE:    "bg-info",
    HOLIDAY:  "bg-gold",
    WEEK_OFF: "bg-text-subtle",
  };
  return m[status ?? ""] ?? "bg-border";
}

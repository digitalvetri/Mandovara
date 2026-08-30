// Task date and reference helpers.
//
// These lived in tasks/page.tsx as exports, and TaskViews imported four of
// them from there. A route file may only export Next's own page bindings, so
// `tsc` rejected the generated route type as soon as .next/dev/types existed
// — which happens the moment anyone runs the dev server. A clean CI checkout
// typechecks before it builds, so CI never saw it and the failure only ever
// appeared locally. Same fix as attendance/_status-styles.ts.

export function todayUTC(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

export function fmtDate(d: Date) {
  return d.toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  });
}

export function dueLabel(dueAt: Date, today: Date): { text: string; cls: string; urgent: boolean } {
  const diff = Math.floor((dueAt.getTime() - today.getTime()) / 86_400_000);
  if (diff < -1) return { text: `${Math.abs(diff)}d overdue`, cls: "text-fault",     urgent: true  };
  if (diff === -1) return { text: "1d overdue",               cls: "text-fault",     urgent: true  };
  if (diff === 0)  return { text: "Due today",                cls: "text-heat",      urgent: true  };
  if (diff === 1)  return { text: "Due tomorrow",             cls: "text-heat",      urgent: false };
  if (diff <= 7)   return { text: `In ${diff} days`,          cls: "text-text-muted",urgent: false };
  return               { text: fmtDate(dueAt),               cls: "text-text-muted",urgent: false };
}

export function urgencyBorder(dueAt: Date, today: Date): string {
  const diff = Math.floor((dueAt.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0)  return "border-l-fault/70";
  if (diff === 0) return "border-l-heat/70";
  return "border-l-border/40";
}

export function refHref(refType: string, refId: string): string | null {
  const map: Record<string, string> = {
    LEAD:      `/leads/${refId}`,
    PROJECT:   `/projects/${refId}`,
    CLIENT:    `/clients/${refId}`,
    QUOTATION: `/quotations/${refId}`,
    ORDER:     `/orders/${refId}`,
  };
  return map[refType] ?? null;
}

export type Tab = "all" | "today" | "upcoming" | "completed";

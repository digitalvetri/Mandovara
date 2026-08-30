// Attendance status vocabulary and its tones.
//
// These lived in attendance/page.tsx as exports, and AttendanceSelfView
// imported STATUS_LABEL from there. A route file may only export Next's own
// page bindings, so `tsc` rejected the generated route type as soon as
// .next/dev/types existed — which happens the moment anyone runs the dev
// server. A clean CI checkout typechecks before it builds, so CI never saw
// it and the failure only ever showed up locally.
//
// A plain module has no such restriction, and the two consumers now share one
// definition instead of the page owning it.

export const STATUS_TONE: Record<string, string> = {
  PRESENT:  "bg-solid/12 text-solid",
  ABSENT:   "bg-fault/12 text-fault",
  HALF_DAY: "bg-heat/15 text-heat",
  LEAVE:    "bg-info/12 text-info",
  HOLIDAY:  "bg-gold/12 text-gold",
  WEEK_OFF: "bg-surface-2 text-text-muted",
};

export const STATUS_LABEL: Record<string, string> = {
  PRESENT: "Present", ABSENT: "Absent", HALF_DAY: "Half day",
  LEAVE: "Leave", HOLIDAY: "Holiday", WEEK_OFF: "Week off",
};

export const LEAVE_TONE: Record<string, string> = {
  APPROVED: "bg-solid/12 text-solid",
  PENDING:  "bg-heat/15 text-heat",
  REJECTED: "bg-fault/12 text-fault",
};

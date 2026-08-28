export type GpsState = "idle" | "requesting" | "ok" | "denied";
export type Banner   = { variant: "success" | "error"; message: string } | null;

export const STATUS_COLOR: Record<string, string> = {
  PRESENT:  "text-solid-chrome",
  HALF_DAY: "text-heat-chrome",
  ABSENT:   "text-fault-chrome",
  LEAVE:    "text-info-chrome",
  HOLIDAY:  "text-gold-chrome",
  WEEK_OFF: "text-sidebar-dim",
};

export const STATUS_LABEL: Record<string, string> = {
  PRESENT:  "Present",
  HALF_DAY: "Half Day",
  ABSENT:   "Absent",
  LEAVE:    "On Leave",
  HOLIDAY:  "Holiday",
  WEEK_OFF: "Week Off",
};

export const NON_WORK = new Set(["LEAVE", "HOLIDAY", "WEEK_OFF"]);

export function fmtISO(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  });
}

export function elapsedStr(fromISO: string, toISO?: string | null): string {
  const mins = Math.max(0, Math.floor(
    ((toISO ? new Date(toISO) : new Date()).getTime() - new Date(fromISO).getTime()) / 60000,
  ));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

// getGps() lived here. Replaced 2026-08-29 by src/lib/geolocation.ts,
// which distinguishes an insecure origin from a denied permission from
// a timeout — a distinction this one could not make, so every failure
// told the employee to allow location access even when there was
// nothing to allow.


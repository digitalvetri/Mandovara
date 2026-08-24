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

export function getGps(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { timeout: 8000, enableHighAccuracy: true },
    );
  });
}

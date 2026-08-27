// Minutes as "7h 30m" — used by the payroll month grid and its tooltips.
//
// Not Intl: this is a duration, not a time of day, and en-IN has no
// duration format that produces what a payroll sheet wants.

export function formatHours(minutes: number): string {
  if (minutes <= 0) return "0h";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

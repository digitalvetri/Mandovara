export type View = "month" | "week" | "day";
export interface Lead { id: string; name: string; mobile: string; }
export const DAY_ABBR = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
export function startOfDay(d: Date): Date   { const c=new Date(d); c.setHours(0,0,0,0); return c; }
export function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
export function endOfMonth(d: Date): Date   { return new Date(d.getFullYear(), d.getMonth()+1, 0); }
export function startOfWeek(d: Date): Date  { const c=new Date(d); c.setDate(d.getDate()-d.getDay()); return startOfDay(c); }
export function addDays(d: Date, n: number): Date { const c=new Date(d); c.setDate(c.getDate()+n); return c; }
export function addMonths(d: Date, n: number): Date { return new Date(d.getFullYear(), d.getMonth()+n, 1); }
export function sameDay(a: Date, b: Date): boolean { return iso(a) === iso(b); }

export function buildMonthGrid(anchor: Date): Date[] {
  const first = startOfMonth(anchor);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}
export function buildWeek(anchor: Date): Date[] {
  const s = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
}

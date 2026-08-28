// Month-on-month and week-on-week movement for the Reports KPIs.
//
// The dashboard printed six figures with nothing to read them against —
// "₹4.2L revenue" tells an owner nothing about whether the month is
// going well. The owner asked for percentage growth/decline versus the
// previous month and the previous week (2026-08-29).
//
// Every number still comes from the same getReportKpis over the same
// live tables; this only runs it over three windows and subtracts.

import type { RequestContext } from "@/kernel/auth/context";
import { getReportKpis, type ReportKpis } from "./kpi";

/** Which KPIs are period-bound and therefore comparable over time.
 *  outstanding / activeProjects / readyToInstall are current-state
 *  snapshots — "last month's outstanding" is not a thing this query can
 *  answer, so comparing them would be inventing a number. */
export type ComparableKpi = "revenue" | "collections" | "newLeads";

export interface Movement {
  current:  number;
  previous: number;
  /** Percentage change, or null when the previous period was zero —
   *  see pctChange(). */
  pct:      number | null;
}

export interface Comparatives {
  month: Record<ComparableKpi, Movement>;
  week:  Record<ComparableKpi, Movement>;
}

/**
 * Percentage change from `previous` to `current`.
 *
 * Returns null when the previous period was zero. Growth from nothing is
 * not a percentage — the honest answers are "+∞" or "new", and printing
 * "+100%" (or worse, "0%") would understate a first month of trading and
 * overstate a flat one. The UI renders null as "no prior data".
 */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** Midnight UTC, n days before `from`. */
function daysBefore(from: Date, n: number): Date {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function movement(
  cur: ReportKpis, prev: ReportKpis, key: ComparableKpi,
): Movement {
  // BigInt money is converted at the boundary: these are ratios for
  // display, never written back as amounts (rule 8 stays intact because
  // nothing here re-enters the money path).
  const c = typeof cur[key]  === "bigint" ? Number(cur[key])  : (cur[key]  as number);
  const p = typeof prev[key] === "bigint" ? Number(prev[key]) : (prev[key] as number);
  return { current: c, previous: p, pct: pctChange(c, p) };
}

/**
 * @param now  Reference instant. Injected so this is testable and so a
 *   report rendered at 23:59 does not straddle two days mid-query.
 */
export async function getComparatives(
  ctx: RequestContext,
  now: Date = new Date(),
): Promise<Comparatives> {
  const monthStart     = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const prevMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const prevMonthEnd   = new Date(monthStart.getTime() - 1);

  const weekStart     = daysBefore(now, 7);
  const prevWeekStart = daysBefore(now, 14);
  const prevWeekEnd   = new Date(weekStart.getTime() - 1);

  const [thisMonth, lastMonth, thisWeek, lastWeek] = await Promise.all([
    getReportKpis(ctx, { from: monthStart,     to: now }),
    getReportKpis(ctx, { from: prevMonthStart, to: prevMonthEnd }),
    getReportKpis(ctx, { from: weekStart,      to: now }),
    getReportKpis(ctx, { from: prevWeekStart,  to: prevWeekEnd }),
  ]);

  const keys: ComparableKpi[] = ["revenue", "collections", "newLeads"];
  const build = (cur: ReportKpis, prev: ReportKpis) =>
    Object.fromEntries(keys.map((k) => [k, movement(cur, prev, k)])) as Record<ComparableKpi, Movement>;

  return {
    month: build(thisMonth, lastMonth),
    week:  build(thisWeek, lastWeek),
  };
}

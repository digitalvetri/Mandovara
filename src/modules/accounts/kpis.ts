// Money KPI aggregation for the Accounts overview.

import { scoped } from "@/kernel/db/scoped";
import type { RequestContext } from "@/kernel/auth/context";
import type { MoneyKpis } from "./types";

// ── Money KPI aggregation ─────────────────────────────────────────
// Feeds the 4 KPI cards on Overview. Reuses openRows (already computed
// above for outstanding) and the outflow bundle (for SPENT this month).

export async function buildMoneyKpis(
  ctx:     RequestContext,
  db:      ReturnType<typeof scoped>,
  today:   Date,
  openRows: Array<{ outstanding: bigint; daysOverdue: number }>,
): Promise<MoneyKpis> {
  // Period windows — "this month" = first-of-month → next-month-1st (UTC).
  const thisStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const thisEnd   = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
  const prevStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  const prevEnd   = thisStart;
  const weekEnd   = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);

  // TO COLLECT: derived from the openRows already computed above
  let toCollect       = 0n;
  let toCollectLate60 = 0n;
  for (const r of openRows) {
    toCollect += r.outstanding;
    if (r.daysOverdue > 60) toCollectLate60 += r.outstanding;
  }

  // Parallel-fetch: this-month & prev-month CAME IN, this & prev SPENT slices,
  // TO PAY (unpaid POs + approved-unpaid expenses + due-this-week slice)
  const [cameInThisAgg, cameInPrevAgg, spentThisAgg, spentPrevAgg, toPayBundle] = await Promise.all([
    db.receipt.aggregate({ _sum: { amount: true }, where: { date: { gte: thisStart, lt: thisEnd } } }),
    db.receipt.aggregate({ _sum: { amount: true }, where: { date: { gte: prevStart, lt: prevEnd } } }),
    buildSpentSum(ctx, db, thisStart, thisEnd),
    buildSpentSum(ctx, db, prevStart, prevEnd),
    buildToPaySum(ctx, db, weekEnd),
  ]);

  return {
    toCollect,
    toCollectLate60,
    toCollectCount:  openRows.length,
    cameInThis:      cameInThisAgg._sum.amount ?? 0n,
    cameInPrev:      cameInPrevAgg._sum.amount ?? 0n,
    toPay:           toPayBundle.total,
    toPayDueWeek:    toPayBundle.dueWeek,
    spentThis:       spentThisAgg,
    spentPrev:       spentPrevAgg,
  };
}

/** Sum of outflow (Expense + ProjectExpense + PAID Payslip) between two dates.
 *  Kept permission-agnostic here — outer loadAccountsOverview already applies
 *  the receipt.view gate, and the Money KPI strip is only rendered for Owners /
 *  Accounts anyway. */
export async function buildSpentSum(
  _ctx:  RequestContext,
  db:    ReturnType<typeof scoped>,
  start: Date,
  end:   Date,
): Promise<bigint> {
  const [expAgg, projExpAgg, slipAgg] = await Promise.all([
    db.expense.aggregate({
      _sum: { amount: true },
      where: { incurredAt: { gte: start, lt: end } },
    }),
    db.projectExpense.aggregate({
      _sum: { amount: true },
      where: { incurredAt: { gte: start, lt: end } },
    }),
    db.payslip.aggregate({
      _sum: { netPay: true },
      where: { run: { status: "PAID", paidAt: { gte: start, lt: end } } },
    }),
  ]);
  return (expAgg._sum.amount ?? 0n) + (projExpAgg._sum.amount ?? 0n) + (slipAgg._sum.netPay ?? 0n);
}

/** Approved-unpaid Expenses + unpaid POs. Returns total + amount due within 7 days. */
export async function buildToPaySum(
  _ctx:   RequestContext,
  db:     ReturnType<typeof scoped>,
  weekEnd: Date,
): Promise<{ total: bigint; dueWeek: bigint }> {
  const [expenses, purchaseOrders] = await Promise.all([
    db.expense.findMany({
      where:  { approvalState: "APPROVED", paidAt: null },
      select: { amount: true, incurredAt: true },
    }),
    db.purchaseOrder.findMany({
      where:  { status: { in: ["SENT", "PARTIAL"] } },
      select: { totalValue: true, expectedAt: true },
    }),
  ]);

  let total = 0n;
  let dueWeek = 0n;
  for (const e of expenses) {
    total += e.amount;
    // Expenses use incurredAt as the informal due-date proxy — the schema has
    // no explicit due-date field. Treat anything incurred already as "due".
    if (e.incurredAt < weekEnd) dueWeek += e.amount;
  }
  for (const po of purchaseOrders) {
    total += po.totalValue;
    if (po.expectedAt && po.expectedAt < weekEnd) dueWeek += po.totalValue;
  }
  return { total, dueWeek };
}

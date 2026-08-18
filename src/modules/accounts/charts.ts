// Phase 4 chart series for the Accounts overview.

import { scoped } from "@/kernel/db/scoped";
import { can } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import type { MonthlyInOutPoint, ExpenseHeadSlice, AttentionCounts } from "./types";

// ── Phase 4 chart data ────────────────────────────────────────────

const MONTH_LABELS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** 12 months of money-in vs money-out, oldest → newest, zero-filled. */
export async function buildMonthlyInOut(
  ctx:   RequestContext,
  db:    ReturnType<typeof scoped>,
  today: Date,
): Promise<MonthlyInOutPoint[]> {
  const from = new Date(today.getFullYear(), today.getMonth() - 11, 1);
  const canOutflow = can(ctx, "expense.view") || can(ctx, "payroll.view");

  const [receipts, expenses, projExps, slips] = await Promise.all([
    db.receipt.findMany({
      where:   { date: { gte: from } },
      select:  { date: true, amount: true },
    }),
    canOutflow
      ? db.expense.findMany({ where: { incurredAt: { gte: from } }, select: { incurredAt: true, amount: true } })
      : Promise.resolve([]),
    canOutflow
      ? db.projectExpense.findMany({ where: { incurredAt: { gte: from } }, select: { incurredAt: true, amount: true } })
      : Promise.resolve([]),
    can(ctx, "payroll.view")
      ? db.payslip.findMany({
          where:  { run: { status: "PAID", paidAt: { gte: from } } },
          select: { netPay: true, run: { select: { paidAt: true } } },
        })
      : Promise.resolve([]),
  ]);

  function keyOf(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  const inSum: Map<string, bigint>  = new Map();
  const outSum: Map<string, bigint> = new Map();
  for (const r of receipts)  inSum.set(keyOf(r.date),     (inSum.get(keyOf(r.date))     ?? 0n) + r.amount);
  for (const e of expenses)  outSum.set(keyOf(e.incurredAt), (outSum.get(keyOf(e.incurredAt)) ?? 0n) + e.amount);
  for (const e of projExps)  outSum.set(keyOf(e.incurredAt), (outSum.get(keyOf(e.incurredAt)) ?? 0n) + e.amount);
  for (const s of slips) {
    const d = s.run.paidAt;
    if (!d) continue;
    outSum.set(keyOf(d), (outSum.get(keyOf(d)) ?? 0n) + s.netPay);
  }

  const points: MonthlyInOutPoint[] = [];
  for (let i = 0; i < 12; i++) {
    const d       = new Date(from.getFullYear(), from.getMonth() + i, 1);
    const key     = keyOf(d);
    const label   = d.getMonth() === 0
      ? `${MONTH_LABELS_SHORT[0]} '${String(d.getFullYear()).slice(-2)}`
      : MONTH_LABELS_SHORT[d.getMonth()]!;
    points.push({
      monthKey: key, label,
      moneyIn:  inSum.get(key)  ?? 0n,
      moneyOut: outSum.get(key) ?? 0n,
    });
  }
  return points;
}

/** Top 8 expense heads over the last 12 months across Expense +
 *  ProjectExpense. Permission-gated; empty for viewers without
 *  expense.view. Caller collapses tail into "Other". */
export async function buildExpenseHeads(
  ctx:   RequestContext,
  db:    ReturnType<typeof scoped>,
  today: Date,
): Promise<ExpenseHeadSlice[]> {
  if (!can(ctx, "expense.view")) return [];
  const from = new Date(today.getFullYear(), today.getMonth() - 11, 1);

  const [expGroups, projGroups] = await Promise.all([
    db.expense.groupBy({
      by:    ["head"],
      where: { incurredAt: { gte: from } },
      _sum:  { amount: true },
      _count: { _all: true },
    }),
    db.projectExpense.groupBy({
      by:    ["head"],
      where: { incurredAt: { gte: from } },
      _sum:  { amount: true },
      _count: { _all: true },
    }),
  ]);

  const merged = new Map<string, { amount: bigint; count: number }>();
  for (const g of expGroups) {
    const cur = merged.get(g.head) ?? { amount: 0n, count: 0 };
    cur.amount += g._sum.amount ?? 0n;
    cur.count  += g._count._all;
    merged.set(g.head, cur);
  }
  for (const g of projGroups) {
    const cur = merged.get(g.head) ?? { amount: 0n, count: 0 };
    cur.amount += g._sum.amount ?? 0n;
    cur.count  += g._count._all;
    merged.set(g.head, cur);
  }

  return [...merged.entries()]
    .map(([head, v]) => ({ head, amount: v.amount, count: v.count }))
    .filter((s) => s.amount > 0n)
    .sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0));
}

/** Three counts for the Attention strip. Cheque + expense counts are
 *  permission-gated so a viewer without payroll/expense sees zeros. */
export async function buildAttentionCounts(
  ctx: RequestContext,
  db:  ReturnType<typeof scoped>,
): Promise<AttentionCounts> {
  const [chq, exp, unm] = await Promise.all([
    db.receipt.aggregate({
      _sum:   { amount: true },
      _count: { _all: true },
      where:  { chequeStatus: "PENDING" },
    }),
    can(ctx, "expense.view")
      ? db.expense.aggregate({
          _sum:   { amount: true },
          _count: { _all: true },
          where:  { approvalState: "PENDING" },
        })
      : Promise.resolve({ _sum: { amount: 0n }, _count: { _all: 0 } }),
    db.receipt.aggregate({
      _sum:   { unallocated: true },
      _count: { _all: true },
      where:  { unallocated: { gt: 0n } },
    }),
  ]);
  return {
    chequesPending:    { count: chq._count._all,  amount: chq._sum.amount    ?? 0n },
    expensesPending:   { count: exp._count._all,  amount: exp._sum.amount    ?? 0n },
    unmatchedReceipts: { count: unm._count._all,  amount: unm._sum.unallocated ?? 0n },
  };
}

// Money-out side of the Accounts overview: payment modes, outflow rows and
// the plain-English purpose line each row shows.

import { scoped } from "@/kernel/db/scoped";
import { can } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import type { AccountsOverview, OutflowKindSlice, OutflowRow, PaymentModeSlice } from "./types";

export function describePurpose(
  amount: bigint,
  unallocated: bigint,
  invoiceNumbers: string[],
): string {
  if (invoiceNumbers.length === 0) {
    // Nothing tied to an invoice — money is sitting on account.
    return "Advance received";
  }
  const shown = invoiceNumbers.slice(0, 2).join(", ");
  const more  = invoiceNumbers.length > 2 ? ` +${invoiceNumbers.length - 2} more` : "";
  const base  = `Payment for ${shown}${more}`;
  // Partial-advance case: applied to some invoices AND still has money left over.
  if (unallocated > 0n && unallocated < amount) {
    return `${base} · balance kept as advance`;
  }
  return base;
}

/** Group receipts from the last 12 months by PaymentMode, largest first. */
export async function buildPaymentModes(
  db: ReturnType<typeof scoped>,
  today: Date,
): Promise<PaymentModeSlice[]> {
  const from = new Date(today.getFullYear(), today.getMonth() - 11, 1);
  const rows = await db.receipt.groupBy({
    by:      ["mode"],
    where:   { date: { gte: from } },
    _sum:    { amount: true },
    _count:  { _all: true },
  });
  return rows
    .map((r) => ({
      mode:   r.mode as string,
      amount: r._sum.amount ?? 0n,
      count:  r._count._all,
    }))
    .filter((s) => s.amount > 0n)
    .sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0));
}

const MONTH_LABEL_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

interface MoneyOutBundle {
  summary: AccountsOverview["moneyOut"];
  kinds:   OutflowKindSlice[];
  recent:  OutflowRow[];
}

/** Load 12 months of outflows across salary + expenses + project expenses,
 * gated per-permission so viewers without the right scope see zeros +
 * the `hidden` flag set (page then hides the entire strip). */
export async function buildMoneyOut(
  ctx: RequestContext,
  db: ReturnType<typeof scoped>,
  today: Date,
): Promise<MoneyOutBundle> {
  const from = new Date(today.getFullYear(), today.getMonth() - 11, 1);
  const canExpense = can(ctx, "expense.view");
  const canPayroll = can(ctx, "payroll.view");

  // No visibility on any outflow → hide the whole strip.
  if (!canExpense && !canPayroll) {
    return {
      summary: {
        total: 0n, salary: 0n, expense: 0n, projectExpense: 0n,
        moneyIn: 0n, hidden: true,
      },
      kinds:  [],
      recent: [],
    };
  }

  // Parallel-fetch the three sources the viewer can see.
  const [paidSlips, expenses, projectExpenses, incomingTotal] = await Promise.all([
    canPayroll
      ? db.payslip.findMany({
          where: { run: { status: "PAID", paidAt: { gte: from } } },
          select: {
            id: true, netPay: true, employeeId: true,
            run: { select: { month: true, year: true, paidAt: true } },
          },
          orderBy: { id: "desc" },
        })
      : Promise.resolve([]),
    canExpense
      ? db.expense.findMany({
          where:   { incurredAt: { gte: from } },
          select:  { id: true, amount: true, head: true, description: true, incurredAt: true },
          orderBy: { incurredAt: "desc" },
        })
      : Promise.resolve([]),
    canExpense
      ? db.projectExpense.findMany({
          where:   { incurredAt: { gte: from } },
          select:  {
            id: true, amount: true, head: true, description: true, incurredAt: true,
            project: { select: { name: true } },
          },
          orderBy: { incurredAt: "desc" },
        })
      : Promise.resolve([]),
    db.receipt.aggregate({
      _sum: { amount: true },
      where: { date: { gte: from } },
    }),
  ]);

  // Employee-name lookup for salary rows
  const employeeIds = [...new Set(paidSlips.map((p) => p.employeeId))];
  const employees = employeeIds.length > 0
    ? await db.employee.findMany({
        where: { id: { in: employeeIds } },
        select: { id: true, name: true },
      })
    : [];
  const employeeName = new Map(employees.map((e) => [e.id, e.name]));

  // ── Totals ────────────────────────────────────────────────────
  const salary        = paidSlips.reduce((s, p) => s + p.netPay, 0n);
  const expense       = expenses.reduce((s, e) => s + e.amount, 0n);
  const projectExpense = projectExpenses.reduce((s, e) => s + e.amount, 0n);
  const total         = salary + expense + projectExpense;
  const moneyIn       = incomingTotal._sum.amount ?? 0n;

  // ── Donut slices (largest first, zero slices dropped) ─────────
  const kindsRaw: OutflowKindSlice[] = [
    { kind: "SALARY",          label: "Salary",           amount: salary,         count: paidSlips.length },
    { kind: "EXPENSE",         label: "Expenses",         amount: expense,        count: expenses.length },
    { kind: "PROJECT_EXPENSE", label: "Project spend",    amount: projectExpense, count: projectExpenses.length },
  ];
  const kinds = kindsRaw
    .filter((k) => k.amount > 0n)
    .sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0));

  // ── Unified recent feed: last 8 across all three ──────────────
  const feed: OutflowRow[] = [
    ...paidSlips.map((p) => ({
      id:     `pay:${p.id}`,
      kind:   "SALARY" as const,
      date:   p.run.paidAt ?? new Date(),
      label:  `Salary — ${employeeName.get(p.employeeId) ?? "employee"} (${MONTH_LABEL_SHORT[p.run.month - 1]} ${p.run.year})`,
      amount: p.netPay,
    })),
    ...expenses.map((e) => ({
      id:     `exp:${e.id}`,
      kind:   "EXPENSE" as const,
      date:   e.incurredAt,
      label:  `${e.head} — ${e.description}`,
      amount: e.amount,
    })),
    ...projectExpenses.map((e) => ({
      id:     `prj:${e.id}`,
      kind:   "PROJECT_EXPENSE" as const,
      date:   e.incurredAt,
      label:  `${e.head} — ${e.project.name}`,
      amount: e.amount,
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 8);

  return {
    summary: {
      total, salary, expense, projectExpense, moneyIn,
      hidden: false,
    },
    kinds,
    recent: feed,
  };
}

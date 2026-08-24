// Lists spending — unified across Expense + ProjectExpense + PAID
// Payslips — for the "Spending" tab. Filterable by head (from the
// ranked-bars chart click-through) and by period (this month / last
// 3 months / this year).

import { scoped } from "@/kernel/db/scoped";
import { requirePermission, can } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export type SpendingPeriod = "this-month" | "last-3-months" | "this-year";

export interface SpendingRow {
  id:         string;
  kind:       "EXPENSE" | "PROJECT_EXPENSE" | "SALARY";
  date:       Date;
  head:       string;
  label:      string;              // description or "Salary — Rajesh (Aug 2026)"
  projectName: string | null;
  amount:     bigint;
  paidAt:     Date | null;         // Expense.paidAt for expenses; null otherwise
}

export interface SpendingBundle {
  rows:     SpendingRow[];
  total:    bigint;
  period:   SpendingPeriod;
  headFilter: string | null;
}

export interface LoadSpendingOpts {
  period?: SpendingPeriod;
  head?:   string;
}

export async function loadSpending(
  ctx:  RequestContext,
  opts: LoadSpendingOpts = {},
): Promise<SpendingBundle> {
  requirePermission(ctx, "expense.view");
  const db = scoped(ctx);
  const period = opts.period ?? "this-month";
  const { start, end } = periodWindow(period);

  const [expenses, projExps, slips] = await Promise.all([
    db.expense.findMany({
      where:   {
        incurredAt: { gte: start, lt: end },
        approvalState: "APPROVED",
        ...(opts.head ? { head: opts.head } : {}),
      },
      orderBy: { incurredAt: "desc" },
      select:  {
        id: true, amount: true, incurredAt: true, head: true, subHead: true,
        description: true, approvalState: true, paidAt: true,
      },
      take: 200,
    }),
    db.projectExpense.findMany({
      where: {
        incurredAt: { gte: start, lt: end },
        approvalState: "APPROVED",
        ...(opts.head ? { head: opts.head } : {}),
      },
      orderBy: { incurredAt: "desc" },
      select: {
        id: true, amount: true, incurredAt: true, head: true, description: true,
        project: { select: { name: true } },
      },
      take: 200,
    }),
    // Salary rows only when the head filter doesn't exclude them + payroll perm
    (!opts.head || opts.head === "Salary") && can(ctx, "payroll.view")
      ? db.payslip.findMany({
          where:  { run: { status: "PAID", paidAt: { gte: start, lt: end } } },
          orderBy: { id: "desc" },
          select: {
            id: true, netPay: true, employeeId: true,
            run: { select: { paidAt: true, month: true, year: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  // Employee names for salary rows
  const empIds = [...new Set(slips.map((s) => s.employeeId))];
  const emps = empIds.length > 0
    ? await db.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, name: true } })
    : [];
  const empName = new Map(emps.map((e) => [e.id, e.name]));

  const rows: SpendingRow[] = [
    ...expenses.map((e) => ({
      id:          `exp:${e.id}`,
      kind:        "EXPENSE" as const,
      date:        e.incurredAt,
      head:        e.head,
      label:       e.subHead ? `${e.description} (${e.subHead})` : e.description,
      projectName: null,
      amount:      e.amount,
      paidAt:      e.paidAt,
    })),
    ...projExps.map((e) => ({
      id:          `prj:${e.id}`,
      kind:        "PROJECT_EXPENSE" as const,
      date:        e.incurredAt,
      head:        e.head,
      label:       e.description,
      projectName: e.project.name,
      amount:      e.amount,
      paidAt:      null,
    })),
    ...slips.map((s) => ({
      id:          `pay:${s.id}`,
      kind:        "SALARY" as const,
      date:        s.run.paidAt ?? new Date(),
      head:        "Salary",
      label:       `${empName.get(s.employeeId) ?? "employee"} — ${monthLabel(s.run.month, s.run.year)}`,
      projectName: null,
      amount:      s.netPay,
      paidAt:      s.run.paidAt,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const total = rows.reduce((s, r) => s + r.amount, 0n);

  return {
    rows,
    total,
    period,
    headFilter: opts.head ?? null,
  };
}

function periodWindow(period: SpendingPeriod): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  if (period === "this-month") {
    return { start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), end };
  }
  if (period === "last-3-months") {
    return { start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1)), end };
  }
  // this-year
  return { start: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)), end };
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function monthLabel(m: number, y: number): string {
  return `${MONTHS[m - 1]} ${y}`;
}

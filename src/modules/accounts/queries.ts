/* eslint-disable max-lines -- FIXME(§10): 797 lines, limit 300. Split by concern before the next phase; the rule stays enforced so this stays visible. */
import { scoped } from "@/kernel/db/scoped";
import { requirePermission, can } from "@/kernel/rbac/guard";
import { computeOutstanding } from "@/kernel/money/outstanding";
import type { RequestContext } from "@/kernel/auth/context";

export interface AgingBucket {
  key:    "current" | "d1_30" | "d31_60" | "d61_90" | "d90p";
  label:  string;
  amount: bigint;
  count:  number;
}

export interface OutstandingInvoiceRow {
  id:           string;
  number:       string;
  date:         Date;
  dueDate:      Date;
  daysOverdue:  number;
  clientId:     string;
  clientName:   string;
  clientMobile: string;
  projectId:    string | null;
  projectName:  string | null;
  total:        bigint;
  paid:         bigint;
  outstanding:  bigint;
  status:       string;
  bucketKey:    AgingBucket["key"];
}

export interface OutstandingClientRow {
  clientId:     string;
  clientName:   string;
  clientMobile: string;
  invoiceCount: number;
  outstanding:  bigint;
  oldestDays:   number;
}

export interface RecentReceiptRow {
  id:          string;
  number:      string;
  date:        Date;
  clientName:  string;
  mode:        string;
  amount:      bigint;
  unallocated: bigint;
  /** Plain-English description of what this payment covers. */
  purpose:     string;
}

export interface PaymentModeSlice {
  mode:   string;   // CASH | UPI | NEFT | RTGS | CHEQUE | CARD
  amount: bigint;
  count:  number;
}

/** One aggregated bucket in the outflow donut. */
export interface OutflowKindSlice {
  kind:   "SALARY" | "EXPENSE" | "PROJECT_EXPENSE";
  label:  string;
  amount: bigint;
  count:  number;
}

/** One row in the recent outflow feed — unified across payslips, expenses, project expenses. */
export interface OutflowRow {
  id:     string;    // prefixed: "pay:xxx" | "exp:xxx" | "prj:xxx"
  kind:   OutflowKindSlice["kind"];
  date:   Date;
  label:  string;    // "Salary — Rajesh (Aug 2026)", "Rent — August", "Site labour — Villa Kannan"
  amount: bigint;
}

/** One month bucket in the Money-in-vs-out chart (§7.1). */
export interface MonthlyInOutPoint {
  monthKey: string;   // YYYY-MM
  label:    string;   // "Aug" or "Jan '26"
  moneyIn:  bigint;
  moneyOut: bigint;
}

/** One head in the Where-the-money-goes ranked bar chart (§7.3).
 *  Top 8 raw heads returned; the caller collapses the tail into "Other". */
export interface ExpenseHeadSlice {
  head:   string;   // "Rent", "Site labour", "Utilities" …
  amount: bigint;
  count:  number;
}

/** Attention strip counts (§5.1 / spec §10). Only surfaces if any > 0. */
export interface AttentionCounts {
  chequesPending: { count: number; amount: bigint };
  expensesPending: { count: number; amount: bigint };
  unmatchedReceipts: { count: number; amount: bigint };
}

/** The 4 KPI cards driving the /accounts Overview header (§5.3). */
export interface MoneyKpis {
  /** TO COLLECT: sum of open invoice balances across all clients. */
  toCollect:       bigint;
  /** Amount within TO COLLECT that is more than 60 days late. */
  toCollectLate60: bigint;
  /** Number of open invoices contributing to TO COLLECT. */
  toCollectCount:  number;

  /** CAME IN: sum of receipts received this month. */
  cameInThis:      bigint;
  /** CAME IN previous period, for the ▲▼ delta. */
  cameInPrev:      bigint;

  /** TO PAY: unpaid POs + approved-unpaid expenses. */
  toPay:           bigint;
  /** Amount within TO PAY due this week (7 days). */
  toPayDueWeek:    bigint;

  /** SPENT: sum of Expense + ProjectExpense + PAID Payslips this month. */
  spentThis:       bigint;
  /** SPENT previous period, for the ▲▼ delta. */
  spentPrev:       bigint;
}

export interface AccountsOverview {
  invoiced:            bigint;
  received:            bigint;
  outstanding:         bigint;
  overdue:             bigint;
  customerCredit:      bigint;
  invoiceCount:        number;
  paidCount:           number;
  overdueCount:        number;
  aging:               AgingBucket[];
  outstandingInvoices: OutstandingInvoiceRow[];
  topClients:          OutstandingClientRow[];
  recentReceipts:      RecentReceiptRow[];
  activeBucket:        AgingBucket["key"] | null;
  /** Last 12 months of payments grouped by payment mode, largest first */
  paymentModes:        PaymentModeSlice[];
  /** The 4 KPI cards for the redesigned Overview (§5.3). */
  moneyKpis:           MoneyKpis;
  /** Money-out summary for the last 12 months. */
  moneyOut: {
    /** Total across all outflow categories, in paise. */
    total:       bigint;
    /** Sum of paid payslip netPay. */
    salary:      bigint;
    /** Sum of Expense.amount. */
    expense:     bigint;
    /** Sum of ProjectExpense.amount. */
    projectExpense: bigint;
    /** Total money in over the same period (for the net line). */
    moneyIn:     bigint;
    /** True if the viewer lacks permission to see any outflow — hide the whole strip. */
    hidden:      boolean;
  };
  /** Outflow donut slices for the last 12 months, largest first. */
  outflowKinds:        OutflowKindSlice[];
  /** 12-month money-in vs money-out for the trend chart. Oldest → newest. */
  monthlyInOut:        MonthlyInOutPoint[];
  /** Top 8 expense heads over the last 12 months. Caller collapses to "Other". */
  expenseHeads:        ExpenseHeadSlice[];
  /** Attention strip counts (cheques / expenses / unmatched receipts). */
  attention:           AttentionCounts;
  /** Last 8 outflows across salary + expense + project expense, newest first. */
  recentOutflows:      OutflowRow[];
}

export async function loadAccountsOverview(
  ctx: RequestContext,
  opts: { bucketFilter?: AgingBucket["key"] } = {},
): Promise<AccountsOverview> {
  requirePermission(ctx, "receipt.view");
  const db  = scoped(ctx);
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);

  const [invoices, receiptTotals, recent] = await Promise.all([
    db.invoice.findMany({
      where: { status: { in: ["ISSUED", "PARTIALLY_PAID", "PAID"] } },
      orderBy: { dueDate: "asc" },
      select: {
        id: true, number: true, date: true, dueDate: true, status: true,
        total: true, advanceAdjusted: true, clientId: true, projectId: true,
      },
    }),
    db.receipt.aggregate({
      _sum: { amount: true, unallocated: true },
      _count: { _all: true },
    }),
    db.receipt.findMany({
      orderBy: { date: "desc" },
      take: 8,
      select: {
        id: true, number: true, date: true, mode: true, amount: true,
        unallocated: true, clientId: true,
        // ReceiptAllocation has no direct invoice relation — just invoiceId.
        // Resolve numbers via a separate lookup below.
        allocations: { select: { invoiceId: true } },
      },
    }),
  ]);

  // Resolve invoice numbers for the recent receipts' allocations
  const allocInvoiceIds = [
    ...new Set(recent.flatMap((r) => r.allocations.map((a) => a.invoiceId))),
  ];
  const allocInvoices = allocInvoiceIds.length > 0
    ? await db.invoice.findMany({
        where: { id: { in: allocInvoiceIds } },
        select: { id: true, number: true },
      })
    : [];
  const allocInvoiceMap = new Map(allocInvoices.map((i) => [i.id, i.number]));

  // Batch-fetch client info
  const allClientIds = [...new Set([
    ...invoices.map((i) => i.clientId),
    ...recent.map((r) => r.clientId),
  ])];
  const clients = await db.client.findMany({
    where: { id: { in: allClientIds } },
    select: { id: true, name: true, mobile: true },
  });
  const clientMap = new Map(clients.map((c) => [c.id, c]));

  // Batch-fetch project names
  const allProjectIds = [...new Set(invoices.map((i) => i.projectId).filter(Boolean) as string[])];
  const projects = allProjectIds.length > 0
    ? await db.project.findMany({
        where: { id: { in: allProjectIds } },
        select: { id: true, name: true },
      })
    : [];
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  // Batch-fetch allocation sums for all non-cancelled invoices
  const invoiceIds = invoices.map((i) => i.id);
  const allocationSums = invoiceIds.length > 0
    ? await db.receiptAllocation.groupBy({
        by: ["invoiceId"],
        where: { invoiceId: { in: invoiceIds } },
        _sum: { amount: true },
      })
    : [];
  const paidMap = new Map(allocationSums.map((a) => [a.invoiceId, a._sum.amount ?? 0n]));

  let invoiced = 0n, outstandingTotal = 0n, overdue = 0n;
  let paidCount = 0, overdueCount = 0;

  const buckets = new Map<AgingBucket["key"], AgingBucket>([
    ["current", { key: "current", label: "Not yet due",  amount: 0n, count: 0 }],
    ["d1_30",   { key: "d1_30",   label: "1–30 days",   amount: 0n, count: 0 }],
    ["d31_60",  { key: "d31_60",  label: "31–60 days",  amount: 0n, count: 0 }],
    ["d61_90",  { key: "d61_90",  label: "61–90 days",  amount: 0n, count: 0 }],
    ["d90p",    { key: "d90p",    label: "Over 90 days", amount: 0n, count: 0 }],
  ]);

  const openRows: OutstandingInvoiceRow[] = [];
  const perClient = new Map<string, OutstandingClientRow>();

  for (const inv of invoices) {
    invoiced += inv.total;
    const paid  = paidMap.get(inv.id) ?? 0n;
    const open  = computeOutstanding(inv.total, inv.advanceAdjusted, paid);
    const client  = clientMap.get(inv.clientId);
    const project = inv.projectId ? projectMap.get(inv.projectId) : undefined;

    if (open <= 0n) { paidCount += 1; continue; }
    outstandingTotal += open;

    const days = Math.floor((today.getTime() - inv.dueDate.getTime()) / 86_400_000);
    if (days > 0) { overdue += open; overdueCount += 1; }

    const bucketKey: AgingBucket["key"] =
      days <= 0  ? "current" :
      days <= 30 ? "d1_30"   :
      days <= 60 ? "d31_60"  :
      days <= 90 ? "d61_90"  :
                   "d90p";
    const b = buckets.get(bucketKey)!;
    b.amount += open;
    b.count  += 1;

    openRows.push({
      id: inv.id, number: inv.number, date: inv.date, dueDate: inv.dueDate,
      daysOverdue: Math.max(0, days),
      clientId: inv.clientId, clientName: client?.name ?? "—", clientMobile: client?.mobile ?? "",
      projectId: inv.projectId ?? null,
      projectName: project?.name ?? null,
      total: inv.total, paid, outstanding: open,
      status: inv.status,
      bucketKey,
    });

    const c = perClient.get(inv.clientId);
    if (c) {
      c.invoiceCount += 1;
      c.outstanding  += open;
      if (days > c.oldestDays) c.oldestDays = days;
    } else {
      perClient.set(inv.clientId, {
        clientId: inv.clientId,
        clientName:   client?.name ?? "—",
        clientMobile: client?.mobile ?? "",
        invoiceCount: 1,
        outstanding:  open,
        oldestDays:   Math.max(0, days),
      });
    }
  }

  openRows.sort((a, b) => {
    if (b.daysOverdue !== a.daysOverdue) return b.daysOverdue - a.daysOverdue;
    return b.outstanding > a.outstanding ? 1 : b.outstanding < a.outstanding ? -1 : 0;
  });

  const topClients = [...perClient.values()]
    .sort((a, b) => b.outstanding > a.outstanding ? 1 : b.outstanding < a.outstanding ? -1 : 0)
    .slice(0, 8);

  const received       = receiptTotals._sum.amount ?? 0n;
  const customerCredit = receiptTotals._sum.unallocated ?? 0n;

  const filtered = opts.bucketFilter
    ? openRows.filter((r) => r.bucketKey === opts.bucketFilter)
    : openRows;

  // ── 12-month payment-mode breakdown for the donut ───────────────
  const paymentModes = await buildPaymentModes(db, today);

  // ── 12-month money-out (salary + expenses) ──────────────────────
  const outflow = await buildMoneyOut(ctx, db, today);

  // ── 4 KPI totals for the Overview header (§5.3) ─────────────────
  const moneyKpis = await buildMoneyKpis(ctx, db, today, openRows);

  // ── Phase 4 chart data + attention strip ─────────────────────────
  const [monthlyInOut, expenseHeads, attention] = await Promise.all([
    buildMonthlyInOut(ctx, db, today),
    buildExpenseHeads(ctx, db, today),
    buildAttentionCounts(ctx, db),
  ]);

  return {
    invoiced,
    received,
    outstanding: outstandingTotal,
    overdue,
    customerCredit,
    invoiceCount: invoices.length,
    paidCount,
    overdueCount,
    aging: [...buckets.values()],
    outstandingInvoices: filtered.slice(0, 50),
    topClients,
    recentReceipts: recent.map((r) => ({
      id: r.id, number: r.number, date: r.date,
      clientName: clientMap.get(r.clientId)?.name ?? "—",
      mode: r.mode, amount: r.amount, unallocated: r.unallocated,
      purpose: describePurpose(
        r.amount,
        r.unallocated,
        r.allocations.map((a) => allocInvoiceMap.get(a.invoiceId) ?? "—"),
      ),
    })),
    activeBucket: opts.bucketFilter ?? null,
    paymentModes,
    moneyKpis,
    moneyOut:       outflow.summary,
    outflowKinds:   outflow.kinds,
    recentOutflows: outflow.recent,
    monthlyInOut,
    expenseHeads,
    attention,
  };
}

/** Plain-English label for what a payment covers, derived from the
 * unallocated split and any invoices the receipt was applied to. */
function describePurpose(
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
async function buildPaymentModes(
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
async function buildMoneyOut(
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

// ── Money KPI aggregation ─────────────────────────────────────────
// Feeds the 4 KPI cards on Overview. Reuses openRows (already computed
// above for outstanding) and the outflow bundle (for SPENT this month).

async function buildMoneyKpis(
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
async function buildSpentSum(
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
async function buildToPaySum(
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

// ── Phase 4 chart data ────────────────────────────────────────────

const MONTH_LABELS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** 12 months of money-in vs money-out, oldest → newest, zero-filled. */
async function buildMonthlyInOut(
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
async function buildExpenseHeads(
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
async function buildAttentionCounts(
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

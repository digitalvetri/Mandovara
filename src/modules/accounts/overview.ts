// loadAccountsOverview — the Accounts page read model.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import type {
  AccountsOverview, AgingBucket,
  OutstandingClientRow, OutstandingInvoiceRow,
} from "./types";
import { loadReceivables, byClient } from "./receivables";
import { buildMoneyKpis } from "./kpis";
import { buildAttentionCounts, buildExpenseHeads, buildMonthlyInOut } from "./charts";
import { buildMoneyOut, buildPaymentModes, describePurpose } from "./money-out";

export async function loadAccountsOverview(
  ctx: RequestContext,
  opts: { bucketFilter?: AgingBucket["key"] } = {},
): Promise<AccountsOverview> {
  requirePermission(ctx, "receipt.view");
  const db  = scoped(ctx);
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);

  // What is owed comes from ONE list now — see ./receivables. A project with
  // an agreed quotation is a receivable in its own right; only bills that
  // belong to no project are counted separately. Before this, "to collect"
  // scanned invoices alone, so a job quoted at ₹4 lakh with nothing collected
  // reported ₹0 to collect, while the advance the client actually paid sat in
  // Received flagged "not matched to a bill".
  const [receivables, invoiceTotals, receiptTotals, recent] = await Promise.all([
    loadReceivables(db, today),
    db.invoice.aggregate({
      _sum:   { total: true },
      _count: { _all: true },
      where:  { status: { in: ["ISSUED", "PARTIALLY_PAID", "PAID"] } },
    }),
    db.receipt.aggregate({
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.receipt.findMany({
      orderBy: { date: "desc" },
      take: 8,
      select: {
        id: true, number: true, date: true, mode: true, amount: true,
        unallocated: true, clientId: true, projectId: true,
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

  const recentProjectIds = [
    ...new Set(recent.map((r) => r.projectId).filter((v): v is string => !!v)),
  ];
  const recentProjects = recentProjectIds.length > 0
    ? await db.project.findMany({
        where:  { id: { in: recentProjectIds } },
        select: { id: true, name: true },
      })
    : [];
  const recentProjectMap = new Map(recentProjects.map((p) => [p.id, p.name]));

  const recentClients = await db.client.findMany({
    where:  { id: { in: [...new Set(recent.map((r) => r.clientId))] } },
    select: { id: true, name: true },
  });
  const clientMap = new Map(recentClients.map((c) => [c.id, c]));

  const buckets = new Map<AgingBucket["key"], AgingBucket>([
    ["current", { key: "current", label: "Not yet due",  amount: 0n, count: 0 }],
    ["d1_30",   { key: "d1_30",   label: "1–30 days",   amount: 0n, count: 0 }],
    ["d31_60",  { key: "d31_60",  label: "31–60 days",  amount: 0n, count: 0 }],
    ["d61_90",  { key: "d61_90",  label: "61–90 days",  amount: 0n, count: 0 }],
    ["d90p",    { key: "d90p",    label: "Over 90 days", amount: 0n, count: 0 }],
  ]);

  let outstandingTotal = 0n, overdue = 0n, overdueCount = 0;
  const openRows: OutstandingInvoiceRow[] = [];

  for (const r of receivables) {
    outstandingTotal += r.outstanding;
    if (r.daysOverdue > 0) { overdue += r.outstanding; overdueCount += 1; }

    const b = buckets.get(r.bucketKey)!;
    b.amount += r.outstanding;
    b.count  += 1;

    openRows.push({
      id: r.id, number: r.ref, date: r.dueDate, dueDate: r.dueDate,
      daysOverdue: r.daysOverdue,
      clientId: r.clientId, clientName: r.clientName, clientMobile: r.clientMobile,
      projectId: r.projectId,
      projectName: r.projectName,
      total: r.total, paid: r.paid, outstanding: r.outstanding,
      status: r.status,
      bucketKey: r.bucketKey,
    });
  }

  const topClients: OutstandingClientRow[] = byClient(receivables)
    .slice(0, 8)
    .map((c) => ({
      clientId:     c.clientId,
      clientName:   c.clientName,
      clientMobile: c.clientMobile,
      invoiceCount: c.itemCount,
      outstanding:  c.outstanding,
      oldestDays:   c.oldestDays,
    }));

  const invoiced = invoiceTotals._sum.total ?? 0n;
  const received = receiptTotals._sum.amount ?? 0n;
  // "Extra amount kept for later bills" is money with no home at all —
  // neither on a bill nor booked to a job. Payments held against a project
  // are placed, not stray, so they are excluded here.
  const creditAgg = await db.receipt.aggregate({
    _sum:  { unallocated: true },
    where: { unallocated: { gt: 0n }, projectId: null },
  });
  const customerCredit = creditAgg._sum.unallocated ?? 0n;
  const paidCount = await db.invoice.count({ where: { status: "PAID" } });
  const invoiceCount = invoiceTotals._count._all;

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
    invoiceCount,
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
        r.projectId ? (recentProjectMap.get(r.projectId) ?? null) : null,
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

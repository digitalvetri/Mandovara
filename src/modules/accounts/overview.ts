// loadAccountsOverview — the Accounts page read model.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { computeOutstanding } from "@/kernel/money/outstanding";
import type { RequestContext } from "@/kernel/auth/context";
import type {
  AccountsOverview, AgingBucket,
  OutstandingClientRow, OutstandingInvoiceRow,
} from "./types";
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

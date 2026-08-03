// Accounts — money overview.
// Composes across invoices + receipts to answer:
//   "who owes what, how old is it, and what did we collect lately?"

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface AgingBucket {
  key: "current" | "d1_30" | "d31_60" | "d61_90" | "d90p";
  label: string;
  amount: bigint;
  count: number;
}

export interface OutstandingInvoiceRow {
  id: string;
  number: string;
  date: Date;
  dueDate: Date;
  daysOverdue: number;
  clientId: string;
  clientName: string;
  clientMobile: string;
  total: bigint;
  paid: bigint;
  outstanding: bigint;
  status: string;
}

export interface OutstandingClientRow {
  clientId: string;
  clientName: string;
  clientMobile: string;
  invoiceCount: number;
  outstanding: bigint;
  oldestDays: number;
}

export interface RecentReceiptRow {
  id: string;
  number: string;
  date: Date;
  clientName: string;
  mode: string;
  amount: bigint;
  unallocated: bigint;
}

export interface AccountsOverview {
  invoiced: bigint;
  received: bigint;
  outstanding: bigint;
  overdue: bigint;
  onAccount: bigint;
  invoiceCount: number;
  paidCount: number;
  overdueCount: number;
  aging: AgingBucket[];
  outstandingInvoices: OutstandingInvoiceRow[];
  topClients: OutstandingClientRow[];
  recentReceipts: RecentReceiptRow[];
}

export async function loadAccountsOverview(ctx: RequestContext): Promise<AccountsOverview> {
  requirePermission(ctx, "receipt.view");
  const db = scoped(ctx);
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);

  const [invoices, receiptTotals, recent] = await Promise.all([
    db.invoice.findMany({
      where: { status: { in: ["ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE"] } },
      orderBy: { dueDate: "asc" },
      select: {
        id: true, number: true, date: true, dueDate: true, status: true,
        total: true, advanceAdjusted: true,
        client: { select: { id: true, name: true, primaryMobile: true } },
        allocations: { select: { amount: true } },
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
        id: true, number: true, date: true, mode: true,
        amount: true, unallocated: true,
        client: { select: { name: true } },
      },
    }),
  ]);

  let invoiced = 0n, outstanding = 0n, overdue = 0n;
  let paidCount = 0, overdueCount = 0;

  const buckets = new Map<AgingBucket["key"], AgingBucket>([
    ["current", { key: "current", label: "Not yet due",       amount: 0n, count: 0 }],
    ["d1_30",   { key: "d1_30",   label: "1–30 days overdue", amount: 0n, count: 0 }],
    ["d31_60",  { key: "d31_60",  label: "31–60 days",        amount: 0n, count: 0 }],
    ["d61_90",  { key: "d61_90",  label: "61–90 days",        amount: 0n, count: 0 }],
    ["d90p",    { key: "d90p",    label: "Over 90 days",      amount: 0n, count: 0 }],
  ]);

  const openRows: OutstandingInvoiceRow[] = [];
  const perClient = new Map<string, OutstandingClientRow>();

  for (const inv of invoices) {
    invoiced += inv.total;
    const paid = inv.allocations.reduce((s, a) => s + a.amount, 0n);
    const open = inv.total - inv.advanceAdjusted - paid;

    if (open <= 0n) { paidCount += 1; continue; }
    outstanding += open;

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
      clientId: inv.client.id, clientName: inv.client.name, clientMobile: inv.client.primaryMobile,
      total: inv.total, paid, outstanding: open,
      status: inv.status,
    });

    const c = perClient.get(inv.client.id);
    if (c) {
      c.invoiceCount += 1;
      c.outstanding  += open;
      if (days > c.oldestDays) c.oldestDays = days;
    } else {
      perClient.set(inv.client.id, {
        clientId: inv.client.id,
        clientName: inv.client.name,
        clientMobile: inv.client.primaryMobile,
        invoiceCount: 1,
        outstanding: open,
        oldestDays: Math.max(0, days),
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

  const received = receiptTotals._sum.amount ?? 0n;
  const onAccount = receiptTotals._sum.unallocated ?? 0n;

  return {
    invoiced,
    received,
    outstanding,
    overdue,
    onAccount,
    invoiceCount: invoices.length,
    paidCount,
    overdueCount,
    aging: [...buckets.values()],
    outstandingInvoices: openRows.slice(0, 25),
    topClients,
    recentReceipts: recent.map((r) => ({
      id: r.id, number: r.number, date: r.date,
      clientName: r.client.name, mode: r.mode,
      amount: r.amount, unallocated: r.unallocated,
    })),
  };
}

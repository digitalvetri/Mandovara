// Reports — aggregation queries.
// All go through db.scoped(ctx). Return shapes are plain objects so the
// pages can render without additional client-side transforms.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

// ── Leads funnel by source ─────────────────────────────────────────
export interface LeadsBySourceRow {
  source:     string;
  total:      number;
  won:        number;
  conversion: number;   // 0..1
}

export async function leadsBySource(ctx: RequestContext): Promise<LeadsBySourceRow[]> {
  requirePermission(ctx, "report.view.sales");
  const db = scoped(ctx);
  const rows = await db.lead.groupBy({
    by: ["source", "stage"],
    _count: { _all: true },
  });
  const map = new Map<string, { total: number; won: number }>();
  for (const r of rows) {
    const s = map.get(r.source) ?? { total: 0, won: 0 };
    s.total += r._count._all;
    if (r.stage === "WON") s.won += r._count._all;
    map.set(r.source, s);
  }
  return [...map.entries()]
    .map(([source, s]) => ({
      source, total: s.total, won: s.won,
      conversion: s.total === 0 ? 0 : s.won / s.total,
    }))
    .sort((a, b) => b.total - a.total);
}

// ── Invoice ageing (outstanding only) ─────────────────────────────
export interface AgeingBucket {
  label:      string;
  fromDays:   number;
  toDays:     number | null;   // null = 90+
  count:      number;
  amount:     bigint;
}

const AGE_BUCKETS: readonly Omit<AgeingBucket, "count" | "amount">[] = [
  { label: "Not yet due", fromDays: -1, toDays: 0    },
  { label: "1–30 days",   fromDays:  1, toDays: 30   },
  { label: "31–60 days",  fromDays: 31, toDays: 60   },
  { label: "61–90 days",  fromDays: 61, toDays: 90   },
  { label: "90+ days",    fromDays: 91, toDays: null },
];

export async function invoiceAgeing(ctx: RequestContext): Promise<AgeingBucket[]> {
  requirePermission(ctx, "report.view.accounts");
  const db = scoped(ctx);
  const rows = await db.invoice.findMany({
    where:  { status: { in: ["ISSUED", "PARTIALLY_PAID"] } },
    select: { total: true, dueDate: true },
    take:   5000,   // hard cap so a runaway page can't OOM
  });
  const now = Date.now();
  const day = 86_400_000;
  const buckets = AGE_BUCKETS.map((b) => ({ ...b, count: 0, amount: 0n }));
  for (const inv of rows) {
    const daysOverdue = Math.floor((now - inv.dueDate.getTime()) / day);
    const idx =
      daysOverdue <= 0                                  ? 0
      : daysOverdue <= 30                               ? 1
      : daysOverdue <= 60                               ? 2
      : daysOverdue <= 90                               ? 3
      :                                                   4;
    buckets[idx]!.count += 1;
    buckets[idx]!.amount += inv.total;
  }
  return buckets;
}

// ── Top clients by revenue (paid + partially paid + issued) ───────
export interface TopClientRow {
  clientId:   string;
  name:       string;
  invoiceCount: number;
  revenue:    bigint;
}

export async function topClientsByRevenue(
  ctx: RequestContext,
  limit: number = 10,
): Promise<TopClientRow[]> {
  requirePermission(ctx, "report.view.sales");
  const db = scoped(ctx);
  const rows = await db.invoice.groupBy({
    by: ["clientId"],
    where: { status: { not: "CANCELLED" } },
    _sum:   { total: true },
    _count: { _all: true },
    orderBy: { _sum: { total: "desc" } },
    take: limit,
  });
  const clients = await db.client.findMany({
    where:  { id: { in: rows.map((r) => r.clientId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(clients.map((c) => [c.id, c.name]));
  return rows.map((r) => ({
    clientId:     r.clientId,
    name:         nameById.get(r.clientId) ?? "(unknown)",
    invoiceCount: r._count._all,
    revenue:      r._sum.total ?? 0n,
  }));
}

// ── Project margin snapshot (top N by order value) ────────────────
export interface ProjectMarginRow {
  projectId:       string;
  number:          string;
  name:            string;
  clientName:      string;
  orderValue:      bigint;
  approvedExpense: bigint;
  margin:          bigint;
  marginPct:       number;    // 0..1 (of orderValue)
}

export async function projectMarginTop(
  ctx: RequestContext,
  limit: number = 10,
): Promise<ProjectMarginRow[]> {
  requirePermission(ctx, "report.view.projects");
  const db = scoped(ctx);
  const projects = await db.project.findMany({
    where: { stage: { not: "CANCELLED" } },
    orderBy: { orderValue: "desc" },
    take: limit,
    select: {
      id: true, number: true, name: true, orderValue: true,
      client:   { select: { name: true } },
      expenses: {
        where: { approvalState: "APPROVED" },
        select: { amount: true },
      },
    },
  });
  return projects.map((p) => {
    const approvedExpense = p.expenses.reduce((s, e) => s + e.amount, 0n);
    const margin = p.orderValue - approvedExpense;
    const marginPct = p.orderValue === 0n
      ? 0
      : Number((margin * 10_000n) / p.orderValue) / 10_000;
    return {
      projectId:  p.id,
      number:     p.number,
      name:       p.name,
      clientName: p.client.name,
      orderValue: p.orderValue,
      approvedExpense,
      margin,
      marginPct,
    };
  });
}
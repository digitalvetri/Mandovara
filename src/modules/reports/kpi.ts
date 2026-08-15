// Top-line KPI snapshot for the Reports dashboard.
// Accepts an optional date range — outstanding is always current-state, not period-filtered.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface ReportKpis {
  revenue:        bigint;   // invoice taxableAmount, non-cancelled, in period
  collections:    bigint;   // receipts received, in period
  outstanding:    bigint;   // invoices ISSUED + PARTIALLY_PAID (always current)
  activeProjects: number;   // not COMPLETED / CANCELLED (always current)
  newLeads:       number;   // leads created in period
  readyToInstall: number;   // orders with status READY_TO_INSTALL (always current)
}

export async function getReportKpis(
  ctx: RequestContext,
  opts: { from?: Date; to?: Date } = {},
): Promise<ReportKpis> {
  requirePermission(ctx, "report.view.sales");
  const db = scoped(ctx);

  const df: { gte?: Date; lte?: Date } = {};
  if (opts.from) df.gte = opts.from;
  if (opts.to)   df.lte = opts.to;
  const hasDf = !!(opts.from || opts.to);

  const [rev, coll, out, active, leads, rti] = await Promise.all([
    db.invoice.aggregate({
      where: { status: { not: "CANCELLED" }, ...(hasDf && { date: df }) },
      _sum: { taxableAmount: true },
    }),
    db.receipt.aggregate({
      where: { ...(hasDf && { date: df }) },
      _sum: { amount: true },
    }),
    db.invoice.aggregate({
      where: { status: { in: ["ISSUED", "PARTIALLY_PAID"] } },
      _sum: { total: true },
    }),
    db.project.count({
      where: { stage: { notIn: ["COMPLETED", "CANCELLED"] } },
    }),
    db.lead.count({ where: { ...(hasDf && { createdAt: df }) } }),
    db.order.count({ where: { status: "READY_TO_INSTALL" } }),
  ]);

  return {
    revenue:        rev._sum.taxableAmount  ?? 0n,
    collections:    coll._sum.amount        ?? 0n,
    outstanding:    out._sum.total          ?? 0n,
    activeProjects: active,
    newLeads:       leads,
    readyToInstall: rti,
  };
}

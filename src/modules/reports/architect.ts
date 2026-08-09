// Architect-wise revenue and commission report.
// Revenue = Σ Invoice.taxableAmount for projects referred by this architect.
// Commission = Σ ArchitectCommission.amount (paid vs total).

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface ArchitectReportRow {
  architectId:       string;
  firmName:          string;
  contactName:       string;
  mobile:            string;
  commissionPct:     string;   // e.g. "5.00"
  projectCount:      number;
  revenue:           bigint;
  commissionTotal:   bigint;
  commissionPaid:    bigint;
  commissionPending: bigint;
}

export async function listArchitectReport(
  ctx: RequestContext,
): Promise<ArchitectReportRow[]> {
  requirePermission(ctx, "report.view.projects");
  const db = scoped(ctx);

  const [architects, projects, invoices, commissions] = await Promise.all([
    db.architect.findMany({
      where:   { organizationId: ctx.orgId, isActive: true },
      select:  { id: true, firmName: true, contactName: true, mobile: true, commissionPct: true },
      orderBy: { firmName: "asc" },
    }),
    db.project.findMany({
      where:  { organizationId: ctx.orgId, architectId: { not: null } },
      select: { id: true, architectId: true },
    }),
    db.invoice.findMany({
      where:  { organizationId: ctx.orgId, status: { not: "CANCELLED" }, projectId: { not: null } },
      select: { projectId: true, taxableAmount: true },
    }),
    db.architectCommission.findMany({
      where:  { organizationId: ctx.orgId },
      select: { architectId: true, amount: true, paidAt: true },
    }),
  ]);

  // Index: projectId → architectId
  const projArch = new Map<string, string>();
  for (const p of projects) {
    if (p.architectId) projArch.set(p.id, p.architectId);
  }

  // Revenue by architectId
  const revenueByArch = new Map<string, bigint>();
  for (const inv of invoices) {
    if (!inv.projectId) continue;
    const aid = projArch.get(inv.projectId);
    if (!aid) continue;
    revenueByArch.set(aid, (revenueByArch.get(aid) ?? 0n) + inv.taxableAmount);
  }

  // Project count by architectId
  const projectCountByArch = new Map<string, number>();
  for (const [, aid] of projArch) {
    projectCountByArch.set(aid, (projectCountByArch.get(aid) ?? 0) + 1);
  }

  // Commission totals
  const commTotalByArch = new Map<string, bigint>();
  const commPaidByArch  = new Map<string, bigint>();
  for (const c of commissions) {
    commTotalByArch.set(c.architectId, (commTotalByArch.get(c.architectId) ?? 0n) + c.amount);
    if (c.paidAt) {
      commPaidByArch.set(c.architectId, (commPaidByArch.get(c.architectId) ?? 0n) + c.amount);
    }
  }

  return architects.map((a) => {
    const total   = commTotalByArch.get(a.id) ?? 0n;
    const paid    = commPaidByArch.get(a.id) ?? 0n;
    return {
      architectId:       a.id,
      firmName:          a.firmName,
      contactName:       a.contactName,
      mobile:            a.mobile,
      commissionPct:     a.commissionPct.toString(),
      projectCount:      projectCountByArch.get(a.id) ?? 0,
      revenue:           revenueByArch.get(a.id) ?? 0n,
      commissionTotal:   total,
      commissionPaid:    paid,
      commissionPending: total - paid,
    };
  });
}

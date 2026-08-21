// Split out of queries.ts to stay under the §10 300-line limit.

// Dashboard repository. All reads go through db.scoped(ctx) per Rule 1.
// The page consumes loadDashboard(ctx) and knows nothing about Prisma.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import type { DashboardData } from "@/app/(app)/_dashboard/types";
import { ACTIVE_PROJECT_STAGES, OPEN_LEAD_STAGES } from "./queries";
import { addDays, endOfMonth, loadProjectStages, loadRecentActivity, loadRevenueByMonth, loadSiteVisits, percentChange, startOfMonth, sumInvoices } from "./queries-part2-loaders";

export async function loadDashboard(ctx: RequestContext): Promise<DashboardData> {
  requirePermission(ctx, "report.view.dashboard");
  const db = scoped(ctx);
  const now = new Date();
  const monthStart = startOfMonth(now, 0);
  const prevMonthStart = startOfMonth(now, -1);

  const [
    revThisMonth, revLastMonth,
    activeProjects, projectsNewThisMonth, projectsInstall,
    openLeads, leadsNewThisWeek, leadsAwaitingQuote,
    overdueAgg, overdueCount, overdueClients,
    revenueByMonth, projectStages,
    siteVisits, activity,
  ] = await Promise.all([
    sumInvoices(db, monthStart, endOfMonth(monthStart)),
    sumInvoices(db, prevMonthStart, monthStart),

    db.project.count({ where: { stage: { in: [...ACTIVE_PROJECT_STAGES] } } }),
    db.project.count({
      where: { stage: { in: [...ACTIVE_PROJECT_STAGES] }, createdAt: { gte: monthStart } },
    }),
    db.project.count({
      where: { stage: "MAKE", expectedInstallAt: { gte: now, lte: addDays(now, 30) } },
    }),

    db.lead.count({ where: { stage: { in: [...OPEN_LEAD_STAGES] } } }),
    db.lead.count({ where: { createdAt: { gte: addDays(now, -7) } } }),
    db.lead.count({ where: { stage: { in: ["QUOTED", "NEGOTIATION"] } } }),

    // Overdue = ISSUED or PARTIALLY_PAID with dueDate in the past
    db.invoice.aggregate({
      where: { status: { in: ["ISSUED", "PARTIALLY_PAID"] }, dueDate: { lt: now } },
      _sum: { total: true },
    }),
    db.invoice.count({
      where: { status: { in: ["ISSUED", "PARTIALLY_PAID"] }, dueDate: { lt: now } },
    }),
    db.invoice.groupBy({
      by: ["clientId"],
      where: { status: { in: ["ISSUED", "PARTIALLY_PAID"] }, dueDate: { lt: now } },
    }),

    loadRevenueByMonth(db, now),
    loadProjectStages(db),
    loadSiteVisits(db, now),
    loadRecentActivity(db),
  ]);

  const revenueMtd = revThisMonth;
  const revenueMtdPrev = revLastMonth;
  const revenueMtdTrendPct = percentChange(revenueMtd, revenueMtdPrev);

  return {
    revenueMtd,
    revenueMtdPrev,
    revenueMtdTrendPct,

    activeProjects,
    activeProjectsDelta: projectsNewThisMonth,
    activeProjectsHandover: projectsInstall,

    openLeads,
    openLeadsDelta: leadsNewThisWeek,
    openLeadsAwaitingQuote: leadsAwaitingQuote,

    overdueInvoices: overdueAgg._sum.total ?? 0n,
    overdueInvoicesCount: overdueCount,
    overdueBadge: overdueClients.length,

    revenueByMonth,
    projectStages,
    siteVisits,
    activity,
  };
}

export * from "./queries-part2-loaders";

// Split out of queries.ts to stay under the §10 300-line limit.

// Dashboard repository. All reads go through db.scoped(ctx) per Rule 1.
// The page consumes loadDashboard(ctx) and knows nothing about Prisma.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import type { DashboardData, TeamAssignmentRow } from "@/app/(app)/_dashboard/types";
import { ACTIVE_PROJECT_STAGES, LIVE_STAGES, OPEN_LEAD_STAGES, TEAM_PROJECTS_PREVIEW } from "./queries";
import { Db, addDays, endOfMonth, loadProjectStages, loadRecentActivity, loadRevenueByMonth, loadSiteVisits, percentChange, startOfMonth, sumInvoices } from "./queries-part2-loaders";

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
    teamAssignments,
  ] = await Promise.all([
    sumInvoices(db, monthStart, endOfMonth(monthStart)),
    sumInvoices(db, prevMonthStart, monthStart),

    db.project.count({ where: { stage: { in: [...ACTIVE_PROJECT_STAGES] } } }),
    db.project.count({
      where: { stage: { in: [...ACTIVE_PROJECT_STAGES] }, createdAt: { gte: monthStart } },
    }),
    db.project.count({
      where: { stage: "INSTALLATION", expectedInstallAt: { gte: now, lte: addDays(now, 30) } },
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
    loadTeamAssignments(db),
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
    teamAssignments,
  };
}

async function loadTeamAssignments(db: Db): Promise<TeamAssignmentRow[]> {
  // Live projects only — completed/cancelled work isn't a "load".
  const projects = await db.project.findMany({
    where:   { stage: { in: [...LIVE_STAGES] } },
    orderBy: [{ createdAt: "desc" }],
    select:  { id: true, number: true, name: true, stage: true, ownerId: true },
  });
  if (projects.length === 0) return [];

  const ownerIds = [...new Set(projects.map((p) => p.ownerId).filter(Boolean))];
  const users = ownerIds.length
    ? await db.user.findMany({
        where:  { id: { in: ownerIds } },
        select: { id: true, name: true, role: true },
      })
    : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  const byOwner = new Map<string, TeamAssignmentRow>();
  for (const p of projects) {
    const u = userById.get(p.ownerId);
    if (!u) continue;
    const row = byOwner.get(u.id) ?? {
      userId:      u.id,
      userName:    u.name,
      role:        u.role,
      activeCount: 0,
      projects:    [],
    };
    row.activeCount += 1;
    if (row.projects.length < TEAM_PROJECTS_PREVIEW) {
      row.projects.push({ id: p.id, number: p.number, name: p.name, stage: p.stage });
    }
    byOwner.set(u.id, row);
  }

  return Array.from(byOwner.values()).sort((a, b) => b.activeCount - a.activeCount);
}

export * from "./queries-part2-loaders";

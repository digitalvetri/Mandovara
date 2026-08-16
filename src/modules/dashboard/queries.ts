// Dashboard repository. All reads go through db.scoped(ctx) per Rule 1.
// The page consumes loadDashboard(ctx) and knows nothing about Prisma.

import { scoped } from "@/kernel/db/scoped";
import type { RequestContext } from "@/kernel/auth/context";
import type {
  ActivityItem, DashboardData, ProjectStage, RevenueMonth, SiteVisit,
  TeamAssignmentRow,
} from "@/app/(app)/_dashboard/types";

// Valid InvoiceStatus values that count toward revenue
const REV_STATUSES = ["ISSUED", "PARTIALLY_PAID", "PAID"] as const;

// Open LeadStage values — excludes WON and LOST
const OPEN_LEAD_STAGES = [
  "NEW", "CONTACTED", "MEASUREMENT_SCHEDULED", "MEASURED", "QUOTED", "NEGOTIATION",
] as const;

// Active ProjectStage values — post-order, real work underway
const ACTIVE_PROJECT_STAGES = [
  "ORDERED", "PROCUREMENT", "MAKE", "INSTALLATION", "SNAGGING",
] as const;

const MONTHS_LOOKBACK = 8;
const RECENT_ACTIVITY_LIMIT = 3;
const SITE_VISITS_LIMIT = 3;
const TEAM_PROJECTS_PREVIEW = 4;         // projects shown inline per member
// Live-work stages: anything from first visit through snagging counts
// as "in flight" for owner-load purposes. COMPLETED / CANCELLED drop off.
const LIVE_STAGES = [
  "ENQUIRY", "SITE_VISIT", "MEASUREMENT", "QUOTATION",
  "ORDERED", "PROCUREMENT", "MAKE", "INSTALLATION", "SNAGGING",
] as const;

export async function loadDashboard(ctx: RequestContext): Promise<DashboardData> {
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

// ── field-specific loaders ────────────────────────────────────────────────────

type Db = ReturnType<typeof scoped>;

async function sumInvoices(db: Db, from: Date, to: Date): Promise<bigint> {
  const agg = await db.invoice.aggregate({
    where: { status: { in: [...REV_STATUSES] }, date: { gte: from, lt: to } },
    _sum: { total: true },
  });
  return agg._sum.total ?? 0n;
}

async function loadRevenueByMonth(db: Db, now: Date): Promise<RevenueMonth[]> {
  const months: RevenueMonth[] = [];
  for (let i = MONTHS_LOOKBACK - 1; i >= 0; i--) {
    const from = startOfMonth(now, -i);
    const to = endOfMonth(from);
    const total = await sumInvoices(db, from, to);
    months.push({
      label: from.toLocaleDateString("en-IN", { month: "short", timeZone: "Asia/Kolkata" }),
      lakhs: Number(total / 100n) / 100_000,
    });
  }
  return months;
}

async function loadProjectStages(db: Db): Promise<ProjectStage[]> {
  const [enquiry, measurement, quotation, production, installation] = await Promise.all([
    db.project.count({ where: { stage: "ENQUIRY" } }),
    db.project.count({ where: { stage: "MEASUREMENT" } }),
    db.project.count({ where: { stage: "QUOTATION" } }),
    db.project.count({ where: { stage: { in: ["ORDERED", "PROCUREMENT", "MAKE"] } } }),
    db.project.count({ where: { stage: { in: ["INSTALLATION", "SNAGGING"] } } }),
  ]);
  return [
    { name: "Enquiry",      count: enquiry },
    { name: "Measurement",  count: measurement },
    { name: "Quotation",    count: quotation },
    { name: "Production",   count: production },
    { name: "Installation", count: installation },
  ];
}

async function loadSiteVisits(db: Db, now: Date): Promise<SiteVisit[]> {
  // Upcoming install visits scheduled within the next 30 days
  const visits = await db.installVisit.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { gte: now, lte: addDays(now, 30) },
    },
    orderBy: { scheduledAt: "asc" },
    take: SITE_VISITS_LIMIT,
    include: {
      project: {
        select: {
          name: true,
          siteAddress: true,
          client: { select: { name: true } },
        },
      },
    },
  });
  return visits.map((v, i) => {
    const d = v.scheduledAt;
    const kinds = ["Installation", "Site survey", "Measurement"] as const;
    const addr = v.project.siteAddress as { city?: string } | null;
    return {
      id: v.id,
      day: String(d.getDate()).padStart(2, "0"),
      month: d.toLocaleDateString("en-IN", { month: "short", timeZone: "Asia/Kolkata" }).toUpperCase(),
      name: v.project.name,
      meta: `${kinds[i % kinds.length]} · ${["10:30 AM", "2:00 PM", "11:00 AM"][i % 3]}`,
      owner: addr?.city ?? "Coimbatore",
    };
  });
}

async function loadRecentActivity(db: Db): Promise<ActivityItem[]> {
  // Quotation → client name via project (Receipt has no direct client relation in schema)
  const [quotes, receipts, leads] = await Promise.all([
    db.quotation.findMany({
      where: { status: { in: ["SENT", "REVISED"] } },
      orderBy: { sentAt: "desc" },
      take: 3,
      include: {
        project: { include: { client: { select: { name: true } } } },
      },
    }),
    db.receipt.findMany({
      orderBy: { date: "desc" },
      take: 3,
    }),
    db.lead.findMany({
      where: { stage: "NEW" },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
  ]);

  // Resolve client names for receipts via a secondary lookup
  const rcptClientIds = [...new Set(receipts.map((r) => r.clientId))];
  const rcptClients = rcptClientIds.length
    ? await db.client.findMany({
        where: { id: { in: rcptClientIds } },
        select: { id: true, name: true },
      })
    : [];
  const clientName = new Map(rcptClients.map((c) => [c.id, c.name]));

  const now = Date.now();
  const events: (ActivityItem & { at: number })[] = [];

  for (const q of quotes) {
    const ts = q.sentAt ?? q.date;
    // Lead-scoped quotations have no project — label the party generically
    // until the dashboard grows a lead-party lookup.
    const recipient = q.project?.client.name ?? "a lead";
    events.push({
      id: `q-${q.id}`, kind: "quote",
      title: `Quote ${q.number.split("/").pop() ?? q.number} sent to ${recipient}`,
      when: relTime(now - ts.getTime()),
      at: ts.getTime(),
    });
  }
  for (const r of receipts) {
    events.push({
      id: `r-${r.id}`, kind: "payment",
      title: `Payment received – ${clientName.get(r.clientId) ?? "Client"} ${formatRupeesShort(r.amount)}`,
      when: relTime(now - r.date.getTime()),
      at: r.date.getTime(),
    });
  }
  for (const l of leads) {
    events.push({
      id: `l-${l.id}`, kind: "lead",
      title: `New lead: ${l.name}${l.requirement ? ` – ${l.requirement}` : ""}`,
      when: relTime(now - l.createdAt.getTime()),
      at: l.createdAt.getTime(),
    });
  }

  events.sort((a, b) => b.at - a.at);
  return events.slice(0, RECENT_ACTIVITY_LIMIT).map((e) => ({
    id: e.id, kind: e.kind, title: e.title, when: e.when,
  }));
}

// ── small helpers (dashboard-local) ──────────────────────────────────────────

function startOfMonth(base: Date, offset: number): Date {
  return new Date(base.getFullYear(), base.getMonth() + offset, 1);
}
function endOfMonth(monthStart: Date): Date {
  return new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
}
function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}
function percentChange(current: bigint, previous: bigint): number {
  if (previous === 0n) return current > 0n ? 100 : 0;
  const diff = Number(((current - previous) * 100n) / previous);
  return Math.round(diff);
}
function formatRupeesShort(paise: bigint): string {
  const rupees = Number(paise / 100n);
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(1)}Cr`;
  if (rupees >= 100_000)    return `₹${(rupees / 100_000).toFixed(1)}L`;
  if (rupees >= 1_000)      return `₹${(rupees / 1_000).toFixed(1)}k`;
  return `₹${rupees}`;
}
function relTime(deltaMs: number): string {
  const mins = Math.max(0, Math.floor(deltaMs / 60_000));
  if (mins < 60)  return `${mins} minutes ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30)  return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

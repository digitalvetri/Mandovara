// Dashboard repository. All reads go through db.scoped(ctx) per Rule 1.
// The page consumes loadDashboard(ctx) and knows nothing about Prisma.

import { scoped } from "@/kernel/db/scoped";
import type { RequestContext } from "@/kernel/auth/context";
import type {
  ActivityItem, DashboardData, ProjectStage, RevenueMonth, SiteVisit,
  OperationsKpi,
} from "@/app/(app)/_dashboard/types";

const REV_STATUSES = ["ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE"] as const;
const OPEN_LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSED", "NEGOTIATION"] as const;

const MONTHS_LOOKBACK = 8;
const RECENT_ACTIVITY_LIMIT = 3;
const SITE_VISITS_LIMIT = 3;

export async function loadDashboard(ctx: RequestContext): Promise<DashboardData> {
  const db = scoped(ctx);
  const now = new Date();
  const monthStart = startOfMonth(now, 0);
  const prevMonthStart = startOfMonth(now, -1);

  const [
    revThisMonth, revLastMonth,
    activeProjects, projectsNewThisMonth, projectsHandover,
    openLeads, leadsNewThisWeek, leadsAwaiting,
    overdueAgg, overdueCount, overdueClients,
    revenueByMonth, projectStages,
    siteVisits, activity,
  ] = await Promise.all([
    sumInvoices(db, monthStart, endOfMonth(monthStart)),
    sumInvoices(db, prevMonthStart, monthStart),

    db.project.count({ where: { status: "ACTIVE" } }),
    db.project.count({ where: { status: "ACTIVE", createdAt: { gte: monthStart } } }),
    db.project.count({
      where: {
        status: "ACTIVE",
        targetEndDate: { gte: now, lte: addDays(now, 30) },
      },
    }),

    db.lead.count({ where: { status: { in: [...OPEN_LEAD_STATUSES] } } }),
    db.lead.count({ where: { createdAt: { gte: addDays(now, -7) } } }),
    db.lead.count({ where: { status: { in: ["QUALIFIED", "PROPOSED"] } } }),

    db.invoice.aggregate({
      where: { status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] }, dueDate: { lt: now } },
      _sum: { total: true },
    }),
    db.invoice.count({
      where: { status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] }, dueDate: { lt: now } },
    }),
    db.invoice.groupBy({
      by: ["clientId"],
      where: { status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] }, dueDate: { lt: now } },
    }),

    loadRevenueByMonth(db, now),
    loadProjectStages(db),

    loadSiteVisits(db, now),
    loadRecentActivity(db),
  ]);

  // Phase 8b — operations KPIs after the base fan-out.
  const operations = await loadOperationsKpi(db, now);

  const revenueMtd = revThisMonth;
  const revenueMtdPrev = revLastMonth;
  const revenueMtdTrendPct = percentChange(revenueMtd, revenueMtdPrev);

  return {
    revenueMtd,
    revenueMtdPrev,
    revenueMtdTrendPct,

    activeProjects,
    activeProjectsDelta: projectsNewThisMonth,
    activeProjectsHandover: projectsHandover,

    openLeads,
    openLeadsDelta: leadsNewThisWeek,
    openLeadsAwaitingQuote: leadsAwaiting,

    overdueInvoices: overdueAgg._sum.total ?? 0n,
    overdueInvoicesCount: overdueCount,
    overdueBadge: overdueClients.length,

    operations,

    revenueByMonth,
    projectStages,
    siteVisits,
    activity,
  };
}

// ── field-specific loaders ───────────────────────────────────────

type Db = ReturnType<typeof scoped>;

// Live counts from make / install / commissions / payroll so the
// owner sees today's studio state without navigating out.
async function loadOperationsKpi(db: Db, now: Date): Promise<OperationsKpi> {
  const in7Days = new Date(now); in7Days.setDate(now.getDate() + 7);

  const [
    makeStatusCounts,
    installsThisWeek,
    commAgg,
    commCount,
    latestPayroll,
  ] = await Promise.all([
    db.makeJob.groupBy({
      by:     ["status"],
      where:  { status: { not: "DELIVERED" } },
      _count: { _all: true },
    }),
    db.installVisit.count({
      where: {
        scheduledAt: { gte: now, lte: in7Days },
        status:      { in: ["SCHEDULED", "IN_PROGRESS"] },
      },
    }),
    db.architectCommission.aggregate({
      where: { paidAt: null, cancelledAt: null },
      _sum:  { amount: true },
    }),
    db.architectCommission.count({
      where: { paidAt: null, cancelledAt: null },
    }),
    db.payrollRun.findFirst({
      orderBy: [{ year: "desc" }, { month: "desc" }],
      select:  { id: true, month: true, year: true, status: true, totalPayable: true },
    }),
  ]);

  const byStatus = new Map(makeStatusCounts.map((r) => [r.status, r._count._all]));
  const makeInProgressCount =
    (byStatus.get("CUTTING")   ?? 0) +
    (byStatus.get("STITCHING") ?? 0) +
    (byStatus.get("FINISHING") ?? 0) +
    (byStatus.get("QC")        ?? 0);

  const monthLabels = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  return {
    makeQueuedCount:     byStatus.get("QUEUED") ?? 0,
    makeInProgressCount,
    makeReadyCount:      byStatus.get("READY") ?? 0,
    installVisitsThisWeek: installsThisWeek,
    commissionsOutstanding: commAgg._sum.amount ?? 0n,
    commissionsCount:      commCount,
    ...(latestPayroll && {
      latestPayrollPeriod: `${monthLabels[latestPayroll.month - 1]} ${latestPayroll.year}`,
      latestPayrollTotal:  latestPayroll.totalPayable,
      latestPayrollStatus: latestPayroll.status,
      latestPayrollRunId:  latestPayroll.id,
    }),
  };
}

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
  const [leadNew, projPlanning, quotDraftSent, projActive, projOnHold] = await Promise.all([
    db.lead.count({ where: { status: { in: ["NEW", "CONTACTED"] } } }),
    db.project.count({ where: { status: "PLANNING" } }),
    db.quotation.count({ where: { status: { in: ["DRAFT", "SENT", "VIEWED"] } } }),
    db.project.count({ where: { status: "ACTIVE" } }),
    db.project.count({ where: { status: "ON_HOLD" } }),
  ]);
  return [
    { name: "Enquiry",      count: leadNew },
    { name: "Measurement",  count: projPlanning },
    { name: "Quotation",    count: quotDraftSent },
    { name: "Production",   count: projActive },
    { name: "Installation", count: projOnHold },
  ];
}

async function loadSiteVisits(db: Db, now: Date): Promise<SiteVisit[]> {
  const projects = await db.project.findMany({
    where: { status: "ACTIVE", targetEndDate: { gte: now } },
    orderBy: { targetEndDate: "asc" },
    take: SITE_VISITS_LIMIT,
    include: { client: { include: { addresses: { take: 1 } } } },
  });
  return projects.map((p, i) => {
    const d = p.targetEndDate ?? p.startDate;
    const kinds = ["Measurement", "Installation", "Site survey"] as const;
    return {
      id: p.id,
      day: String(d.getDate()).padStart(2, "0"),
      month: d.toLocaleDateString("en-IN", { month: "short", timeZone: "Asia/Kolkata" }).toUpperCase(),
      name: p.name,
      meta: `${kinds[i % kinds.length]} · ${["10:30 AM", "2:00 PM", "11:00 AM"][i % 3]}`,
      owner: p.client.addresses[0]?.city ?? "Coimbatore",
    };
  });
}

async function loadRecentActivity(db: Db): Promise<ActivityItem[]> {
  const [quotes, receipts, leads] = await Promise.all([
    db.quotation.findMany({
      where: { status: { in: ["SENT", "VIEWED"] } },
      orderBy: { updatedAt: "desc" },
      take: 3,
      include: { client: { select: { name: true } } },
    }),
    db.receipt.findMany({
      orderBy: { date: "desc" },
      take: 3,
      include: { client: { select: { name: true } } },
    }),
    db.lead.findMany({
      where: { status: "NEW" },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
  ]);

  const now = Date.now();
  const events: (ActivityItem & { at: number })[] = [];

  for (const q of quotes) {
    events.push({
      id: `q-${q.id}`, kind: "quote",
      title: `Quote ${q.number.split("/").pop() ?? q.number} sent to ${q.client.name}`,
      when: relTime(now - q.updatedAt.getTime()),
      at: q.updatedAt.getTime(),
    });
  }
  for (const r of receipts) {
    events.push({
      id: `r-${r.id}`, kind: "payment",
      title: `Payment received — ${r.client.name} ${formatRupeesShort(r.amount)}`,
      when: relTime(now - r.date.getTime()),
      at: r.date.getTime(),
    });
  }
  for (const l of leads) {
    events.push({
      id: `l-${l.id}`, kind: "lead",
      title: `New lead: ${l.name}${l.requirement ? ` — ${l.requirement}` : ""}`,
      when: relTime(now - l.createdAt.getTime()),
      at: l.createdAt.getTime(),
    });
  }

  events.sort((a, b) => b.at - a.at);
  return events.slice(0, RECENT_ACTIVITY_LIMIT).map((e) => ({
    id: e.id, kind: e.kind, title: e.title, when: e.when,
  }));
}

// ── small helpers (dashboard-local) ──────────────────────────────

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

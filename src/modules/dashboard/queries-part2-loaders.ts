// Field-specific dashboard loaders.

// Split out of queries.ts to stay under the §10 300-line limit.

// Dashboard repository. All reads go through db.scoped(ctx) per Rule 1.
// The page consumes loadDashboard(ctx) and knows nothing about Prisma.

import { scoped } from "@/kernel/db/scoped";
import type { ActivityItem, ProjectStage, RevenueMonth, SiteVisit } from "@/app/(app)/_dashboard/types";
import { MONTHS_LOOKBACK, RECENT_ACTIVITY_LIMIT, REV_STATUSES, SITE_VISITS_LIMIT } from "./queries";

// ── field-specific loaders ────────────────────────────────────────────────────

export type Db = ReturnType<typeof scoped>;

export async function sumInvoices(db: Db, from: Date, to: Date): Promise<bigint> {
  const agg = await db.invoice.aggregate({
    where: { status: { in: [...REV_STATUSES] }, date: { gte: from, lt: to } },
    _sum: { total: true },
  });
  return agg._sum.total ?? 0n;
}

export async function loadRevenueByMonth(db: Db, now: Date): Promise<RevenueMonth[]> {
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

export async function loadProjectStages(db: Db): Promise<ProjectStage[]> {
  const [enquiry, measurement, quotation, production] = await Promise.all([
    db.project.count({ where: { stage: "ENQUIRY" } }),
    db.project.count({ where: { stage: "MEASUREMENT" } }),
    db.project.count({ where: { stage: "QUOTATION" } }),
    db.project.count({ where: { stage: { in: ["ORDERED", "PROCUREMENT", "MAKE"] } } }),
  ]);
  return [
    { name: "Enquiry",      count: enquiry },
    { name: "Measurement",  count: measurement },
    { name: "Quotation",    count: quotation },
    { name: "Production",   count: production },
  ];
}

export async function loadSiteVisits(db: Db, now: Date): Promise<SiteVisit[]> {
  const SELECT = {
    id: true, scheduledAt: true, purpose: true, status: true, assignedToId: true,
    project: { select: { name: true } },
  } as const;

  const [overdue, upcoming] = await Promise.all([
    // Past scheduledAt and still SCHEDULED → missed / no update yet
    db.siteVisit.findMany({
      where: { status: "SCHEDULED", scheduledAt: { lt: now } },
      orderBy: { scheduledAt: "desc" },
      take: 5,
      select: SELECT,
    }),
    // Coming up in the next 14 days
    db.siteVisit.findMany({
      where: {
        status: { in: ["SCHEDULED", "IN_PROGRESS"] },
        scheduledAt: { gte: now, lte: addDays(now, 14) },
      },
      orderBy: { scheduledAt: "asc" },
      take: SITE_VISITS_LIMIT,
      select: SELECT,
    }),
  ]);

  const all = [...overdue, ...upcoming];
  const userIds = [...new Set(all.map((v) => v.assignedToId))];
  const users = userIds.length
    ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  const PURPOSE_SHORT: Record<string, string> = {
    INITIAL_SURVEY: "Initial Survey", MEASUREMENT: "Measurement",
    SAMPLE_SHOWING: "Sample Showing", SUPERVISION: "Supervision",
    SNAG_FIX: "Snag Fix", HANDOVER: "Handover",
  };

  function toRow(v: (typeof all)[number], isOverdue: boolean): SiteVisit {
    const d = v.scheduledAt;
    const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
    return {
      id:        v.id,
      day:       String(d.getDate()).padStart(2, "0"),
      month:     d.toLocaleDateString("en-IN", { month: "short", timeZone: "Asia/Kolkata" }).toUpperCase(),
      name:      v.project?.name ?? "Site visit",
      meta:      `${PURPOSE_SHORT[v.purpose] ?? v.purpose} · ${time}`,
      assignee:  nameById.get(v.assignedToId) ?? "—",
      status:    v.status,
      isOverdue,
    };
  }

  return [
    ...overdue.map((v) => toRow(v, true)),
    ...upcoming.map((v) => toRow(v, false)),
  ];
}

export async function loadRecentActivity(db: Db): Promise<ActivityItem[]> {
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

export function startOfMonth(base: Date, offset: number): Date {
  return new Date(base.getFullYear(), base.getMonth() + offset, 1);
}
export function endOfMonth(monthStart: Date): Date {
  return new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
}
export function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}
export function percentChange(current: bigint, previous: bigint): number {
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

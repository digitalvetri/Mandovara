// Notifications — read side. Derived from FollowUp records + upcoming
// SiteVisit records assigned to the current user.
// FollowUps: completedAt = null → unread; completedAt set → read.
// SiteVisits: always "unread" (SCHEDULED/IN_PROGRESS) until the visit completes.

import { scoped } from "@/kernel/db/scoped";
import type { RequestContext } from "@/kernel/auth/context";

export interface NotificationRow {
  id:         string;
  kind:       "followup" | "sitevisit";
  level:      string;
  title:      string;
  body:       string | null;
  entityType: string | null;
  entityId:   string | null;
  readAt:     Date | null;
  createdAt:  Date;
}

export type NotificationFilter = "ALL" | "UNREAD" | "READ";

export interface ListNotificationsQuery {
  filter?:   NotificationFilter;
  page?:     number;
  pageSize?: number;
}

export interface ListNotificationsResult {
  rows:     NotificationRow[];
  total:    number;
  page:     number;
  pageSize: number;
  counts:   { all: number; unread: number; read: number };
}

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE     = 100;

const PURPOSE_LABEL: Record<string, string> = {
  INITIAL_SURVEY: "Initial Survey",
  MEASUREMENT:    "Measurement",
  SAMPLE_SHOWING: "Sample Showing",
  SUPERVISION:    "Supervision",
  SNAG_FIX:       "Snag Fix",
  HANDOVER:       "Handover",
};

function followUpToRow(f: {
  id: string; note: string; outcome: string | null;
  refType: string; refId: string; dueAt: Date; completedAt: Date | null;
}): NotificationRow {
  const now = new Date();
  const level = !f.completedAt && f.dueAt < now ? "WARN" : "INFO";
  return {
    id:         f.id,
    kind:       "followup",
    level,
    title:      f.note,
    body:       f.outcome,
    entityType: f.refType || null,
    entityId:   f.refId   || null,
    readAt:     f.completedAt,
    createdAt:  f.dueAt,
  };
}

function siteVisitToRow(v: {
  id: string; scheduledAt: Date; purpose: string;
  leadId: string | null; projectId: string | null;
  refLabel?: string;
}): NotificationRow {
  const now = new Date();
  return {
    id:         v.id,
    kind:       "sitevisit",
    level:      v.scheduledAt < now ? "WARN" : "VISIT",
    title:      `${PURPOSE_LABEL[v.purpose] ?? v.purpose} · Site Visit`,
    body:       v.refLabel ?? null,
    entityType: v.leadId ? "LEAD" : (v.projectId ? "PROJECT" : null),
    entityId:   v.leadId ?? v.projectId ?? null,
    readAt:     null,   // site visits are always unread until they are completed
    createdAt:  v.scheduledAt,
  };
}

// Resolve lead/project display names for a list of site visits
async function resolveVisitLabels(
  db: ReturnType<typeof scoped>,
  visits: { id: string; scheduledAt: Date; purpose: string; leadId: string | null; projectId: string | null }[],
): Promise<NotificationRow[]> {
  if (visits.length === 0) return [];

  const leadIds = visits.filter(v => v.leadId).map(v => v.leadId!);
  const projIds = visits.filter(v => v.projectId).map(v => v.projectId!);

  const [leads, projects] = await Promise.all([
    leadIds.length ? db.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, name: true } })    : [],
    projIds.length ? db.project.findMany({ where: { id: { in: projIds } }, select: { id: true, name: true } }) : [],
  ]);

  const labelMap = new Map<string, string>();
  for (const l of leads)   labelMap.set(l.id, l.name);
  for (const p of projects) labelMap.set(p.id, p.name);

  return visits.map(v => siteVisitToRow({
    ...v,
    refLabel: labelMap.get((v.leadId ?? v.projectId) as string),
  }));
}

export async function listRecentNotifications(
  ctx: RequestContext,
  limit = 20,
): Promise<NotificationRow[]> {
  const db = scoped(ctx);

  const [fuRows, svRows] = await Promise.all([
    db.followUp.findMany({
      where:   { ownerId: ctx.userId },
      orderBy: { dueAt: "desc" },
      take:    Math.min(limit, 50),
      select:  { id: true, note: true, outcome: true, refType: true, refId: true, dueAt: true, completedAt: true },
    }),
    db.siteVisit.findMany({
      where:   { assignedToId: ctx.userId, status: { in: ["SCHEDULED", "IN_PROGRESS"] } },
      orderBy: { scheduledAt: "asc" },
      take:    20,
      select:  { id: true, scheduledAt: true, purpose: true, leadId: true, projectId: true },
    }),
  ]);

  const visitNotifs = await resolveVisitLabels(db, svRows);

  return [...fuRows.map(followUpToRow), ...visitNotifs]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

export async function countUnreadNotifications(ctx: RequestContext): Promise<number> {
  const db = scoped(ctx);
  const [fuCount, svCount] = await Promise.all([
    db.followUp.count({ where: { ownerId: ctx.userId, completedAt: null } }),
    db.siteVisit.count({ where: { assignedToId: ctx.userId, status: { in: ["SCHEDULED", "IN_PROGRESS"] } } }),
  ]);
  return fuCount + svCount;
}

export async function listNotifications(
  ctx: RequestContext,
  q: ListNotificationsQuery,
): Promise<ListNotificationsResult> {
  const db       = scoped(ctx);
  const pageSize = Math.min(q.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const page     = Math.max(1, q.page ?? 1);

  const filter = q.filter ?? "UNREAD";
  const includeSiteVisits = filter !== "READ";

  // Follow-up counts
  const [fuUnread, fuRead] = await Promise.all([
    db.followUp.count({ where: { ownerId: ctx.userId, completedAt: null } }),
    db.followUp.count({ where: { ownerId: ctx.userId, completedAt: { not: null } } }),
  ]);

  // Site visit count (always "unread")
  const svCount = includeSiteVisits
    ? await db.siteVisit.count({ where: { assignedToId: ctx.userId, status: { in: ["SCHEDULED", "IN_PROGRESS"] } } })
    : 0;

  const counts = {
    unread: fuUnread + svCount,
    read:   fuRead,
    all:    fuUnread + fuRead + svCount,
  };

  // Fetch all data and merge in memory (notification lists are small for this use case)
  const fuWhere =
    filter === "UNREAD" ? { ownerId: ctx.userId, completedAt: null }
    : filter === "READ" ? { ownerId: ctx.userId, completedAt: { not: null } }
    : { ownerId: ctx.userId };

  const [fuRows, svRows] = await Promise.all([
    db.followUp.findMany({
      where: fuWhere, orderBy: { dueAt: "desc" },
      select: { id: true, note: true, outcome: true, refType: true, refId: true, dueAt: true, completedAt: true },
    }),
    includeSiteVisits
      ? db.siteVisit.findMany({
          where:   { assignedToId: ctx.userId, status: { in: ["SCHEDULED", "IN_PROGRESS"] } },
          orderBy: { scheduledAt: "asc" },
          select:  { id: true, scheduledAt: true, purpose: true, leadId: true, projectId: true },
        })
      : Promise.resolve([]),
  ]);

  const visitNotifs = await resolveVisitLabels(db, svRows);

  const merged = [...fuRows.map(followUpToRow), ...visitNotifs]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const total = merged.length;
  const skip  = (page - 1) * pageSize;
  const rows  = merged.slice(skip, skip + pageSize);

  return { rows, total, page, pageSize, counts };
}

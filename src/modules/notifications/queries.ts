// Notifications — read side. Derived from FollowUp records owned by the
// current user. completedAt = null → unread; completedAt set → read.

import { scoped } from "@/kernel/db/scoped";
import type { RequestContext } from "@/kernel/auth/context";

export interface NotificationRow {
  id:         string;
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

function toRow(f: {
  id: string; note: string; outcome: string | null;
  refType: string; refId: string; dueAt: Date; completedAt: Date | null;
}): NotificationRow {
  const now = new Date();
  const level = !f.completedAt && f.dueAt < now ? "WARN" : "INFO";
  return {
    id:         f.id,
    level,
    title:      f.note,
    body:       f.outcome,
    entityType: f.refType || null,
    entityId:   f.refId   || null,
    readAt:     f.completedAt,
    createdAt:  f.dueAt,
  };
}

export async function listRecentNotifications(
  ctx: RequestContext,
  limit = 20,
): Promise<NotificationRow[]> {
  const db = scoped(ctx);
  const rows = await db.followUp.findMany({
    where:   { ownerId: ctx.userId },
    orderBy: { dueAt: "desc" },
    take:    Math.min(limit, 50),
    select:  { id: true, note: true, outcome: true, refType: true, refId: true, dueAt: true, completedAt: true },
  });
  return rows.map(toRow);
}

export async function countUnreadNotifications(ctx: RequestContext): Promise<number> {
  const db = scoped(ctx);
  return db.followUp.count({ where: { ownerId: ctx.userId, completedAt: null } });
}

export async function listNotifications(
  ctx: RequestContext,
  q: ListNotificationsQuery,
): Promise<ListNotificationsResult> {
  const db       = scoped(ctx);
  const pageSize = Math.min(q.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const page     = Math.max(1, q.page ?? 1);
  const skip     = (page - 1) * pageSize;

  const baseWhere = { ownerId: ctx.userId };
  const where =
    q.filter === "UNREAD" ? { ...baseWhere, completedAt: null }
    : q.filter === "READ" ? { ...baseWhere, completedAt: { not: null } }
    : baseWhere;

  const [rows, total, unread, read] = await Promise.all([
    db.followUp.findMany({
      where, orderBy: { dueAt: "desc" }, skip, take: pageSize,
      select: { id: true, note: true, outcome: true, refType: true, refId: true, dueAt: true, completedAt: true },
    }),
    db.followUp.count({ where }),
    db.followUp.count({ where: { ownerId: ctx.userId, completedAt: null } }),
    db.followUp.count({ where: { ownerId: ctx.userId, completedAt: { not: null } } }),
  ]);

  return {
    rows: rows.map(toRow), total, page, pageSize,
    counts: { all: unread + read, unread, read },
  };
}

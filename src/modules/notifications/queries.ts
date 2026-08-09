// @ts-nocheck — remote module, schema reconciliation pending
// Notifications — read side. Scoped to the current user; org-scope
// is handled by db.scoped(ctx) plus a userId filter.

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

const DEFAULT_LIMIT     = 20;
const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE     = 100;

export async function listRecentNotifications(
  ctx: RequestContext,
  limit: number = DEFAULT_LIMIT,
): Promise<NotificationRow[]> {
  const db = scoped(ctx);
  return db.notification.findMany({
    where:   { userId: ctx.userId },
    orderBy: { createdAt: "desc" },
    take:    Math.min(limit, 50),
    select: {
      id: true, level: true, title: true, body: true,
      entityType: true, entityId: true, readAt: true, createdAt: true,
    },
  });
}

export async function countUnreadNotifications(ctx: RequestContext): Promise<number> {
  const db = scoped(ctx);
  return db.notification.count({
    where: { userId: ctx.userId, readAt: null },
  });
}

export async function listNotifications(
  ctx: RequestContext,
  q: ListNotificationsQuery,
): Promise<ListNotificationsResult> {
  const db       = scoped(ctx);
  const pageSize = Math.min(q.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const page     = Math.max(1, q.page ?? 1);
  const skip     = (page - 1) * pageSize;

  const where: Record<string, unknown> = { userId: ctx.userId };
  if (q.filter === "UNREAD") where["readAt"] = null;
  if (q.filter === "READ")   where["readAt"] = { not: null };

  const [rows, total, unread, read] = await Promise.all([
    db.notification.findMany({
      where, orderBy: { createdAt: "desc" }, skip, take: pageSize,
      select: {
        id: true, level: true, title: true, body: true,
        entityType: true, entityId: true, readAt: true, createdAt: true,
      },
    }),
    db.notification.count({ where }),
    db.notification.count({ where: { userId: ctx.userId, readAt: null } }),
    db.notification.count({ where: { userId: ctx.userId, readAt: { not: null } } }),
  ]);

  return {
    rows, total, page, pageSize,
    counts: { all: unread + read, unread, read },
  };
}
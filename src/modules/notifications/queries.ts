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

const DEFAULT_LIMIT = 20;

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

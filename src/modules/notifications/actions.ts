// @ts-nocheck — remote module, schema reconciliation pending
"use server";

// Notifications server actions. Every mutation goes through
// db.scoped(ctx) + user filter — a user can only ever mark their own
// notifications read.
//
// Also re-exports the query functions the client bell needs so a
// single "use server" surface serves both directions.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { devContext } from "@/lib/dev-context";
import {
  listRecentNotifications, countUnreadNotifications,
  type NotificationRow,
} from "./queries";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

const markReadSchema = z.object({
  id: z.string().cuid(),
});

export async function markNotificationRead(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  const parsed = markReadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Bad id" };

  const db = scoped(ctx);
  await db.notification.updateMany({
    where: { id: parsed.data.id, userId: ctx.userId, readAt: null },
    data:  { readAt: new Date() },
  });

  revalidatePath("/");
  return { ok: true, data: { id: parsed.data.id } };
}

export async function markAllNotificationsRead(): Promise<ActionResult<{ count: number }>> {
  const ctx = await devContext();
  const db = scoped(ctx);
  const res = await db.notification.updateMany({
    where: { userId: ctx.userId, readAt: null },
    data:  { readAt: new Date() },
  });
  revalidatePath("/");
  return { ok: true, data: { count: res.count } };
}

// Client-callable data loaders (safe: scoped to userId server-side).
export async function fetchRecentNotifications(): Promise<NotificationRow[]> {
  const ctx = await devContext();
  return listRecentNotifications(ctx, 15);
}

export async function fetchUnreadCount(): Promise<number> {
  const ctx = await devContext();
  return countUnreadNotifications(ctx);
}
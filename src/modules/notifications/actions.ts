"use server";

// Notifications server actions — mark follow-ups read/unread.
// The "notification" surface in this app is derived from FollowUp records
// owned by the current user (no separate Notification model in the schema).

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
  id: z.string().min(1),
});

export async function markNotificationRead(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  const parsed = markReadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Bad id" };

  const db = scoped(ctx);
  await db.followUp.updateMany({
    where: { id: parsed.data.id, ownerId: ctx.userId, completedAt: null },
    data:  { completedAt: new Date() },
  });

  revalidatePath("/");
  return { ok: true, data: { id: parsed.data.id } };
}

export async function markAllNotificationsRead(): Promise<ActionResult<{ count: number }>> {
  const ctx = await devContext();
  const db = scoped(ctx);
  const res = await db.followUp.updateMany({
    where: { ownerId: ctx.userId, completedAt: null },
    data:  { completedAt: new Date() },
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

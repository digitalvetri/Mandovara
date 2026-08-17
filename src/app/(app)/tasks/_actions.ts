"use server";

import { revalidatePath } from "next/cache";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";

export async function completeFollowUp(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await devContext();
  const db  = scoped(ctx);

  const task = await db.followUp.findUnique({
    where:  { id },
    select: { id: true, ownerId: true, completedAt: true },
  });

  if (!task)                        return { ok: false, error: "Task not found." };
  if (task.ownerId !== ctx.userId)  return { ok: false, error: "Not authorised." };
  if (task.completedAt)             return { ok: false, error: "Already completed." };

  await db.followUp.update({
    where: { id },
    data:  { completedAt: new Date() },
  });

  revalidatePath("/tasks");
  return { ok: true };
}

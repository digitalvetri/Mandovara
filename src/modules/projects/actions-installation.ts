"use server";

// Marking installation work done, line by line.
//
// Owner instruction 2026-08-27: the installation view lists the works.
// A list you cannot tick is a report, so this is the write side — one
// action, one line, done or not done.
//
// Quantity rather than a boolean because a line can be part-installed:
// four of six blinds up, the last two waiting on a power point. Ticking
// sets installedQty to the full quantity; unticking returns it to zero.
// Partial figures can be set directly and are preserved by both.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import type { ActionResult } from "./actions";

const schema = z.object({
  orderLineId: z.string().min(1),
  projectId:   z.string().min(1),
  // null = tick to full, 0 = untick, a number = an explicit partial.
  installedQty: z.number().min(0).nullable(),
});

export async function setLineInstalled(input: unknown): Promise<ActionResult<{ installedQty: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "project.update");

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Validation failed" };
  const { orderLineId, projectId, installedQty } = parsed.data;

  const db = scoped(ctx);
  const line = await db.orderLine.findUnique({
    where:  { id: orderLineId },
    select: { id: true, quantity: true, order: { select: { projectId: true } } },
  });
  if (!line) return { ok: false, error: "Order line not found" };
  // The line must belong to the project in the URL — otherwise a crafted
  // request could tick off work on someone else's job.
  if (line.order.projectId !== projectId) {
    return { ok: false, error: "That line does not belong to this project." };
  }

  const ordered = Number(line.quantity);
  const next = installedQty === null
    ? ordered
    : Math.min(installedQty, ordered);   // never record more installed than ordered

  await db.orderLine.update({
    where: { id: orderLineId },
    data:  { installedQty: next.toFixed(3) },
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true, data: { installedQty: next.toFixed(3) } };
}

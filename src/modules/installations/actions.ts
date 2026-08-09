// @ts-nocheck
"use server";

// Installations console actions.
//
// Milestone completion re-uses @/modules/projects/actions.setMilestoneStatus,
// so nothing new here for that. This file owns Snag lifecycle.

import type { z } from "zod";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { postSnagSchema, setSnagStatusSchema } from "./schema";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function postSnag(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "project.update");
  const parsed = postSnagSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;
  const db = scoped(ctx);
  const created = await db.snagItem.create({
    data: {
      projectId:   d.projectId,
      location:    d.location,
      description: d.description,
      status:      "OPEN",
    },
    select: { id: true },
  });
  revalidatePath("/installations");
  revalidatePath(`/projects/${d.projectId}`);
  return { ok: true, data: created };
}

export async function setSnagStatus(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "project.closeSnag");
  const parsed = setSnagStatusSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id, status } = parsed.data;
  const db = scoped(ctx);
  const before = await db.snagItem.findUniqueOrThrow({
    where: { id }, select: { projectId: true },
  });
  await db.snagItem.update({ where: { id }, data: { status } });
  revalidatePath("/installations");
  revalidatePath(`/projects/${before.projectId}`);
  return { ok: true, data: { id } };
}

function zodError<T = unknown>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path.filter((s): s is string | number => typeof s === "string" || typeof s === "number").join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}

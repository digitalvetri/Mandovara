"use server";

import type { z } from "zod";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { createSnagSchema, updateSnagStatusSchema } from "./schema";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createSnag(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "project.update");

  const parsed = createSnagSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const snag = await db.snag.create({
    data: {
      organizationId: ctx.orgId,
      projectId: d.projectId,
      raisedById: ctx.userId,
      raisedAt: new Date(),
      description: d.description.trim(),
      roomLabel: d.roomLabel?.trim() || null,
      assignedToId: d.assignedToId ?? null,
      status: "OPEN",
      photoKeys: [],
    },
    select: { id: true },
  });

  revalidatePath(`/projects/${d.projectId}`);
  return { ok: true, data: { id: snag.id } };
}

export async function updateSnagStatus(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "project.update");

  const parsed = updateSnagStatusSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const snag = await db.snag.findUnique({
    where: { id: d.snagId },
    select: { id: true, projectId: true, status: true },
  });
  if (!snag) return { ok: false, error: "Snag not found" };
  if (snag.status === "CLOSED") {
    return { ok: false, error: "Snag is already closed" };
  }

  await db.snag.update({
    where: { id: d.snagId },
    data: {
      status: d.status,
      assignedToId: d.assignedToId ?? undefined,
      resolutionNote: d.resolutionNote?.trim() || null,
      resolvedAt: d.status === "RESOLVED" ? new Date() : undefined,
    },
  });

  revalidatePath(`/projects/${snag.projectId}`);
  return { ok: true, data: { id: d.snagId } };
}

// ── helpers ──────────────────────────────────────────────────────────────────

function zodError<T = unknown>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path
      .filter((s): s is string | number => typeof s === "string" || typeof s === "number")
      .join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}

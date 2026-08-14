"use server";

import type { z } from "zod";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { raiseInstallSnagSchema, resolveInstallSnagSchema } from "./schema";
import type { ActionResult } from "./actions";

export async function raiseInstallSnag(
  input: unknown,
): Promise<ActionResult<{ snagId: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "install.update");

  const parsed = raiseInstallSnagSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const visit = await db.installVisit.findUnique({
    where: { id: d.visitId },
    select: { id: true, status: true },
  });
  if (!visit) return { ok: false, error: "Install visit not found" };
  if (!["COMPLETED", "SNAGGING", "IN_PROGRESS"].includes(visit.status)) {
    return { ok: false, error: "Snags can only be raised on In Progress, Completed or Snagging visits" };
  }

  const snag = await db.snag.create({
    data: {
      organizationId: ctx.orgId,
      projectId: d.projectId,
      installVisitId: d.visitId,
      raisedById: ctx.userId,
      description: d.description,
      roomLabel: d.roomLabel || null,
      photoKeys: d.photoKeys ?? [],
      status: "OPEN",
    },
    select: { id: true },
  });

  // Transition visit to SNAGGING if it's COMPLETED
  if (visit.status === "COMPLETED") {
    await db.installVisit.update({
      where: { id: d.visitId },
      data: { status: "SNAGGING" },
    });
    await db.installVisitEvent.create({
      data: {
        organizationId: ctx.orgId, visitId: d.visitId, actorId: ctx.userId,
        type: "SNAG_RAISED", fromStatus: "COMPLETED", toStatus: "SNAGGING",
        payload: { snagId: snag.id, description: d.description },
      },
    });
  } else {
    await db.installVisitEvent.create({
      data: {
        organizationId: ctx.orgId, visitId: d.visitId, actorId: ctx.userId,
        type: "SNAG_RAISED", fromStatus: visit.status, toStatus: visit.status,
        payload: { snagId: snag.id, description: d.description },
      },
    });
  }

  revalidatePath("/install");
  revalidatePath(`/install/${d.visitId}`);
  return { ok: true, data: { snagId: snag.id } };
}

export async function resolveInstallSnag(
  input: unknown,
): Promise<ActionResult<{ snagId: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "install.update");

  const parsed = resolveInstallSnagSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const snag = await db.snag.findUnique({
    where: { id: d.snagId },
    select: { id: true, status: true, installVisitId: true },
  });
  if (!snag) return { ok: false, error: "Snag not found" };
  if (!snag.installVisitId) return { ok: false, error: "Snag is not linked to an install visit" };

  await db.snag.update({
    where: { id: d.snagId },
    data: { status: "RESOLVED", resolvedAt: new Date(), resolutionNote: d.resolutionNote || null },
  });

  await db.installVisitEvent.create({
    data: {
      organizationId: ctx.orgId, visitId: snag.installVisitId, actorId: ctx.userId,
      type: "SNAG_RESOLVED", fromStatus: null, toStatus: null,
      payload: { snagId: d.snagId, resolutionNote: d.resolutionNote ?? "" },
    },
  });

  revalidatePath(`/install/${snag.installVisitId}`);
  return { ok: true, data: { snagId: d.snagId } };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function zodError<T = unknown>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path.filter((s): s is string | number => typeof s === "string" || typeof s === "number").join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}

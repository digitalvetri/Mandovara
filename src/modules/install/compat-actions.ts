"use server";

import type { z } from "zod";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { completeInstallSchema, rescheduleInstallVisitSchema } from "./schema";
import type { ActionResult } from "./actions";

// Used by the mobile install PWA (SignatureCapture) to mark a visit complete.
export async function completeInstallVisit(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "install.update");

  const parsed = completeInstallSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const visit = await db.installVisit.findUnique({
    where: { id: d.visitId },
    select: { id: true, status: true },
  });
  if (!visit) return { ok: false, error: "Install visit not found" };
  if (!["ASSIGNED", "IN_PROGRESS", "SCHEDULED"].includes(visit.status)) {
    return { ok: false, error: `Cannot complete from ${visit.status}` };
  }

  const now = new Date();
  await db.installVisit.update({
    where: { id: d.visitId },
    data: {
      status: "COMPLETED", completedAt: now,
      ...(d.clientSignatureKey ? { clientSignatureKey: d.clientSignatureKey } : {}),
      ...(d.notes ? { notes: d.notes } : {}),
    },
  });
  await db.installVisitEvent.create({
    data: {
      organizationId: ctx.orgId, visitId: d.visitId, actorId: ctx.userId,
      type: "STATUS_CHANGE", fromStatus: visit.status, toStatus: "COMPLETED", payload: {},
    },
  });

  revalidatePath("/install");
  revalidatePath(`/install/${d.visitId}`);
  return { ok: true, data: { id: d.visitId } };
}

export async function rescheduleInstallVisit(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "install.update");

  const parsed = rescheduleInstallVisitSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const visit = await db.installVisit.findUnique({ where: { id: d.visitId }, select: { id: true, status: true } });
  if (!visit) return { ok: false, error: "Visit not found" };

  await db.installVisit.update({
    where: { id: d.visitId },
    data: { status: "RESCHEDULED", scheduledAt: new Date(d.scheduledAt), rescheduleReason: d.reason },
  });
  await db.installVisitEvent.create({
    data: { organizationId: ctx.orgId, visitId: d.visitId, actorId: ctx.userId, type: "STATUS_CHANGE", fromStatus: visit.status, toStatus: "RESCHEDULED", payload: { reason: d.reason } },
  });

  revalidatePath("/install");
  revalidatePath(`/install/${d.visitId}`);
  return { ok: true, data: { id: d.visitId } };
}

function zodError<T = unknown>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path.filter((s): s is string | number => typeof s === "string" || typeof s === "number").join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}

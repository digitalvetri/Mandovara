"use server";

import type { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { allocateNumber, yymmFromDate } from "@/kernel/numbering/series";
import { devContext } from "@/lib/dev-context";
import { bus } from "@/kernel/events/bus";
import "@/kernel/events/register";
import {
  createInstallVisitSchema,
  assignCrewSchema,
  startInstallSchema,
  recordInstallLineSchema,
  confirmInstallSchema,
  closeVisitSchema,
  INSTALL_STATUS_NEXT,
} from "./schema";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createInstallVisit(
  input: unknown,
): Promise<ActionResult<{ id: string; number: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "install.create");

  const parsed = createInstallVisitSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const order = await db.order.findUniqueOrThrow({
    where: { id: d.orderId },
    select: {
      id: true, projectId: true,
      lines: { orderBy: { lineNo: "asc" }, select: { id: true, description: true, quantity: true, measurementItemId: true } },
    },
  });

  const measIds = order.lines.map((l) => l.measurementItemId).filter(Boolean) as string[];
  const roomLabelMap = new Map<string, string>();
  if (measIds.length > 0) {
    const items = await db.measurementItem.findMany({
      where: { id: { in: measIds } },
      select: { id: true, label: true, room: { select: { name: true } } },
    });
    for (const item of items) roomLabelMap.set(item.id, `${item.room.name} — ${item.label}`);
  }

  const created = await withTransaction(async (tx: TxClient) => {
    const number = await allocateNumber(tx, { orgId: ctx.orgId, series: "INS", yymm: yymmFromDate(new Date()), prefix: "MDV" });

    const visit = await tx.installVisit.create({
      data: {
        organizationId: ctx.orgId, number,
        projectId: d.projectId, orderId: d.orderId,
        kind: "INSTALL",
        scheduledAt: new Date(d.scheduledAt),
        status: "SCHEDULED",
        ...(d.crewId ? { crewId: d.crewId } : {}),
        notes: d.notes || null,
        photoKeys: [],
      },
      select: { id: true, number: true },
    });

    await tx.installLine.createMany({
      data: order.lines.map((l) => ({
        organizationId: ctx.orgId, installVisitId: visit.id, orderLineId: l.id,
        roomLabel: (l.measurementItemId ? roomLabelMap.get(l.measurementItemId) : undefined) ?? l.description,
        plannedQty: l.quantity, installedQty: new Decimal(0), remoteSerials: [], photoKeys: [],
      })),
    });

    await tx.installVisitEvent.create({
      data: { organizationId: ctx.orgId, visitId: visit.id, actorId: ctx.userId, type: "STATUS_CHANGE", fromStatus: null, toStatus: "SCHEDULED", payload: {} },
    });

    return visit;
  });

  revalidatePath("/install");
  return { ok: true, data: created };
}

export async function assignCrew(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "install.update");

  const parsed = assignCrewSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const visit = await db.installVisit.findUnique({ where: { id: d.visitId }, select: { id: true, status: true } });
  if (!visit) return { ok: false, error: "Install visit not found" };
  if (!["SCHEDULED", "RESCHEDULED"].includes(visit.status)) {
    return { ok: false, error: `Visit is ${visit.status} — assign crew only from Scheduled/Rescheduled` };
  }

  const now = new Date();
  await db.installVisit.update({
    where: { id: d.visitId },
    data: { crewId: d.crewId, status: "ASSIGNED", assignedAt: now, ...(d.scheduledAt ? { scheduledAt: new Date(d.scheduledAt) } : {}) },
  });
  await db.installVisitEvent.create({
    data: { organizationId: ctx.orgId, visitId: d.visitId, actorId: ctx.userId, type: "STATUS_CHANGE", fromStatus: visit.status, toStatus: "ASSIGNED", payload: { crewId: d.crewId } },
  });

  revalidatePath("/install");
  revalidatePath(`/install/${d.visitId}`);
  return { ok: true, data: { id: d.visitId } };
}

export async function advanceInstallStatus(
  input: unknown,
): Promise<ActionResult<{ id: string; status: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "install.update");

  const parsed = startInstallSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { visitId } = parsed.data;

  const db = scoped(ctx);
  const visit = await db.installVisit.findUnique({ where: { id: visitId }, select: { id: true, status: true, projectId: true } });
  if (!visit) return { ok: false, error: "Install visit not found" };

  const next = INSTALL_STATUS_NEXT[visit.status];
  if (!next) {
    if (visit.status === "COMPLETED") return { ok: false, error: "Use 'Confirm Installation' or 'Raise Snag' from Completed" };
    return { ok: false, error: `No automatic advance from ${visit.status}` };
  }

  const now = new Date();
  await db.installVisit.update({
    where: { id: visitId },
    data: {
      status: next as Parameters<typeof db.installVisit.update>[0]["data"]["status"],
      ...(next === "IN_PROGRESS" ? { startedAt: now } : {}),
      ...(next === "COMPLETED" ? { completedAt: now } : {}),
    },
  });
  await db.installVisitEvent.create({
    data: { organizationId: ctx.orgId, visitId, actorId: ctx.userId, type: "STATUS_CHANGE", fromStatus: visit.status, toStatus: next, payload: {} },
  });

  // Tick the INSTALLATION milestone when this transition lands on COMPLETED.
  if (next === "COMPLETED") {
    await bus.publish({
      type:           "installVisit.completed",
      orgId:          ctx.orgId,
      actorId:        ctx.userId,
      occurredAt:     now,
      installVisitId: visitId,
      projectId:      visit.projectId,
    });
  }

  revalidatePath("/install");
  revalidatePath(`/install/${visitId}`);
  return { ok: true, data: { id: visitId, status: next } };
}

export async function recordInstallLine(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "install.update");

  const parsed = recordInstallLineSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const line = await db.installLine.findUnique({ where: { id: d.installLineId }, select: { id: true, installVisitId: true } });
  if (!line) return { ok: false, error: "Install line not found" };

  await db.installLine.update({
    where: { id: d.installLineId },
    data: { installedQty: new Decimal(d.installedQty), dyeLotUsed: d.dyeLotUsed?.trim() || null, issue: d.issue?.trim() || null },
  });

  revalidatePath(`/install/${line.installVisitId}`);
  return { ok: true, data: { id: d.installLineId } };
}

export async function confirmInstall(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "install.update");

  const parsed = confirmInstallSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const visit = await db.installVisit.findUnique({
    where: { id: d.visitId },
    select: { id: true, status: true, orderId: true, projectId: true },
  });
  if (!visit) return { ok: false, error: "Install visit not found" };
  if (!["COMPLETED", "SNAGGING"].includes(visit.status)) {
    return { ok: false, error: `Visit must be Completed or Snagging — currently ${visit.status}` };
  }

  const openSnags = await db.snag.count({
    where: { installVisitId: d.visitId, status: { in: ["OPEN", "IN_PROGRESS"] } },
  });
  if (openSnags > 0) return { ok: false, error: `${openSnags} snag(s) are open — resolve before confirming` };

  const now = new Date();
  await withTransaction(async (tx: TxClient) => {
    await tx.installVisit.update({
      where: { id: d.visitId },
      data: {
        status: "CUSTOMER_CONFIRMED", customerConfirmedAt: now,
        ...(d.clientSignatureKey ? { clientSignatureKey: d.clientSignatureKey } : {}),
        ...(d.feedbackRating ? { clientFeedbackRating: d.feedbackRating } : {}),
      },
    });

    const lines = await tx.installLine.findMany({ where: { installVisitId: d.visitId }, select: { id: true, plannedQty: true } });
    await Promise.all(lines.map((l) => tx.installLine.update({ where: { id: l.id }, data: { installedQty: l.plannedQty } })));

    await tx.installVisitEvent.create({
      data: { organizationId: ctx.orgId, visitId: d.visitId, actorId: ctx.userId, type: "STATUS_CHANGE", fromStatus: visit.status, toStatus: "CUSTOMER_CONFIRMED", payload: {} },
    });

    await tx.order.update({ where: { id: visit.orderId }, data: { status: "COMPLETED" } });
    const siblings = await tx.order.findMany({
      where: { projectId: visit.projectId, status: { not: "CANCELLED" } },
      select: { status: true },
    });
    if (siblings.every((o) => o.status === "COMPLETED")) {
      await tx.project.update({ where: { id: visit.projectId }, data: { stage: "COMPLETED" } });
    }
  });

  revalidatePath("/install");
  revalidatePath(`/install/${d.visitId}`);
  revalidatePath("/orders");
  revalidatePath("/projects");
  return { ok: true, data: { id: d.visitId } };
}

export async function closeVisit(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "install.update");

  const parsed = closeVisitSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { visitId } = parsed.data;

  const db = scoped(ctx);
  const visit = await db.installVisit.findUnique({ where: { id: visitId }, select: { id: true, status: true } });
  if (!visit) return { ok: false, error: "Visit not found" };
  if (visit.status !== "CUSTOMER_CONFIRMED") return { ok: false, error: "Visit must be Customer Confirmed before closing" };

  await db.installVisit.update({ where: { id: visitId }, data: { status: "CLOSED" } });
  await db.installVisitEvent.create({
    data: { organizationId: ctx.orgId, visitId, actorId: ctx.userId, type: "STATUS_CHANGE", fromStatus: "CUSTOMER_CONFIRMED", toStatus: "CLOSED", payload: {} },
  });

  revalidatePath("/install");
  revalidatePath(`/install/${visitId}`);
  return { ok: true, data: { id: visitId } };
}

// ── alias (mobile PWA uses startInstallVisit) ─────────────────────────────────
export async function startInstallVisit(input: unknown) {
  return advanceInstallStatus(input);
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

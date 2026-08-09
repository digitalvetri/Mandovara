"use server";

import type { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { allocateNumber, yymmFromDate } from "@/kernel/numbering/series";
import { devContext } from "@/lib/dev-context";
import {
  createInstallVisitSchema,
  startInstallVisitSchema,
  recordInstallLineSchema,
  completeInstallVisitSchema,
  rescheduleInstallVisitSchema,
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
      id: true,
      projectId: true,
      lines: {
        orderBy: { lineNo: "asc" },
        select: {
          id: true,
          description: true,
          quantity: true,
          unit: true,
          measurementItemId: true,
        },
      },
    },
  });

  // Build room labels for install lines
  const measurementItemIds = order.lines
    .map((l) => l.measurementItemId)
    .filter(Boolean) as string[];

  const roomLabelMap = new Map<string, string>();
  if (measurementItemIds.length > 0) {
    const items = await db.measurementItem.findMany({
      where: { id: { in: measurementItemIds } },
      select: { id: true, label: true, room: { select: { name: true } } },
    });
    for (const item of items) {
      roomLabelMap.set(item.id, `${item.room.name} — ${item.label}`);
    }
  }

  const scheduledAt = new Date(d.scheduledAt);

  const created = await withTransaction(async (tx: TxClient) => {
    const number = await allocateNumber(tx, {
      orgId: ctx.orgId,
      series: "INS",
      yymm: yymmFromDate(new Date()),
      prefix: "MDV",
    });

    const visit = await tx.installVisit.create({
      data: {
        organizationId: ctx.orgId,
        number,
        projectId: d.projectId,
        orderId: d.orderId,
        scheduledAt,
        status: "SCHEDULED",
        ...(d.crewId ? { crewId: d.crewId } : {}),
        photoKeys: [],
      },
      select: { id: true, number: true },
    });

    await tx.installLine.createMany({
      data: order.lines.map((l) => ({
        organizationId: ctx.orgId,
        installVisitId: visit.id,
        orderLineId: l.id,
        roomLabel:
          (l.measurementItemId ? roomLabelMap.get(l.measurementItemId) : undefined) ??
          l.description,
        plannedQty: l.quantity,
        installedQty: new Decimal(0),
        remoteSerials: [],
        photoKeys: [],
      })),
    });

    return visit;
  });

  revalidatePath("/install");
  return { ok: true, data: created };
}

export async function startInstallVisit(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "install.update");

  const parsed = startInstallVisitSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { visitId } = parsed.data;

  const db = scoped(ctx);
  const visit = await db.installVisit.findUnique({
    where: { id: visitId },
    select: { id: true, status: true },
  });
  if (!visit) return { ok: false, error: "Install visit not found" };
  if (visit.status !== "SCHEDULED") {
    return { ok: false, error: `Visit is ${visit.status}, cannot start` };
  }

  await db.installVisit.update({
    where: { id: visitId },
    data: { status: "IN_PROGRESS", startedAt: new Date() },
  });

  revalidatePath(`/install/${visitId}`);
  return { ok: true, data: { id: visitId } };
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
  const line = await db.installLine.findUnique({
    where: { id: d.installLineId },
    select: { id: true, installVisitId: true, plannedQty: true },
  });
  if (!line) return { ok: false, error: "Install line not found" };

  await db.installLine.update({
    where: { id: d.installLineId },
    data: {
      installedQty: new Decimal(d.installedQty),
      dyeLotUsed: d.dyeLotUsed?.trim() || null,
      issue: d.issue?.trim() || null,
    },
  });

  revalidatePath(`/install/${line.installVisitId}`);
  return { ok: true, data: { id: d.installLineId } };
}

export async function completeInstallVisit(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "install.update");

  const parsed = completeInstallVisitSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { visitId, notes, clientSignatureKey } = parsed.data;

  const db = scoped(ctx);
  const visit = await db.installVisit.findUnique({
    where: { id: visitId },
    select: { id: true, status: true },
  });
  if (!visit) return { ok: false, error: "Install visit not found" };
  if (!["SCHEDULED", "IN_PROGRESS"].includes(visit.status)) {
    return { ok: false, error: `Visit is ${visit.status}, cannot complete` };
  }

  await db.installVisit.update({
    where: { id: visitId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      notes: notes?.trim() || null,
      clientSignatureKey: clientSignatureKey?.trim() || null,
    },
  });

  revalidatePath("/install");
  revalidatePath(`/install/${visitId}`);
  return { ok: true, data: { id: visitId } };
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
  await db.installVisit.update({
    where: { id: d.visitId },
    data: {
      status: "RESCHEDULED",
      scheduledAt: new Date(d.scheduledAt),
      rescheduleReason: d.reason,
    },
  });

  revalidatePath("/install");
  revalidatePath(`/install/${d.visitId}`);
  return { ok: true, data: { id: d.visitId } };
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

"use server";

import type { z } from "zod";
import type { HeadingType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { allocateNumber, yymmFromDate } from "@/kernel/numbering/series";
import { devContext } from "@/lib/dev-context";
import {
  createMakeJobSchema,
  advanceMakeJobStatusSchema,
  recordFabricIssueSchema,
  recordActualUsageSchema,
  MAKE_STATUS_NEXT,
} from "./schema";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

type CalcSnap = {
  widthsRequired?: number | null;
  cutLengthMm?: string | null;
  liningQty?: string | null;
  fabricRun?: string | null;
  headingType?: string | null;
  eyeletCount?: number | null;
  warnings?: string[];
  engineVersion?: string;
};

export async function createMakeJob(
  input: unknown,
): Promise<ActionResult<{ id: string; number: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "make.create");

  const parsed = createMakeJobSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);

  const order = await db.order.findUniqueOrThrow({
    where: { id: d.orderId },
    select: {
      id: true,
      number: true,
      projectId: true,
      quotationId: true,
      status: true,
      lines: {
        orderBy: { lineNo: "asc" },
        select: {
          id: true,
          lineNo: true,
          description: true,
          measurementItemId: true,
          colourwayId: true,
        },
      },
    },
  });

  const project = await db.project.findUniqueOrThrow({
    where: { id: order.projectId },
    select: { branchId: true },
  });

  // Build calcSnapshot map: measurementItemId → frozen or live CalcResult data.
  // Priority: frozen QuotationLine.calcSnapshot (sent quote) > live CalcResult.
  // This ensures the cut list is identical to what was quoted (§7.7 rule 6 / §15.3).
  const snapMap = new Map<string, CalcSnap>();
  const roomLabelMap = new Map<string, string>();

  if (order.quotationId) {
    const qLines = await db.quotationLine.findMany({
      where: { quotationId: order.quotationId, measurementItemId: { not: null } },
      select: { measurementItemId: true, roomLabel: true, calcSnapshot: true },
    });
    for (const l of qLines) {
      if (!l.measurementItemId) continue;
      if (l.calcSnapshot) snapMap.set(l.measurementItemId, l.calcSnapshot as CalcSnap);
      if (l.roomLabel) roomLabelMap.set(l.measurementItemId, l.roomLabel);
    }
  }

  // Fill gaps with live CalcResult (for order lines with no frozen snapshot)
  const needLive = order.lines
    .filter((l) => l.measurementItemId && !snapMap.has(l.measurementItemId))
    .map((l) => l.measurementItemId!);

  if (needLive.length > 0) {
    const liveCalcs = await db.calcResult.findMany({
      where: { measurementItemId: { in: needLive } },
    });
    for (const c of liveCalcs) {
      snapMap.set(c.measurementItemId, {
        widthsRequired: c.widthsRequired,
        cutLengthMm: c.cutLengthMm?.toString() ?? null,
        liningQty: c.liningQty?.toString() ?? null,
        fabricRun: c.fabricRun ?? undefined,
        warnings: c.warnings,
        engineVersion: c.engineVersion,
      });
    }
  }

  // Fill room labels from MeasurementItem → Room
  const needLabels = order.lines
    .filter((l) => l.measurementItemId && !roomLabelMap.has(l.measurementItemId))
    .map((l) => l.measurementItemId!);

  if (needLabels.length > 0) {
    const items = await db.measurementItem.findMany({
      where: { id: { in: needLabels } },
      select: {
        id: true,
        label: true,
        room: { select: { name: true } },
      },
    });
    for (const item of items) {
      roomLabelMap.set(item.id, `${item.room.name} — ${item.label}`);
    }
  }

  const targetDate = d.targetDate ? new Date(d.targetDate) : null;

  const created = await withTransaction(async (tx: TxClient) => {
    const number = await allocateNumber(tx, {
      orgId: ctx.orgId,
      series: "MJ",
      yymm: yymmFromDate(new Date()),
      prefix: "MDV",
    });

    const job = await tx.makeJob.create({
      data: {
        organizationId: ctx.orgId,
        number,
        orderId: order.id,
        projectId: order.projectId,
        status: "QUEUED",
        ...(d.vendorId ? { vendorId: d.vendorId } : {}),
        ...(d.assignedToId ? { assignedToId: d.assignedToId } : {}),
        ...(targetDate ? { targetDate } : {}),
      },
      select: { id: true, number: true },
    });

    // Create a MakeJobLine for each order line that carries material
    await tx.makeJobLine.createMany({
      data: order.lines.map((l) => {
        const snap = l.measurementItemId ? snapMap.get(l.measurementItemId) : undefined;
        const roomLabel =
          (l.measurementItemId ? roomLabelMap.get(l.measurementItemId) : undefined) ??
          l.description;
        return {
          organizationId: ctx.orgId,
          makeJobId: job.id,
          orderLineId: l.id,
          measurementItemId: l.measurementItemId ?? null,
          roomLabel,
          panels: snap?.widthsRequired ?? null,
          cutLengthMm: snap?.cutLengthMm ? new Decimal(snap.cutLengthMm) : null,
          headingType: (snap?.headingType as HeadingType | null | undefined) ?? null,
          eyeletCount: snap?.eyeletCount ?? null,
        };
      }),
    });

    return job;
  });

  revalidatePath("/make");
  return { ok: true, data: created };
}

export async function advanceMakeJobStatus(
  input: unknown,
): Promise<ActionResult<{ id: string; status: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "make.update");

  const parsed = advanceMakeJobStatusSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { makeJobId } = parsed.data;

  const db = scoped(ctx);
  const job = await db.makeJob.findUnique({
    where: { id: makeJobId },
    select: { id: true, status: true },
  });
  if (!job) return { ok: false, error: "Make job not found" };

  const nextStatus = MAKE_STATUS_NEXT[job.status];
  if (!nextStatus) {
    return { ok: false, error: `Job is already in ${job.status} — no next status` };
  }

  const now = new Date();
  const update = await db.makeJob.update({
    where: { id: makeJobId },
    data: {
      status: nextStatus as Parameters<typeof db.makeJob.update>[0]["data"]["status"],
      ...(job.status === "QUEUED" ? { startedAt: now } : {}),
      ...(nextStatus === "DELIVERED" ? { completedAt: now } : {}),
    },
    select: { id: true, status: true },
  });

  revalidatePath("/make");
  revalidatePath(`/make/${makeJobId}`);
  return { ok: true, data: { id: update.id, status: update.status } };
}

export async function recordFabricIssue(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "make.update");

  const parsed = recordFabricIssueSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const line = await db.makeJobLine.findUnique({
    where: { id: d.makeJobLineId },
    select: { id: true, makeJobId: true },
  });
  if (!line) return { ok: false, error: "Make job line not found" };

  await db.makeJobLine.update({
    where: { id: d.makeJobLineId },
    data: {
      fabricIssuedM: new Decimal(d.fabricIssuedM),
      ...(d.liningIssuedM !== undefined
        ? { liningIssuedM: new Decimal(d.liningIssuedM) }
        : {}),
    },
  });

  revalidatePath(`/make/${line.makeJobId}`);
  return { ok: true, data: { id: d.makeJobLineId } };
}

export async function recordActualUsage(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "make.update");

  const parsed = recordActualUsageSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const line = await db.makeJobLine.findUnique({
    where: { id: d.makeJobLineId },
    select: { id: true, makeJobId: true },
  });
  if (!line) return { ok: false, error: "Make job line not found" };

  await db.makeJobLine.update({
    where: { id: d.makeJobLineId },
    data: {
      actualUsedM: new Decimal(d.actualUsedM),
      wastageM: new Decimal(d.wastageM),
      qcPassed: d.qcPassed,
      qcNotes: d.qcNotes?.trim() || null,
    },
  });

  revalidatePath(`/make/${line.makeJobId}`);
  return { ok: true, data: { id: d.makeJobLineId } };
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

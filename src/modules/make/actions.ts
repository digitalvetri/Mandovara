"use server";

// Make server actions.
//
// createMakeJobFromOrder mints one MakeJob per SalesOrder in QUEUED
// state, allocating a race-safe MDV/MJ number and inserting one
// MakeJobLine per order line that carries a cut-list-relevant
// snapshot. The cut list itself is built by the pure buildCutList()
// helper — this action owns the DB reads/writes and nothing more.
//
// §14 Phase 5 gate: the invariant is that MakeJobLine.panels and
// .cutLengthMm equal OrderLine.calcSnapshot.outputs.{panels, cutLengthMm}
// which in turn equal QuotationLine.calcSnapshot.outputs.{...} which
// in turn equal CalcResult.outputs.{...}. buildCutList is a pure map;
// createOrderFromQuotation copies the snapshot verbatim; freezing on
// SEND writes what the engine produced.

import type { z } from "zod";
import { revalidatePath } from "next/cache";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { allocateNumber, Prisma } from "@/kernel/numbering/series";
import { financialYear } from "@/kernel/datetime";
import { devContext } from "@/lib/dev-context";
import {
  createMakeJobFromOrderSchema,
  advanceMakeJobStatusSchema,
  issueMaterialSchema,
  recordUsageSchema,
  qcLineSchema,
} from "./schema";
import { buildCutList, type OrderLineForCutList } from "./cut-list";
import { canTransition } from "./status";

// safeRevalidate — mirrors modules/quotations/actions.ts and
// modules/allocation/actions.ts. Lets the action run under both a
// Next request and a bare tsx smoke script.
function safeRevalidate(path: string): void {
  try { revalidatePath(path); } catch { /* not in a Next request */ }
}

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createMakeJobFromOrder(
  input: unknown,
): Promise<ActionResult<{ id: string; number: string; lineCount: number }>> {
  const ctx = await devContext();
  requirePermission(ctx, "make.create");

  const parsed = createMakeJobFromOrderSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { orderId } = parsed.data;

  // Pre-tx load — scoped so a foreign tenant can't touch our order.
  const db = scoped(ctx);
  const order = await db.salesOrder.findUnique({
    where:  { id: orderId },
    select: {
      id: true, branchId: true, status: true, date: true,
      lines: {
        orderBy: { lineNo: "asc" },
        select: {
          id: true, lineNo: true, measurementItemId: true, calcSnapshot: true,
          measurement: { select: { roomLabel: true } },
        },
      },
      makeJobs: { select: { id: true, number: true, status: true }, take: 1 },
    },
  });
  if (!order) return { ok: false, error: "Order not found" };
  if (order.status === "CANCELLED") {
    return { ok: false, error: "Order is CANCELLED — cannot create a make job" };
  }
  if (order.makeJobs.length > 0) {
    // No re-cutting. A second make job for the same order is a design
    // smell — split via order amendment, don't stack jobs.
    const existing = order.makeJobs[0]!;
    return {
      ok: false,
      error: `Order already has a make job (${existing.number}, ${existing.status})`,
    };
  }
  const branch = await db.branch.findUniqueOrThrow({
    where:  { id: order.branchId },
    select: { invoicePrefix: true },
  });

  const sourceLines: OrderLineForCutList[] = order.lines.map((l) => ({
    orderLineId:       l.id,
    measurementItemId: l.measurementItemId,
    calcSnapshot:      l.calcSnapshot,
    roomLabel:         l.measurement?.roomLabel ?? `Line ${l.lineNo}`,
  }));
  const cutList = buildCutList(sourceLines);
  if (cutList.length === 0) {
    return {
      ok: false,
      error: "Order has no made-to-measure lines to cut — nothing to make.",
    };
  }

  const created = await withTransaction(async (tx: TxClient) => {
    const number = await allocateNumber(tx, {
      orgId:         ctx.orgId,
      branchId:      order.branchId,
      docType:       "MAKE_JOB",
      financialYear: financialYear(order.date),
      prefix:        `${branch.invoicePrefix}/MJ`,
    });
    const job = await tx.makeJob.create({
      data: {
        orgId:        ctx.orgId,
        number,
        salesOrderId: order.id,
        status:       "QUEUED",
        createdById:  ctx.userId,
      },
      select: { id: true, number: true },
    });
    await tx.makeJobLine.createMany({
      data: cutList.map((entry) => ({
        makeJobId:         job.id,
        orderLineId:       entry.orderLineId,
        measurementItemId: entry.measurementItemId,
        roomLabel:         entry.roomLabel,
        ...(entry.panels      != null && { panels:      entry.panels }),
        ...(entry.cutLengthMm != null && {
          cutLengthMm: new Prisma.Decimal(entry.cutLengthMm),
        }),
        ...(entry.liningIssuedM != null && {
          liningIssuedM: new Prisma.Decimal(entry.liningIssuedM),
        }),
        ...(entry.eyeletCount != null && { eyeletCount: entry.eyeletCount }),
        ...(entry.headingType != null && { headingType: entry.headingType }),
      })),
    });
    return job;
  });

  safeRevalidate("/make");
  safeRevalidate(`/orders/${order.id}`);
  return {
    ok:   true,
    data: { id: created.id, number: created.number, lineCount: cutList.length },
  };
}

// ── helpers ──────────────────────────────────────────────────────

// ── 5b — status transitions ──────────────────────────────────────

export async function advanceMakeJobStatus(
  input: unknown,
): Promise<ActionResult<{ id: string; from: string; to: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "make.advanceStatus");

  const parsed = advanceMakeJobStatusSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { jobId, toStatus, qcNote } = parsed.data;

  const db = scoped(ctx);
  const current = await db.makeJob.findUnique({
    where:  { id: jobId },
    select: { id: true, status: true, startedAt: true },
  });
  if (!current) return { ok: false, error: "Make job not found" };
  if (!canTransition(current.status, toStatus)) {
    return {
      ok: false,
      error: `Illegal transition ${current.status} → ${toStatus}`,
      fieldErrors: { toStatus: `Not allowed from ${current.status}` },
    };
  }

  // startedAt: first time we leave QUEUED. completedAt: on DELIVERED.
  // Both are one-way — a QC-fail loop back to CUTTING does NOT reset
  // startedAt so the "aged days" widget stays honest.
  const now = new Date();
  const patch: Record<string, unknown> = { status: toStatus };
  if (current.startedAt == null && toStatus !== "QUEUED") {
    patch["startedAt"] = now;
  }
  if (toStatus === "DELIVERED") {
    patch["completedAt"] = now;
  }

  await withTransaction(async (tx: TxClient) => {
    await tx.makeJob.update({ where: { id: jobId }, data: patch });
    await tx.auditLog.create({
      data: {
        orgId:      ctx.orgId,
        actorId:    ctx.userId,
        entityType: "MakeJob",
        entityId:   jobId,
        action:     `STATUS_${toStatus}`,
        before:     { status: current.status },
        after:      {
          status: toStatus,
          ...(qcNote != null && qcNote.length > 0 && { qcNote }),
        },
      },
    });
  });

  safeRevalidate("/make");
  safeRevalidate(`/make/${jobId}`);
  return { ok: true, data: { id: jobId, from: current.status, to: toStatus } };
}

// ── 5b — per-line material issuance ──────────────────────────────

export async function issueMakeJobLineMaterial(
  input: unknown,
): Promise<ActionResult<{ lineId: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "make.issueMaterial");

  const parsed = issueMaterialSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { lineId, fabricIssuedM, liningIssuedM } = parsed.data;

  const db = scoped(ctx);
  const line = await db.makeJobLine.findUnique({
    where:  { id: lineId },
    select: {
      id: true, makeJobId: true,
      fabricIssuedM: true, liningIssuedM: true,
      // Confirm the line lives under the caller's tenant — MakeJobLine
      // has no orgId of its own, so scope through the parent MakeJob.
      makeJob: { select: { orgId: true } },
    },
  });
  if (!line || line.makeJob.orgId !== ctx.orgId) return { ok: false, error: "Line not found" };

  await withTransaction(async (tx: TxClient) => {
    await tx.makeJobLine.update({
      where: { id: lineId },
      data: {
        ...(fabricIssuedM != null && { fabricIssuedM: new Prisma.Decimal(fabricIssuedM) }),
        ...(liningIssuedM != null && { liningIssuedM: new Prisma.Decimal(liningIssuedM) }),
      },
    });
    await tx.auditLog.create({
      data: {
        orgId:      ctx.orgId,
        actorId:    ctx.userId,
        entityType: "MakeJobLine",
        entityId:   lineId,
        action:     "ISSUE_MATERIAL",
        before: {
          fabricIssuedM: line.fabricIssuedM?.toString() ?? null,
          liningIssuedM: line.liningIssuedM?.toString() ?? null,
        },
        after: {
          ...(fabricIssuedM != null && { fabricIssuedM: fabricIssuedM.toString() }),
          ...(liningIssuedM != null && { liningIssuedM: liningIssuedM.toString() }),
        },
      },
    });
  });

  safeRevalidate(`/make/${line.makeJobId}`);
  return { ok: true, data: { lineId } };
}

// ── 5b — per-line usage capture (post-cut, tailor's actual) ──────

export async function recordMakeJobLineUsage(
  input: unknown,
): Promise<ActionResult<{ lineId: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "make.recordUsage");

  const parsed = recordUsageSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { lineId, actualUsedM, wastageM } = parsed.data;

  const db = scoped(ctx);
  const line = await db.makeJobLine.findUnique({
    where:  { id: lineId },
    select: {
      id: true, makeJobId: true, fabricIssuedM: true,
      actualUsedM: true, wastageM: true,
      makeJob: { select: { orgId: true } },
    },
  });
  if (!line || line.makeJob.orgId !== ctx.orgId) return { ok: false, error: "Line not found" };
  // Wastage defaults to (issued − used) when the tailor doesn't type it
  // in explicitly — matches how the shop floor already thinks about it.
  const derivedWastage = wastageM != null
    ? wastageM
    : line.fabricIssuedM != null
      ? Math.max(0, Number(line.fabricIssuedM) - actualUsedM)
      : null;

  await withTransaction(async (tx: TxClient) => {
    await tx.makeJobLine.update({
      where: { id: lineId },
      data: {
        actualUsedM: new Prisma.Decimal(actualUsedM),
        ...(derivedWastage != null && { wastageM: new Prisma.Decimal(derivedWastage) }),
      },
    });
    await tx.auditLog.create({
      data: {
        orgId:      ctx.orgId,
        actorId:    ctx.userId,
        entityType: "MakeJobLine",
        entityId:   lineId,
        action:     "RECORD_USAGE",
        before: {
          actualUsedM: line.actualUsedM?.toString() ?? null,
          wastageM:    line.wastageM?.toString()    ?? null,
        },
        after: {
          actualUsedM: actualUsedM.toString(),
          ...(derivedWastage != null && { wastageM: derivedWastage.toString() }),
        },
      },
    });
  });

  safeRevalidate(`/make/${line.makeJobId}`);
  return { ok: true, data: { lineId } };
}

// ── 5b — per-line QC ────────────────────────────────────────────

export async function qcMakeJobLine(
  input: unknown,
): Promise<ActionResult<{ lineId: string; passed: boolean }>> {
  const ctx = await devContext();
  requirePermission(ctx, "make.qcPass");

  const parsed = qcLineSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { lineId, passed, notes } = parsed.data;

  const db = scoped(ctx);
  const line = await db.makeJobLine.findUnique({
    where:  { id: lineId },
    select: { id: true, makeJobId: true, qcPassed: true },
  });
  if (!line) return { ok: false, error: "Line not found" };

  await withTransaction(async (tx: TxClient) => {
    await tx.makeJobLine.update({
      where: { id: lineId },
      data: {
        qcPassed: passed,
        ...(notes != null && { qcNotes: notes }),
      },
    });
    await tx.auditLog.create({
      data: {
        orgId:      ctx.orgId,
        actorId:    ctx.userId,
        entityType: "MakeJobLine",
        entityId:   lineId,
        action:     passed ? "QC_PASS" : "QC_FAIL",
        before:     { qcPassed: line.qcPassed },
        after:      { qcPassed: passed, ...(notes != null && { qcNotes: notes }) },
      },
    });
  });

  safeRevalidate(`/make/${line.makeJobId}`);
  return { ok: true, data: { lineId, passed } };
}

// ── helpers ──────────────────────────────────────────────────────

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

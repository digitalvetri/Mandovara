"use server";

// Install server actions (§5.2, Phase 5c).
//
// The visit is the unit — one InstallVisit per (order, scheduled
// day). A single order can have many visits (partial installs across
// dates). InstallLines materialise at visit-create time from the
// OrderLine PENDING quantity so the installer sees exactly what
// remains to install.
//
// Load-bearing invariants:
//   1. §5.2 — SUM(InstallLine.installedQty) across visits per
//      OrderLine cannot exceed OrderLine.orderedQty. Enforced inside
//      completeInstallLine with SELECT FOR UPDATE, mirroring the
//      over-dispatch guard in orders/actions.createDispatch.
//   2. OrderLine.installedQty (materialised) stays consistent with
//      that sum. Updated in the same tx as the InstallLine write.
//   3. completeVisit soft-gates on all lines having their make-jobs
//      DELIVERED — refusing at complete time, not schedule time, so
//      the office can plan ahead of the shop floor.
//   4. Each transition writes an AuditLog row.

import type { z } from "zod";
import { revalidatePath } from "next/cache";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { allocateNumber, Prisma } from "@/kernel/numbering/series";
import { financialYear } from "@/kernel/datetime";
import { devContext } from "@/lib/dev-context";
import {
  createInstallVisitSchema,
  assignCrewSchema,
  startVisitSchema,
  completeInstallLineSchema,
  captureSignatureSchema,
  completeVisitSchema,
  raiseSnagOnVisitSchema,
} from "./schema";

function safeRevalidate(path: string): void {
  try { revalidatePath(path); } catch { /* not in a Next request */ }
}

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

// ── createInstallVisit ───────────────────────────────────────────
// Materialises one InstallLine per OrderLine with pending qty
// (orderedQty − installedQty). Refuses if there's nothing left to
// install for the order.
export async function createInstallVisit(
  input: unknown,
): Promise<ActionResult<{ id: string; number: string; lineCount: number }>> {
  const ctx = await devContext();
  requirePermission(ctx, "install.createVisit");

  const parsed = createInstallVisitSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { salesOrderId, scheduledAt, crewId, orderLineIds, notes } = parsed.data;

  const db = scoped(ctx);
  const order = await db.salesOrder.findUnique({
    where:  { id: salesOrderId },
    select: {
      id: true, branchId: true, status: true,
      lines: {
        orderBy: { lineNo: "asc" },
        select: {
          id: true, orderedQty: true, installedQty: true, description: true,
          measurement: { select: { roomLabel: true } },
        },
      },
    },
  });
  if (!order)  return { ok: false, error: "Order not found" };
  if (order.status === "CANCELLED") {
    return { ok: false, error: "Order is CANCELLED — cannot schedule install" };
  }
  const branch = await db.branch.findUniqueOrThrow({
    where:  { id: order.branchId },
    select: { invoicePrefix: true },
  });

  // Pick which order lines to schedule + how many units are pending.
  const candidates = order.lines
    .filter((l) => orderLineIds == null || orderLineIds.includes(l.id))
    .map((l) => ({
      id: l.id, description: l.description,
      roomLabel: l.measurement?.roomLabel ?? l.description,
      pending: l.orderedQty.minus(l.installedQty),
    }))
    .filter((l) => l.pending.gt(0));

  if (candidates.length === 0) {
    return {
      ok: false,
      error: "Nothing pending on this order — every line is already fully installed",
    };
  }

  const scheduled = new Date(scheduledAt);
  const created = await withTransaction(async (tx: TxClient) => {
    const number = await allocateNumber(tx, {
      orgId:         ctx.orgId,
      branchId:      order.branchId,
      docType:       "INSTALL_VISIT",
      financialYear: financialYear(scheduled),
      prefix:        `${branch.invoicePrefix}/INS`,
    });
    const visit = await tx.installVisit.create({
      data: {
        orgId:        ctx.orgId,
        number,
        salesOrderId: order.id,
        ...(crewId != null && { crewId }),
        scheduledAt:  scheduled,
        status:       "SCHEDULED",
        photoKeys:    [],
        ...(notes != null && notes.length > 0 && { notes }),
        createdById:  ctx.userId,
      },
      select: { id: true, number: true },
    });
    await tx.installLine.createMany({
      data: candidates.map((c) => ({
        installVisitId: visit.id,
        orderLineId:    c.id,
        roomLabel:      c.roomLabel,
        plannedQty:     c.pending,
        photoKeys:      [],
        remoteSerials:  [],
      })),
    });
    await tx.auditLog.create({
      data: {
        orgId: ctx.orgId, actorId: ctx.userId,
        entityType: "InstallVisit", entityId: visit.id,
        action: "CREATE_VISIT",
        after: {
          number: visit.number,
          scheduledAt: scheduled.toISOString(),
          lineCount: candidates.length,
        },
      },
    });
    return visit;
  });

  safeRevalidate("/install");
  safeRevalidate(`/orders/${order.id}`);
  return {
    ok: true,
    data: { id: created.id, number: created.number, lineCount: candidates.length },
  };
}

// ── assignCrew (or unassign) ─────────────────────────────────────
export async function assignCrew(input: unknown): Promise<ActionResult<{ visitId: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "install.assignCrew");
  const parsed = assignCrewSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { visitId, crewId } = parsed.data;

  const db = scoped(ctx);
  const visit = await db.installVisit.findUnique({
    where: { id: visitId }, select: { id: true, crewId: true },
  });
  if (!visit) return { ok: false, error: "Visit not found" };

  await withTransaction(async (tx: TxClient) => {
    await tx.installVisit.update({ where: { id: visitId }, data: { crewId } });
    await tx.auditLog.create({
      data: {
        orgId: ctx.orgId, actorId: ctx.userId,
        entityType: "InstallVisit", entityId: visitId,
        action: "ASSIGN_CREW",
        before: { crewId: visit.crewId },
        after:  { crewId },
      },
    });
  });

  safeRevalidate("/install");
  safeRevalidate(`/install/${visitId}`);
  return { ok: true, data: { visitId } };
}

// ── startVisit (SCHEDULED → IN_PROGRESS) ─────────────────────────
export async function startVisit(input: unknown): Promise<ActionResult<{ visitId: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "install.startVisit");
  const parsed = startVisitSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { visitId } = parsed.data;

  const db = scoped(ctx);
  const v = await db.installVisit.findUnique({
    where: { id: visitId }, select: { id: true, status: true, startedAt: true },
  });
  if (!v) return { ok: false, error: "Visit not found" };
  if (v.status !== "SCHEDULED") {
    return { ok: false, error: `Cannot start a visit in status ${v.status}` };
  }

  await withTransaction(async (tx: TxClient) => {
    await tx.installVisit.update({
      where: { id: visitId },
      data:  { status: "IN_PROGRESS", startedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        orgId: ctx.orgId, actorId: ctx.userId,
        entityType: "InstallVisit", entityId: visitId,
        action: "START_VISIT",
        before: { status: v.status }, after: { status: "IN_PROGRESS" },
      },
    });
  });

  safeRevalidate("/install");
  safeRevalidate(`/install/${visitId}`);
  return { ok: true, data: { visitId } };
}

// ── completeInstallLine — the load-bearing action ────────────────
// - SELECT FOR UPDATE on the OrderLine so parallel completeLine
//   calls cannot both see a stale `installedQty` and both write over.
// - Sum existing InstallLine.installedQty (across all visits) plus
//   the caller's new qty, refuse if > orderLine.orderedQty.
// - Update BOTH the InstallLine and the materialised OrderLine
//   counter in the same tx.
export async function completeInstallLine(
  input: unknown,
): Promise<ActionResult<{ lineId: string; installedQty: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "install.completeLine");

  const parsed = completeInstallLineSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { lineId, installedQty, dyeLotUsed, photoKeys, remoteSerials, issue } = parsed.data;

  const db = scoped(ctx);
  const line = await db.installLine.findUnique({
    where: { id: lineId },
    select: {
      id: true, orderLineId: true, installVisitId: true,
      installedQty: true, plannedQty: true,
      visit: { select: { orgId: true, status: true } },
    },
  });
  if (!line || line.visit.orgId !== ctx.orgId) {
    return { ok: false, error: "Install line not found" };
  }
  if (line.visit.status === "COMPLETED" || line.visit.status === "CANCELLED") {
    return { ok: false, error: `Visit is ${line.visit.status} — cannot edit lines` };
  }

  const deltaQ = new Prisma.Decimal(installedQty);

  const result = await withTransaction(async (tx: TxClient) => {
    // Lock the parent OrderLine so the invariant check is race-free.
    const locked = await tx.$queryRaw<{
      id: string; orderedQty: string; installedQty: string;
    }[]>`
      SELECT id, "orderedQty"::text, "installedQty"::text
      FROM "OrderLine" WHERE id = ${line.orderLineId} FOR UPDATE
    `;
    const row = locked[0];
    if (!row) throw new Error("OrderLine vanished under us");
    const ordered = new Prisma.Decimal(row.orderedQty);
    const alreadyInstalled = new Prisma.Decimal(row.installedQty);
    const newLineQty = line.installedQty.add(deltaQ);
    const newOrderQty = alreadyInstalled.add(deltaQ);
    if (newOrderQty.gt(ordered)) {
      return {
        _error: true as const,
        msg: `Over-install blocked — order line permits ${ordered.toString()} total, ` +
             `${alreadyInstalled.toString()} already installed, this delta ${deltaQ.toString()} would exceed.`,
      };
    }

    await tx.installLine.update({
      where: { id: lineId },
      data: {
        installedQty: newLineQty,
        ...(dyeLotUsed    != null && { dyeLotUsed }),
        ...(photoKeys     != null && { photoKeys }),
        ...(remoteSerials != null && { remoteSerials }),
        ...(issue         != null && { issue }),
      },
    });
    await tx.orderLine.update({
      where: { id: line.orderLineId },
      data:  { installedQty: newOrderQty },
    });
    await tx.auditLog.create({
      data: {
        orgId: ctx.orgId, actorId: ctx.userId,
        entityType: "InstallLine", entityId: lineId,
        action: "COMPLETE_LINE",
        before: { installedQty: line.installedQty.toString() },
        after: {
          installedQty: newLineQty.toString(),
          ...(dyeLotUsed != null && { dyeLotUsed }),
          ...(issue      != null && { issue }),
        },
      },
    });
    return { newLineQty };
  });

  if ("_error" in result) {
    const msg = result.msg ?? "Over-install blocked";
    return { ok: false, error: msg, fieldErrors: { installedQty: msg } };
  }

  safeRevalidate(`/install/${line.installVisitId}`);
  return { ok: true, data: { lineId, installedQty: result.newLineQty.toString() } };
}

// ── captureSignature ────────────────────────────────────────────
export async function captureVisitSignature(
  input: unknown,
): Promise<ActionResult<{ visitId: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "install.captureSignature");
  const parsed = captureSignatureSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { visitId, signatureKey } = parsed.data;

  const db = scoped(ctx);
  const v = await db.installVisit.findUnique({
    where: { id: visitId }, select: { id: true, clientSignatureKey: true },
  });
  if (!v) return { ok: false, error: "Visit not found" };

  await withTransaction(async (tx: TxClient) => {
    await tx.installVisit.update({
      where: { id: visitId }, data: { clientSignatureKey: signatureKey },
    });
    await tx.auditLog.create({
      data: {
        orgId: ctx.orgId, actorId: ctx.userId,
        entityType: "InstallVisit", entityId: visitId,
        action: "CAPTURE_SIGNATURE",
        before: { clientSignatureKey: v.clientSignatureKey },
        after:  { clientSignatureKey: signatureKey },
      },
    });
  });

  safeRevalidate(`/install/${visitId}`);
  return { ok: true, data: { visitId } };
}

// ── completeVisit (IN_PROGRESS → COMPLETED | PARTIAL) ───────────
// Soft gates:
//   - visit must be IN_PROGRESS
//   - signature must be captured
//   - at least one InstallLine must have installedQty > 0
export async function completeVisit(
  input: unknown,
): Promise<ActionResult<{ visitId: string; status: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "install.completeVisit");
  const parsed = completeVisitSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { visitId, outcome } = parsed.data;

  const db = scoped(ctx);
  const v = await db.installVisit.findUnique({
    where: { id: visitId },
    select: {
      id: true, status: true, clientSignatureKey: true, salesOrderId: true,
      lines: { select: { installedQty: true } },
    },
  });
  if (!v) return { ok: false, error: "Visit not found" };
  if (v.status !== "IN_PROGRESS") {
    return { ok: false, error: `Cannot complete a visit in status ${v.status}` };
  }
  if (v.clientSignatureKey == null) {
    return { ok: false, error: "Client signature required before completion" };
  }
  const anyDone = v.lines.some((l) => l.installedQty.gt(0));
  if (!anyDone) {
    return { ok: false, error: "No lines installed — cannot complete a visit with zero progress" };
  }
  // Soft gate: if the order has a make job, it must be DELIVERED
  // before we mark the install complete. Orders with no make job
  // (all-hardware) pass through — nothing to check.
  const makeJob = await db.makeJob.findUnique({
    where:  { salesOrderId: v.salesOrderId },
    select: { status: true, number: true },
  });
  if (makeJob && makeJob.status !== "DELIVERED") {
    return {
      ok: false,
      error: `Make job ${makeJob.number} is ${makeJob.status} — must be DELIVERED before install completion`,
    };
  }

  await withTransaction(async (tx: TxClient) => {
    await tx.installVisit.update({
      where: { id: visitId },
      data:  { status: outcome, completedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        orgId: ctx.orgId, actorId: ctx.userId,
        entityType: "InstallVisit", entityId: visitId,
        action: `COMPLETE_${outcome}`,
        before: { status: v.status }, after: { status: outcome },
      },
    });
  });

  safeRevalidate("/install");
  safeRevalidate(`/install/${visitId}`);
  return { ok: true, data: { visitId, status: outcome } };
}

// ── raiseSnagOnVisit ─────────────────────────────────────────────
// Creates a SnagItem tied to the visit's project. Persists the
// visit-linked context in the description so the office can trace it
// back without a formal Snag↔Visit FK (SnagItem is project-scoped;
// visits belong to the same project via SalesOrder → Client →
// projects).
export async function raiseSnagOnVisit(
  input: unknown,
): Promise<ActionResult<{ snagId: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "snag.create");

  const parsed = raiseSnagOnVisitSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { visitId, location, description, photoKeys } = parsed.data;

  const db = scoped(ctx);
  const visit = await db.installVisit.findUnique({
    where: { id: visitId },
    select: {
      id: true, number: true,
      salesOrder: { select: { client: { select: { projects: { select: { id: true }, take: 1 } } } } },
    },
  });
  if (!visit) return { ok: false, error: "Visit not found" };
  const projectId: string | undefined = visit.salesOrder.client.projects[0]?.id;
  if (projectId == null) {
    return { ok: false, error: "No project on this client — cannot file snag" };
  }

  const snag = await db.snagItem.create({
    data: {
      projectId,
      location,
      description: `[Visit ${visit.number}] ${description}`,
      status:      "OPEN",
      raisedById:  ctx.userId,
      raisedAt:    new Date(),
      ...(photoKeys != null && { photos: photoKeys.map((k) => ({ fileKey: k })) }),
    },
    select: { id: true },
  });

  safeRevalidate(`/install/${visitId}`);
  safeRevalidate("/installations");
  return { ok: true, data: { snagId: snag.id } };
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

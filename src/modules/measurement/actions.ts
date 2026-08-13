"use server";

// Measurement ROUND lifecycle — start / submit / approve / revise +
// createRoom helper.  Item lifecycle (add / update / delete / sync) is
// in actions-item.ts, shared helpers in actions-shared.ts. Split so
// every file stays under CLAUDE.md §10's 300-line ceiling.
//
// §6 rules enforced here:
//   1. Dimensions live in mm (schema); UI converts only via /lib/units.
//   2. CalcResult is superseded on every item change (see actions-item).
//   5. Edit scope: measurement.update gates *may*; canEditRound narrows
//      *which*. Owners/Designers with measurement.approve can edit any
//      round.
//   6. A revised round sets supersedesId + revision+1 on the new row;
//      the parent stays intact (§6.6 rounds are never edited or deleted).

import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { requirePermission } from "@/kernel/rbac/guard";
import { allocateNumber, yymmFromDate } from "@/kernel/numbering/series";
import { devContext } from "@/lib/dev-context";
import {
  startRoundSchema, submitRoundSchema, approveRoundSchema, reviseRoundSchema,
  createRoomSchema,
} from "./schema";
import { type ActionResult, zodError, canEditRound } from "./actions-shared";

export async function startMeasurementRound(
  input: unknown,
): Promise<ActionResult<{ id: string; number: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "measurement.create");
  const parsed = startRoundSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const project = await db.project.findUnique({
    where:  { id: d.projectId },
    select: { id: true, branchId: true },
  });
  if (!project) return { ok: false, error: "Project not found" };
  const branch = await db.branch.findUnique({
    where:  { id: project.branchId },
    select: { invoicePrefix: true },
  });
  if (!branch) return { ok: false, error: "Project branch not found" };

  const round = await withTransaction(async (tx: TxClient) => {
    const number = await allocateNumber(tx, {
      orgId:  ctx.orgId,
      series: "MEA",
      yymm:   yymmFromDate(d.visitedAt),
      prefix: branch.invoicePrefix,
    });
    return tx.measurement.create({
      data: {
        organizationId: ctx.orgId,
        projectId:      d.projectId,
        number,
        siteVisitId:    d.siteVisitId ?? null,
        visitedAt:      d.visitedAt,
        measuredById:   ctx.userId,
        status:         "DRAFT",
        notes:          d.notes ?? null,
      },
      select: { id: true, number: true },
    });
  });

  revalidatePath(`/projects/${d.projectId}/measurements`);
  return { ok: true, data: round };
}

export async function submitMeasurementRound(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "measurement.submit");
  const parsed = submitRoundSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { measurementId } = parsed.data;

  const db = scoped(ctx);
  const round = await db.measurement.findUnique({
    where:  { id: measurementId },
    select: {
      id: true, status: true, measuredById: true, projectId: true,
      items: { select: { id: true }, take: 1 },
    },
  });
  if (!round) return { ok: false, error: "Measurement round not found" };
  if (round.status !== "DRAFT") {
    return { ok: false, error: `Cannot submit a round in ${round.status} status.` };
  }
  if (round.items.length === 0) {
    return { ok: false, error: "Cannot submit an empty round — add at least one item first." };
  }
  if (!canEditRound(ctx, round.measuredById)) {
    return { ok: false, error: "Only the measurer, project owner, or a Designer/Owner may submit this round." };
  }

  await db.measurement.update({ where: { id: measurementId }, data: { status: "SUBMITTED" } });
  revalidatePath(`/projects/${round.projectId}/measurements`);
  revalidatePath(`/projects/${round.projectId}/measurements/${measurementId}`);
  return { ok: true, data: { id: measurementId } };
}

export async function approveMeasurementRound(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "measurement.approve");
  const parsed = approveRoundSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { measurementId } = parsed.data;

  const db = scoped(ctx);
  const round = await db.measurement.findUnique({
    where:  { id: measurementId },
    select: { id: true, status: true, projectId: true },
  });
  if (!round) return { ok: false, error: "Measurement round not found" };
  if (round.status !== "SUBMITTED") {
    return { ok: false, error: `Only SUBMITTED rounds can be approved (this one is ${round.status}).` };
  }

  await db.measurement.update({
    where: { id: measurementId },
    data:  { status: "APPROVED", approvedById: ctx.userId, approvedAt: new Date() },
  });
  revalidatePath(`/projects/${round.projectId}/measurements`);
  revalidatePath(`/projects/${round.projectId}/measurements/${measurementId}`);
  return { ok: true, data: { id: measurementId } };
}

export async function reviseMeasurementRound(
  input: unknown,
): Promise<ActionResult<{ id: string; number: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "measurement.revise");
  const parsed = reviseRoundSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const parent = await db.measurement.findUnique({
    where:  { id: d.parentMeasurementId },
    select: { id: true, projectId: true, revision: true, status: true },
  });
  if (!parent) return { ok: false, error: "Parent measurement round not found" };
  if (parent.status !== "APPROVED") {
    return { ok: false, error: "Only APPROVED rounds can be revised — draft or submitted rounds should be edited directly." };
  }

  const project = await db.project.findUnique({
    where:  { id: parent.projectId },
    select: { branchId: true },
  });
  const branch = project
    ? await db.branch.findUnique({ where: { id: project.branchId }, select: { invoicePrefix: true } })
    : null;
  if (!branch) return { ok: false, error: "Project branch not found" };

  const next = await withTransaction(async (tx: TxClient) => {
    const number = await allocateNumber(tx, {
      orgId:  ctx.orgId,
      series: "MEA",
      yymm:   yymmFromDate(d.visitedAt),
      prefix: branch.invoicePrefix,
    });
    return tx.measurement.create({
      data: {
        organizationId: ctx.orgId,
        projectId:      parent.projectId,
        number,
        supersedesId:   parent.id,
        revision:       parent.revision + 1,
        visitedAt:      d.visitedAt,
        measuredById:   ctx.userId,
        status:         "DRAFT",
        notes:          d.notes ?? null,
      },
      select: { id: true, number: true },
    });
  });

  revalidatePath(`/projects/${parent.projectId}/measurements`);
  return { ok: true, data: next };
}

export async function createRoom(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "measurement.create");
  const parsed = createRoomSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const project = await db.project.findUnique({
    where:  { id: d.projectId },
    select: { id: true },
  });
  if (!project) return { ok: false, error: "Project not found" };

  const last = await db.room.findFirst({
    where:   { projectId: d.projectId },
    orderBy: { sortOrder: "desc" },
    select:  { sortOrder: true },
  });
  const room = await db.room.create({
    data: {
      organizationId: ctx.orgId,
      projectId:      d.projectId,
      name:           d.name,
      floorLabel:     d.floorLabel ?? null,
      sortOrder:      (last?.sortOrder ?? 0) + 10,
    },
    select: { id: true },
  });
  revalidatePath(`/projects/${d.projectId}/measurements`);
  return { ok: true, data: room };
}

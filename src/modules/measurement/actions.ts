"use server";

// Measurement ROUND lifecycle — start / submit / approve / revise +
// Room creation lives in actions-room.ts. Item lifecycle (add / update /
// delete / sync) is
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
import { bus } from "@/kernel/events/bus";
import "@/kernel/events/register";
import {
  startRoundSchema, submitRoundSchema, approveRoundSchema, reviseRoundSchema,
} from "./schema";
import {
  type ActionResult, zodError, canEditRound, linkRoundToVisit,
  revalidateRound, branchPrefixForParty,
} from "./actions-shared";

// Result shape:
//   - ok + data + resumed  → caller may navigate to the round
//   - ok + needsRooms       → caller opens the room-setup sheet first
//   - !ok                   → error string, caller shows it
// The discriminant lets callers exhaust cases explicitly instead of
// juggling empty strings.
export type StartRoundOutcome =
  | { ok: true; needsRooms: true }
  | { ok: true; needsRooms?: false; data: { id: string; number: string; resumed: boolean } }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function startMeasurementRound(
  input: unknown,
): Promise<StartRoundOutcome> {
  const ctx = await devContext();
  // Scoped perms — `.create.any` (measurement team, designer) OR `.create.own`
  // (sales for their own visits). Legacy flat `measurement.create` still
  // grants during migration but new callers rely on the scoped keys.
  const canCreate =
    ctx.permissions.has("measurement.create.any") ||
    ctx.permissions.has("measurement.create.own") ||
    ctx.permissions.has("measurement.create");
  if (!canCreate) {
    // Preserve the standard ForbiddenError shape so existing catchers
    // (route boundary, tests) see the same 403 semantics.
    requirePermission(ctx, "measurement.create.any");
  }
  const parsed = startRoundSchema.safeParse(input);
  if (!parsed.success) {
    const z = zodError(parsed.error);
    return { ok: false, error: z.error ?? "Validation failed", fieldErrors: z.fieldErrors };
  }
  const d = parsed.data;

  const db = scoped(ctx);
  // The party filter every query below shares — a round is scoped to a
  // project or to a lead, never both (startRoundSchema enforces it, the
  // DB CHECK backs it up).
  const party = d.projectId
    ? { projectId: d.projectId, leadId: null }
    : { projectId: null, leadId: d.leadId ?? null };

  if (d.projectId) {
    const project = await db.project.findUnique({
      where: { id: d.projectId }, select: { id: true },
    });
    if (!project) return { ok: false, error: "Project not found" };
  } else {
    const lead = await db.lead.findUnique({
      where: { id: d.leadId ?? "" }, select: { id: true, convertedClientId: true },
    });
    if (!lead) return { ok: false, error: "Lead not found" };
    // A converted lead's rooms and rounds now live on its project. Sending
    // a new round to the dead lead record would strand it there.
    if (lead.convertedClientId) {
      return { ok: false, error: "This lead is now a client — measure from its project instead." };
    }
  }

  // Rooms guard — you cannot measure without at least one room. Signal
  // needsRooms and let the UI open the room-setup sheet before navigating
  // (spec §4).
  const room = await db.room.findFirst({ where: party, select: { id: true } });
  if (!room) return { ok: true, needsRooms: true };

  // Resume existing DRAFT by the same user — never create a second one.
  // Prevents "I clicked start twice" from splitting the round in two
  // separate numbered documents (spec §4 rule 3).
  const existingDraft = await db.measurement.findFirst({
    where:  { ...party, measuredById: ctx.userId, status: "DRAFT" },
    orderBy: { visitedAt: "desc" },
    select: { id: true, number: true },
  });
  if (existingDraft) {
    if (d.siteVisitId) await linkRoundToVisit(db, existingDraft.id, d.siteVisitId);
    return {
      ok: true,
      data: { id: existingDraft.id, number: existingDraft.number, resumed: true },
    };
  }

  const prefix = await branchPrefixForParty(db, party);
  if (!prefix) return { ok: false, error: "No branch is configured — add one in Settings before measuring." };

  const round = await withTransaction(async (tx: TxClient) => {
    const number = await allocateNumber(tx, {
      orgId:  ctx.orgId,
      series: "MEA",
      yymm:   yymmFromDate(d.visitedAt),
      prefix,
    });
    return tx.measurement.create({
      data: {
        organizationId: ctx.orgId,
        ...party,
        number,
        siteVisitId:    d.siteVisitId ?? null,
        visitedAt:      d.visitedAt,
        measuredById:   ctx.userId,
        status:         "DRAFT",
        notes:          d.notes ?? null,
      },
      select: { id: true, number: true },
    });
  }, { orgId: ctx.orgId });

  revalidateRound(revalidatePath, party);
  return { ok: true, data: { ...round, resumed: false } };
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
    select: { id: true, status: true, projectId: true, leadId: true },
  });
  if (!round) return { ok: false, error: "Measurement round not found" };
  if (round.status !== "SUBMITTED") {
    return { ok: false, error: `Only SUBMITTED rounds can be approved (this one is ${round.status}).` };
  }

  await db.measurement.update({
    where: { id: measurementId },
    data:  { status: "APPROVED", approvedById: ctx.userId, approvedAt: new Date() },
  });

  // Fires kernel/milestones/listeners:onMeasurementApproved which ticks
  // the MEASUREMENT milestone AND advances the project stage MEASUREMENT
  // → QUOTATION (guarded — won't regress a project past QUOTATION).
  // Only project rounds publish. The listener ticks a MEASUREMENT
  // milestone and advances a ProjectStage — a lead has neither, so
  // firing it with an empty projectId would be a no-op at best and a
  // wrong-project tick at worst. A lead round's approval matters at
  // conversion, when its rounds are reparented onto the new project.
  if (round.projectId) {
    await bus.publish({
      type:       "measurement.approved",
      orgId:      ctx.orgId,
      actorId:    ctx.userId,
      occurredAt: new Date(),
      measurementId,
      projectId:  round.projectId,
    });
  }

  revalidateRound(revalidatePath, round, measurementId);
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
    select: { id: true, projectId: true, leadId: true, revision: true, status: true },
  });
  if (!parent) return { ok: false, error: "Parent measurement round not found" };
  if (parent.status !== "APPROVED") {
    return { ok: false, error: "Only APPROVED rounds can be revised — draft or submitted rounds should be edited directly." };
  }

  const prefix = await branchPrefixForParty(db, parent);
  if (!prefix) return { ok: false, error: "No branch is configured — add one in Settings before revising a round." };

  const next = await withTransaction(async (tx: TxClient) => {
    const number = await allocateNumber(tx, {
      orgId:  ctx.orgId,
      series: "MEA",
      yymm:   yymmFromDate(d.visitedAt),
      prefix,
    });
    return tx.measurement.create({
      data: {
        organizationId: ctx.orgId,
        // A revision stays with whichever party the parent belonged to.
        projectId:      parent.projectId,
        leadId:         parent.leadId,
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
  }, { orgId: ctx.orgId });

  revalidateRound(revalidatePath, parent);
  return { ok: true, data: next };
}

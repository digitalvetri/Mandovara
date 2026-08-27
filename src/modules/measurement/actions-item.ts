"use server";

// MeasurementItem lifecycle — add / update / delete / sync.
//
// Split out of actions.ts to keep both files under CLAUDE.md §10's
// 300-line ceiling. Round lifecycle lives in actions.ts.
//
// §6.2 rule: CalcResult is superseded on every change — the previous
// row is deleted and a fresh one written inside the same transaction,
// carrying the CURRENT engineVersion.

import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import {
  addItemSchema, updateItemSchema, deleteItemSchema, syncItemSchema, pickProductSchema,
} from "./schema";
import {
  type ActionResult, zodError, canEditRound,
  itemCreateData, itemUpdateData, writeCalc, computeCalcRow,
  revalidateRound, sameParty,
} from "./actions-shared";

export async function addMeasurementItem(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "measurement.create");
  const parsed = addItemSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const round = await db.measurement.findUnique({
    where:  { id: d.measurementId },
    select: { id: true, status: true, projectId: true, leadId: true, measuredById: true },
  });
  if (!round) return { ok: false, error: "Measurement round not found" };
  if (round.status !== "DRAFT") {
    return { ok: false, error: `Cannot add items to a ${round.status} round.` };
  }
  if (!canEditRound(ctx, round.measuredById)) {
    return { ok: false, error: "You are not authorised to edit this round." };
  }

  const room = await db.room.findUnique({
    where:  { id: d.roomId },
    select: { id: true, projectId: true, leadId: true },
  });
  // Compare BOTH sides of the party XOR. Comparing projectId alone was
  // correct while every round had a project; once leads became
  // measurable (2026-08-27) two lead-scoped rows both have
  // projectId === null, so `!==` is false and the guard would wave
  // through any lead's room onto any other lead's round.
  if (!room || !sameParty(room, round)) {
    return { ok: false, error: "Room does not belong to this round's project or lead." };
  }

  const calc = computeCalcRow(d);

  const created = await withTransaction(async (tx: TxClient) => {
    const item = await tx.measurementItem.create({
      data:   itemCreateData(ctx.orgId, d),
      select: { id: true },
    });
    // Skip when width/height weren't provided — the office-side form
    // now accepts qty-only entries and there's no meaningful calc to
    // persist. The item still exists; it just carries no CalcResult.
    if (calc) await writeCalc(tx, ctx.orgId, item.id, calc);
    return item;
  }, { orgId: ctx.orgId });

  revalidatePath(`/projects/${round.projectId}/measurements/${d.measurementId}`);
  return { ok: true, data: created };
}

export async function updateMeasurementItem(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "measurement.update");
  const parsed = updateItemSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const existing = await db.measurementItem.findUnique({
    where:  { id: d.id },
    select: {
      id: true, measurementId: true,
      measurement: { select: { status: true, projectId: true, measuredById: true } },
    },
  });
  if (!existing) return { ok: false, error: "Measurement item not found" };
  if (existing.measurement.status !== "DRAFT") {
    return { ok: false, error: `Cannot edit items in a ${existing.measurement.status} round.` };
  }
  if (!canEditRound(ctx, existing.measurement.measuredById)) {
    return { ok: false, error: "You are not authorised to edit this round." };
  }

  const calc = computeCalcRow(d);

  await withTransaction(async (tx: TxClient) => {
    await tx.measurementItem.update({
      where: { id: d.id },
      data:  itemUpdateData(d),
    });
    // §6.2 supersede — delete the old row, insert a fresh one carrying
    // the current engineVersion. Unique index on measurementItemId keeps
    // "at most one live CalcResult per item" as an invariant. When the
    // updated form has no dimensions we just delete the old calc row.
    await tx.calcResult.deleteMany({ where: { measurementItemId: d.id } });
    if (calc) await writeCalc(tx, ctx.orgId, d.id, calc);
  }, { orgId: ctx.orgId });

  revalidatePath(`/projects/${existing.measurement.projectId}/measurements/${existing.measurementId}`);
  return { ok: true, data: { id: d.id } };
}

export async function deleteMeasurementItem(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "measurement.delete");
  const parsed = deleteItemSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id } = parsed.data;

  const db = scoped(ctx);
  const existing = await db.measurementItem.findUnique({
    where:  { id },
    select: {
      id: true, measurementId: true,
      measurement: { select: { status: true, projectId: true, measuredById: true } },
    },
  });
  if (!existing) return { ok: false, error: "Measurement item not found" };
  if (existing.measurement.status !== "DRAFT") {
    return { ok: false, error: `Cannot delete items from a ${existing.measurement.status} round.` };
  }
  if (!canEditRound(ctx, existing.measurement.measuredById)) {
    return { ok: false, error: "You are not authorised to edit this round." };
  }

  await db.measurementItem.delete({ where: { id } });
  revalidatePath(`/projects/${existing.measurement.projectId}/measurements/${existing.measurementId}`);
  return { ok: true, data: { id } };
}

// Attach a Colourway to a MeasurementItem. Updates CalcResult.colourwayId
// (creates a minimal CalcResult row if the item doesn't have one yet).
// No round-status gate — designers pick / swap colours at any stage.
// Returns measurementId + projectId so the caller can navigate back.
export async function pickProductForMeasurementItem(
  input: unknown,
): Promise<ActionResult<{ measurementId: string; projectId: string | null }>> {
  const ctx = await devContext();
  requirePermission(ctx, "measurement.update");
  const parsed = pickProductSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { measurementItemId, colourwayId } = parsed.data;

  const db = scoped(ctx);
  const item = await db.measurementItem.findUnique({
    where:  { id: measurementItemId },
    select: {
      id: true, measurementId: true, family: true,
      widthMm: true, heightMm: true, quantity: true,
      measurement: { select: { projectId: true, leadId: true } },
      calc: { select: { id: true } },
    },
  });
  if (!item) return { ok: false, error: "Measurement item not found" };

  // Cross-check the colourway is real and reachable in this org.
  const cw = await db.colourway.findUnique({
    where:  { id: colourwayId },
    select: { id: true, sellUnit: true, design: { select: { family: true } } },
  });
  if (!cw) return { ok: false, error: "Colourway not found" };

  if (item.calc) {
    await db.calcResult.update({
      where: { id: item.calc.id },
      data:  { colourwayId },
    });
  } else {
    // Minimal placeholder CalcResult — the full engine run happens when
    // dimensions change (updateMeasurementItem). We only need the link.
    await db.calcResult.create({
      data: {
        organizationId:    ctx.orgId,
        measurementItemId,
        colourwayId,
        engineVersion:     `${item.family.toLowerCase()}@stub`,
        inputs:            {},
        materialQty:       "0",
        materialUnit:      cw.sellUnit,
      },
    });
  }

  revalidateRound(revalidatePath, item.measurement, item.measurementId);
  return {
    ok:   true,
    // null for a lead-scoped round — callers use it only to build a
    // project href, and the lead paths don't need one.
    data: { measurementId: item.measurementId, projectId: item.measurement.projectId ?? null },
  };
}

// Sync path for the field PWA's offline outbox drain. Idempotent on
// clientCuid — replaying a queued row is safe because we check
// existence first and route to update if we've seen this cuid.
export async function syncMeasurementItem(
  input: unknown,
): Promise<ActionResult<{ id: string; created: boolean }>> {
  const ctx = await devContext();
  requirePermission(ctx, "measurement.create");
  const parsed = syncItemSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const existing = await db.measurementItem.findUnique({
    where:  { id: d.clientCuid },
    select: { id: true },
  });
  if (existing) {
    const r = await updateMeasurementItem({ ...d, id: d.clientCuid });
    if (!r.ok) return { ok: false, error: r.error, ...(r.fieldErrors && { fieldErrors: r.fieldErrors }) };
    return { ok: true, data: { id: d.clientCuid, created: false } };
  }
  const r = await addMeasurementItem(d);
  if (!r.ok) return { ok: false, error: r.error, ...(r.fieldErrors && { fieldErrors: r.fieldErrors }) };
  return { ok: true, data: { id: r.data?.id ?? d.clientCuid, created: true } };
}

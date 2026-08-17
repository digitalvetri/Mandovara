"use server";

// §5.5 conflict-resolution actions.
//
// Server-wins is the default (§7). When a measurer promotes their
// local version anyway, this action:
//   1. Requires measurement.approve — only senior staff can override
//      the server's rejection.
//   2. Bypasses the DRAFT-status guard that addMeasurementItem uses.
//      The round may be SUBMITTED or APPROVED — that's exactly why
//      the sync originally failed.
//   3. Writes a bespoke AuditLog row with action="MEASUREMENT_PROMOTE"
//      carrying the reason, so the override is traceable long after
//      the outbox rows are gone from the device.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { Prisma } from "@/kernel/numbering/series";
import { addItemSchema } from "./schema";
import { type ActionResult, zodError, itemCreateData, itemUpdateData, writeCalc, computeCalcRow } from "./actions-shared";
import { fetchServerItemsForConflict as fetchServerItemsRaw, type ServerItemSnapshot } from "./conflict-queries";

/** Server-action wrapper — the client component uses this to hydrate
 *  the review page. Delegates to the raw query so the ctx-plumbing
 *  stays in one place. */
export async function fetchServerItemsForConflict(ids: string[]): Promise<ServerItemSnapshot[]> {
  const ctx = await devContext();
  return fetchServerItemsRaw(ctx, ids);
}

const promoteSchema = z.object({
  payload: addItemSchema,
  reason:  z.string().trim().min(5, "Reason must be at least 5 characters").max(500),
});

export async function promoteLocalItem(input: unknown): Promise<ActionResult<{ id: string; created: boolean; roundStatus: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "measurement.approve");

  const parsed = promoteSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { payload, reason } = parsed.data;

  if (!payload.clientCuid) {
    return { ok: false, error: "clientCuid required — the outbox row must carry its stable id." };
  }

  const db = scoped(ctx);
  const round = await db.measurement.findUnique({
    where:  { id: payload.measurementId },
    select: { id: true, status: true, projectId: true, measuredById: true },
  });
  if (!round) return { ok: false, error: "Round not found" };

  const room = await db.room.findUnique({
    where:  { id: payload.roomId },
    select: { id: true, projectId: true },
  });
  if (!room || room.projectId !== round.projectId) {
    return { ok: false, error: "Room does not belong to this round's project." };
  }

  const existing = await db.measurementItem.findUnique({
    where:  { id: payload.clientCuid },
    select: { id: true },
  });
  const calc = computeCalcRow(payload);

  await withTransaction(async (tx: TxClient) => {
    if (existing) {
      await tx.measurementItem.update({
        where: { id: payload.clientCuid! },
        data:  itemUpdateData(payload),
      });
      await tx.calcResult.deleteMany({ where: { measurementItemId: payload.clientCuid } });
    } else {
      await tx.measurementItem.create({ data: itemCreateData(ctx.orgId, payload) });
    }
    await writeCalc(tx, ctx.orgId, payload.clientCuid!, calc);

    // Purpose-built audit row so history captures WHY the override
    // happened. The auto-audit already records the mutation; this
    // is the narrative layer.
    await tx.auditLog.create({
      data: {
        organizationId: ctx.orgId,
        actorId:        ctx.userId,
        entityType:     "MeasurementItem",
        entityId:       payload.clientCuid!,
        action:         "MEASUREMENT_PROMOTE",
        before:         { roundStatus: round.status } as Prisma.InputJsonValue,
        after: {
          reason,
          promotedInRoundStatus: round.status,
          measurementId:         round.id,
        } as Prisma.InputJsonValue,
      },
    });
  }, { orgId: ctx.orgId });

  revalidatePath(`/projects/${round.projectId}/measurements`);
  revalidatePath(`/projects/${round.projectId}/measurements/${round.id}`);
  return {
    ok:   true,
    data: {
      id:          payload.clientCuid,
      created:     !existing,
      roundStatus: round.status,
    },
  };
}

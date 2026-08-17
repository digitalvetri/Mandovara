"use server";

// Dye-lot allocation server actions (§0.6 sacred rule).
// Wraps allocateInTx with permission checks, audit logging, cache invalidation.

import type { z } from "zod";
import { revalidatePath } from "next/cache";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission, can } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { allocateLotSchema, releaseAllocationSchema } from "./schema";
import { allocateInTx, AllocationError } from "./core";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function allocateLots(
  input: unknown,
): Promise<ActionResult<{ id: string; mixedLotOverride: boolean }>> {
  const ctx = await devContext();
  requirePermission(ctx, "allocation.create");

  const parsed = allocateLotSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  try {
    const result = await withTransaction(async (tx: TxClient) => {
      const alloc = await allocateInTx(tx, {
        organizationId:   ctx.orgId,
        orderLineId:      d.orderLineId,
        stockBalanceId:   d.batchId,      // batchId = StockBalance.id in the UI
        quantity:         d.quantity,
        mixedLotOverride: d.mixedLotOverride,
        overrideReason:   d.overrideReason ?? null,
        actorId:          ctx.userId,
        actorCanOverride: can(ctx, "allocation.overrideMixedLot"),
      });

      await tx.auditLog.create({
        data: {
          organizationId: ctx.orgId,
          actorId:        ctx.userId,
          entityType:     "Allocation",
          entityId:       alloc.id,
          action:         alloc.wouldBeMixed ? "CREATE_MIXED_LOT" : "CREATE",
          after: {
            orderLineId: d.orderLineId,
            dyeLot:      alloc.dyeLot,
            quantity:    d.quantity.toString(),
            ...(alloc.wouldBeMixed && { overrideReason: d.overrideReason?.trim() }),
          },
        },
      });

      return alloc;
    }, { orgId: ctx.orgId });

    revalidatePath("/purchase/allocation");
    return {
      ok: true,
      data: { id: result.id, mixedLotOverride: result.wouldBeMixed },
    };
  } catch (err) {
    if (err instanceof AllocationError) {
      return {
        ok: false, error: err.message,
        ...(err.fieldKey && { fieldErrors: { [err.fieldKey]: err.message } }),
      };
    }
    throw err;
  }
}

export async function releaseAllocation(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "allocation.release");
  const parsed = releaseAllocationSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id } = parsed.data;

  const db = scoped(ctx);
  const existing = await db.allocation.findUnique({
    where:  { id },
    select: { id: true, quantity: true, orderLineId: true, colourwayId: true, dyeLot: true },
  });
  if (!existing) return { ok: false, error: "Allocation not found" };

  await withTransaction(async (tx: TxClient) => {
    await tx.allocation.delete({ where: { id } });

    // Restore reserved quantity on the matching StockBalance row.
    await tx.stockBalance.updateMany({
      where: {
        colourwayId: existing.colourwayId,
        dyeLot:      existing.dyeLot ?? undefined,
      },
      data: { reserved: { decrement: existing.quantity } },
    });

    await tx.auditLog.create({
      data: {
        organizationId: ctx.orgId,
        actorId:        ctx.userId,
        entityType:     "Allocation",
        entityId:       id,
        action:         "RELEASE",
        before:         { quantity: existing.quantity.toString() },
      },
    });
  }, { orgId: ctx.orgId });

  revalidatePath("/purchase/allocation");
  return { ok: true, data: { id } };
}

// ─── helpers ─────────────────────────────────────────────────────────

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

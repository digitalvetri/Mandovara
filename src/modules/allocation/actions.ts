"use server";

// Dye-lot allocation server actions (§0.6 sacred rule).
//
// The concurrency-critical primitive lives in ./core.ts (allocateInTx).
// This file wraps it with permission checks, audit logging, and cache
// invalidation — the concerns the test does not care about.

import type { z } from "zod";
import { revalidatePath } from "next/cache";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission, can } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { allocateLotSchema, releaseAllocationSchema } from "./schema";
import { allocateInTx, AllocationError } from "./core";

// revalidatePath throws "static generation store missing" outside a Next
// request context (smoke scripts, integration tests). Wrap it so the
// action is callable from both surfaces without a parallel API. Mirrors
// the safeRevalidate in modules/quotations/actions.ts.
function safeRevalidate(path: string): void {
  try { revalidatePath(path); } catch { /* not in a Next request */ }
}

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
        orgId:            ctx.orgId,
        orderLineId:      d.orderLineId,
        batchId:          d.batchId,
        quantity:         d.quantity,
        mixedLotOverride: d.mixedLotOverride,
        overrideReason:   d.overrideReason ?? null,
        actorId:          ctx.userId,
        actorCanOverride: can(ctx, "allocation.overrideMixedLot"),
      });

      // Audit trail — mixed-lot overrides especially need to leave a mark.
      await tx.auditLog.create({
        data: {
          orgId:      ctx.orgId,
          actorId:    ctx.userId,
          entityType: "LotAllocation",
          entityId:   alloc.id,
          action:     alloc.wouldBeMixed ? "CREATE_MIXED_LOT" : "CREATE",
          after: {
            orderLineId: d.orderLineId,
            batchId:     d.batchId,
            dyeLot:      alloc.dyeLot,
            quantity:    d.quantity.toString(),
            ...(alloc.wouldBeMixed && { overrideReason: d.overrideReason?.trim() }),
          },
        },
      });

      return alloc;
    });

    safeRevalidate("/purchase/allocation");
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
  const existing = await db.lotAllocation.findUnique({
    where: { id },
    select: { id: true, quantity: true, orderLineId: true, releasedAt: true },
  });
  if (!existing) return { ok: false, error: "Allocation not found" };
  if (existing.releasedAt != null) {
    return { ok: false, error: "Allocation already released" };
  }

  await withTransaction(async (tx: TxClient) => {
    await tx.lotAllocation.update({
      where: { id },
      data:  { releasedAt: new Date() },
    });
    await tx.orderLine.update({
      where: { id: existing.orderLineId },
      data:  { reservedQty: { decrement: existing.quantity } },
    });
    await tx.auditLog.create({
      data: {
        orgId:      ctx.orgId,
        actorId:    ctx.userId,
        entityType: "LotAllocation",
        entityId:   id,
        action:     "RELEASE",
        before:     { quantity: existing.quantity.toString() },
      },
    });
  });

  safeRevalidate("/purchase/allocation");
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

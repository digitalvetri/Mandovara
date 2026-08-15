"use server";

// Inventory server actions for the redesigned /inventory page.
//
// Two entry points:
//   - adjustStock — writes a StockMove row (append-only per StockMove
//     model), upserts the StockBalance for that (colourwayId, dyeLot)
//     row, publishes stock.belowReorder if the SKU crossed its
//     reorderLevel on the way down.
//   - setReorderLevel — one-field update on Colourway. Emits
//     stock.belowReorder if the new level puts the SKU immediately
//     underwater (e.g. threshold raised above current on-hand).
//
// The domain event is picked up in kernel/notifications/stock.ts and
// creates in-app Notifications for STORE + OWNER users.

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { prisma } from "@/kernel/db/client";
import { requirePermission } from "@/kernel/rbac/guard";
import { bus } from "@/kernel/events/bus";
import { devContext } from "@/lib/dev-context";
import { adjustStockSchema, setReorderLevelSchema } from "./schema";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function adjustStock(input: unknown): Promise<ActionResult<{ id: string; newOnHand: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "inventory.adjust");
  const parsed = adjustStockSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }
  const d = parsed.data;

  const db = scoped(ctx);
  const cw = await db.colourway.findUnique({
    where:  { id: d.colourwayId },
    select: { id: true, sellUnit: true, reorderLevel: true, isActive: true },
  });
  if (!cw) return { ok: false, error: "Product not found" };
  if (!cw.isActive) return { ok: false, error: "Product is inactive" };

  const dyeLot = d.dyeLot?.trim() || null;
  const deltaDec = new Prisma.Decimal(d.delta);
  const ratePaise = typeof d.ratePaise === "bigint" ? d.ratePaise
                  : d.ratePaise ? BigInt(d.ratePaise) : 0n;

  const { moveId, newOnHand, wasHealthy, isNowLow } = await withTransaction(async (tx: TxClient) => {
    // Compound unique key requires string, not string|null, at the TS
    // layer even though PG accepts NULL. Fall back to findFirst.
    const existing = await tx.stockBalance.findFirst({
      where:  { colourwayId: cw.id, dyeLot },
      select: { id: true, quantity: true, value: true },
    });
    const curQty   = existing ? new Prisma.Decimal(existing.quantity) : new Prisma.Decimal(0);
    const curVal   = existing?.value ?? 0n;
    const nextQty  = curQty.plus(deltaDec);
    // Value: if adding, use the provided rate; if removing, take away
    // at implied average so the value never drifts unbounded.
    let nextVal: bigint;
    if (deltaDec.gt(0)) {
      nextVal = curVal + BigInt(Math.round(Number(deltaDec) * Number(ratePaise)));
    } else {
      const cQ = Number(curQty);
      if (cQ === 0) {
        nextVal = curVal + BigInt(Math.round(Number(deltaDec) * Number(ratePaise)));
      } else {
        const avg = Number(curVal) / cQ;
        nextVal = curVal + BigInt(Math.round(Number(deltaDec) * avg));
        if (nextVal < 0n) nextVal = 0n;
      }
    }

    const move = await tx.stockMove.create({
      data: {
        organizationId: ctx.orgId,
        colourwayId:    cw.id,
        dyeLot,
        type:           "ADJUSTMENT",
        quantity:       deltaDec.abs(),
        rate:           ratePaise,
        refType:        "ADJUSTMENT",
        refId:          `adjust-${d.reason}`,
        occurredAt:     new Date(),
        createdById:    ctx.userId,
      },
      select: { id: true },
    });

    if (existing) {
      await tx.stockBalance.update({
        where: { id: existing.id },
        data:  { quantity: nextQty, value: nextVal },
      });
    } else {
      await tx.stockBalance.create({
        data: {
          organizationId: ctx.orgId,
          colourwayId:    cw.id,
          dyeLot,
          quantity:       nextQty,
          value:          nextVal,
        },
      });
    }

    // Compute the SKU's total on-hand (across dye lots) to decide the
    // low-stock crossing. Read AFTER the upsert.
    const allLots = await tx.stockBalance.findMany({
      where:  { colourwayId: cw.id },
      select: { quantity: true },
    });
    const totalOnHand = allLots.reduce((s, b) => s + Number(b.quantity), 0);
    const reorder = cw.reorderLevel == null ? null : Number(cw.reorderLevel);
    const wasHealthy = reorder == null || (totalOnHand - Number(deltaDec)) > reorder;
    const isNowLow   = reorder != null && totalOnHand <= reorder;

    return { moveId: move.id, newOnHand: String(totalOnHand), wasHealthy, isNowLow };
  });

  // Fire the event AFTER commit — bus handlers create notifications.
  if (wasHealthy && isNowLow) {
    await bus.publish({
      type:         "stock.belowReorder",
      orgId:        ctx.orgId,
      actorId:      ctx.userId,
      occurredAt:   new Date(),
      productId:    cw.id,
      warehouseId:  "",              // legacy shape — kept for handler compatibility
      currentQty:   newOnHand,
      reorderLevel: String(cw.reorderLevel ?? 0),
    });
  }

  revalidatePath("/inventory");
  return { ok: true, data: { id: moveId, newOnHand } };
}

export async function setReorderLevel(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "inventory.adjust");
  const parsed = setReorderLevelSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }
  const d = parsed.data;

  const db = scoped(ctx);
  const cw = await db.colourway.findUnique({
    where:  { id: d.colourwayId },
    select: { id: true },
  });
  if (!cw) return { ok: false, error: "Product not found" };

  await db.colourway.update({
    where: { id: d.colourwayId },
    data:  { reorderLevel: d.level == null ? null : new Prisma.Decimal(d.level) },
  });

  // If the new threshold puts current on-hand at/below it, fire the
  // low-stock event so the notification lands.
  if (d.level != null) {
    const bals = await prisma.stockBalance.findMany({
      where:  { colourwayId: d.colourwayId },
      select: { quantity: true },
    });
    const onHand = bals.reduce((s, b) => s + Number(b.quantity), 0);
    if (onHand <= d.level) {
      await bus.publish({
        type:         "stock.belowReorder",
        orgId:        ctx.orgId,
        actorId:      ctx.userId,
        occurredAt:   new Date(),
        productId:    d.colourwayId,
        warehouseId:  "",
        currentQty:   String(onHand),
        reorderLevel: String(d.level),
      });
    }
  }

  revalidatePath("/inventory");
  return { ok: true, data: { id: d.colourwayId } };
}

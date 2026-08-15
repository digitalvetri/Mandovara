// Shared reorder-crossing logic used by every path that moves stock
// (adjustStock, issueStock, later PO/GRN if we ever wire it there).
//
// Semantics: the crossing is measured against PHYSICAL quantity summed
// across all dye lots for a colourway — NOT `available = quantity −
// reserved`. Changing to `available` is a separate product decision; if
// you touch this file to do that, update both callers together.

import { Decimal } from "@prisma/client/runtime/library";
import type { TxClient } from "@/kernel/db/transaction";
import { bus } from "@/kernel/events/bus";

export interface ReorderCrossing {
  /** True iff the SKU was strictly above `reorderLevel` before the move and is now at/below it. */
  readonly crossedThreshold: boolean;
  /** Total on-hand across every dye lot, AFTER the move, as a decimal string. */
  readonly currentQty: string;
  /** Colourway's configured reorder level as a decimal string, or null if unset. */
  readonly reorderLevel: string | null;
}

/**
 * Pure predicate: given current on-hand, the signed delta just applied,
 * and the threshold, decide whether this move dropped the SKU through
 * its reorder line. Exported for unit-testing without a DB.
 *
 * Predicate contract (do NOT drift — same as adjustStock's original math):
 *   - wasHealthy = reorder null OR (currentQty − netDelta) STRICTLY > reorder
 *   - isNowLow   = reorder not null AND currentQty <= reorder
 *   - crossed    = wasHealthy AND isNowLow
 */
export function computeCrossing(
  totalOnHand:  Decimal,
  netDelta:     Decimal,
  reorderLevel: Decimal | null,
): ReorderCrossing {
  const previousTotal = totalOnHand.minus(netDelta);
  const wasHealthy    = reorderLevel == null || previousTotal.gt(reorderLevel);
  const isNowLow      = reorderLevel != null && totalOnHand.lte(reorderLevel);
  return {
    crossedThreshold: wasHealthy && isNowLow,
    currentQty:       totalOnHand.toString(),
    reorderLevel:     reorderLevel != null ? reorderLevel.toString() : null,
  };
}

/**
 * Read the SKU's current on-hand and reorder level and decide whether the
 * just-applied `netDelta` (signed — positive for inward, negative for
 * outward) took it below its threshold.
 *
 * MUST be called AFTER the StockBalance write has been applied inside the
 * same transaction so the sum reflects the new state.
 */
export async function checkReorderCrossing(
  tx: TxClient,
  colourwayId: string,
  netDelta: Decimal,
): Promise<ReorderCrossing> {
  const cw = await tx.colourway.findUnique({
    where:  { id: colourwayId },
    select: { reorderLevel: true },
  });
  const reorder = cw?.reorderLevel == null ? null : new Decimal(cw.reorderLevel);

  const allLots = await tx.stockBalance.findMany({
    where:  { colourwayId },
    select: { quantity: true },
  });
  const totalOnHand = allLots.reduce<Decimal>(
    (s, b) => s.plus(new Decimal(b.quantity)),
    new Decimal(0),
  );

  return computeCrossing(totalOnHand, netDelta, reorder);
}

/**
 * Publish `stock.belowReorder` iff the crossing indicates a fresh trip
 * below threshold. Safe to call unconditionally — a no-op crossing skips
 * the publish. Must be called AFTER the enclosing transaction commits so
 * downstream handlers (notifications, WhatsApp) see a durable state.
 */
export async function emitBelowReorderIfCrossed(args: {
  orgId:       string;
  actorId:     string;
  colourwayId: string;
  crossing:    ReorderCrossing;
}): Promise<void> {
  const { orgId, actorId, colourwayId, crossing } = args;
  if (!crossing.crossedThreshold) return;

  await bus.publish({
    type:         "stock.belowReorder",
    orgId,
    actorId,
    occurredAt:   new Date(),
    productId:    colourwayId,
    warehouseId:  "",                              // legacy shape (single-location)
    currentQty:   crossing.currentQty,
    reorderLevel: crossing.reorderLevel ?? "0",
  });
}

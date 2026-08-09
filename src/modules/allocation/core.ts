// @ts-nocheck — remote module, schema reconciliation pending
// Core dye-lot allocation primitive — the concurrency-critical bit.
// Kept as a pure kernel function taking (tx, params) so the Phase-4 gate
// test can drive it against a real Postgres without going through the
// server-action's ctx / audit / revalidate machinery.
//
// The action layer (./actions.ts) wraps this with permission checks,
// audit-log writes, and cache invalidation. It never touches the
// SELECT FOR UPDATE dance — that lives here, once.

import { Prisma } from "@/kernel/numbering/series";
import type { TxClient } from "@/kernel/db/transaction";

export class AllocationError extends Error {
  fieldKey?: string;
  constructor(msg: string, fieldKey?: string) {
    super(msg);
    this.name = "AllocationError";
    if (fieldKey != null) this.fieldKey = fieldKey;
  }
}

export interface AllocateParams {
  orgId:            string;
  orderLineId:      string;
  batchId:          string;
  quantity:         number | string | Prisma.Decimal;
  mixedLotOverride: boolean;
  overrideReason:   string | null;
  actorId:          string;
  actorCanOverride: boolean;
}

export interface AllocationResult {
  id: string;
  wouldBeMixed: boolean;
  dyeLot: string;
}

/**
 * The single, race-safe path for reserving material from a dye-lot to
 * an order line. Called from allocateLots (server action) and directly
 * from the concurrency test.
 *
 * Contract:
 *   - Locks the target Batch row with SELECT ... FOR UPDATE — concurrent
 *     callers serialise on this row.
 *   - Fails with AllocationError("Only N available …") when the requested
 *     quantity would over-allocate. Prisma retries are safe because the
 *     row is re-read under lock every attempt.
 *   - Fails with AllocationError("Order line already has a different …")
 *     unless mixedLotOverride=true, actorCanOverride=true, and a ≥4-char
 *     overrideReason is provided (§0.6).
 *   - Bumps OrderLine.reservedQty by the allocated quantity in the same tx.
 *
 * The caller MUST run this inside withTransaction(). The primitives used
 * (raw SELECT FOR UPDATE, Prisma create/update) all participate in the
 * caller's tx via the shared TxClient.
 */
export async function allocateInTx(
  tx: TxClient,
  p: AllocateParams,
): Promise<AllocationResult> {
  const requested = new Prisma.Decimal(p.quantity);
  if (requested.lte(0)) {
    throw new AllocationError("Quantity must be > 0", "quantity");
  }

  // (1) SELECT FOR UPDATE the target Batch row. Peer transactions
  // wait behind us until commit/rollback — no lost updates possible.
  const [locked] = await tx.$queryRaw<
    { id: string; quantity: string; batchNumber: string; productId: string }[]
  >(Prisma.sql`
    SELECT id, quantity::text AS quantity, "batchNumber", "productId"
    FROM "Batch"
    WHERE id = ${p.batchId}
    FOR UPDATE
  `);
  if (!locked) throw new AllocationError("Batch not found", "batchId");

  // (2) Verify the order-line product matches the batch product.
  const line = await tx.orderLine.findUnique({
    where:  { id: p.orderLineId },
    select: { id: true, productId: true },
  });
  if (!line) throw new AllocationError("Order line not found", "orderLineId");
  if (line.productId !== locked.productId) {
    throw new AllocationError(
      "Batch product does not match order-line product",
      "batchId",
    );
  }

  // (3) Available = on-hand − Σ(open allocations).
  const openAllocs = await tx.lotAllocation.findMany({
    where:  { batchId: p.batchId, releasedAt: null },
    select: { quantity: true },
  });
  const allocated = openAllocs.reduce(
    (s, a) => s.plus(a.quantity),
    new Prisma.Decimal(0),
  );
  const available = new Prisma.Decimal(locked.quantity).minus(allocated);
  if (available.lt(requested)) {
    throw new AllocationError(
      `Only ${available.toString()} available on lot ${locked.batchNumber} — requested ${requested.toString()}`,
      "quantity",
    );
  }

  // (4) Mixed-lot gate.
  const existingOnLine = await tx.lotAllocation.findMany({
    where:  { orderLineId: p.orderLineId, releasedAt: null },
    select: { batchId: true },
  });
  const wouldBeMixed = existingOnLine.some((a) => a.batchId !== p.batchId);
  if (wouldBeMixed) {
    if (!p.mixedLotOverride) {
      throw new AllocationError(
        "Order line already has a different dye-lot allocated. Confirm mixed-lot override with a reason.",
        "mixedLotOverride",
      );
    }
    if (!p.actorCanOverride) {
      throw new AllocationError(
        "You do not have permission to override the mixed-lot rule.",
        "mixedLotOverride",
      );
    }
    const reason = (p.overrideReason ?? "").trim();
    if (reason.length < 4) {
      throw new AllocationError(
        "A reason (at least 4 characters) is required for a mixed-lot override.",
        "overrideReason",
      );
    }
  }

  // (5) Persist. Insert allocation + ratchet reservedQty.
  const alloc = await tx.lotAllocation.create({
    data: {
      orgId:            p.orgId,
      orderLineId:      p.orderLineId,
      batchId:          p.batchId,
      quantity:         requested,
      mixedLotOverride: wouldBeMixed,
      ...(wouldBeMixed && p.overrideReason && {
        overrideReason: p.overrideReason.trim(),
        overrideById:   p.actorId,
      }),
      createdById: p.actorId,
    },
    select: { id: true },
  });
  await tx.orderLine.update({
    where: { id: p.orderLineId },
    data:  { reservedQty: { increment: requested } },
  });

  return { id: alloc.id, wouldBeMixed, dyeLot: locked.batchNumber };
}
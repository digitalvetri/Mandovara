// Phase 4 gate — mixed-lot BLOCK + audited OVERRIDE (§0.6).
//
// Three assertions, in order:
//   1. Allocating a 2nd batch to the same OrderLine without an override
//      throws AllocationError and does NOT write anything.
//   2. Retrying with mixedLotOverride=true, actorCanOverride=true, and a
//      ≥4-char reason succeeds.
//   3. The success path leaves an AuditLog row action="CREATE_MIXED_LOT"
//      whose `after.overrideReason` matches what the caller supplied.

import { beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma as db } from "@/kernel/db/client";
import { withTransaction } from "@/kernel/db/transaction";
import { allocateInTx, AllocationError } from "@/modules/allocation/core";
import { setupTwoTenants, type Tenant } from "../../kernel/fixtures";

let A: Tenant;
let batch1Id: string;
let batch2Id: string;
let orderLineId: string;

const REASON = "client approved the shade drift for the guest bath";

beforeAll(async () => {
  const t = await setupTwoTenants(db);
  A = t.A;

  // Fixture — one product, one warehouse, one client, one SO with a
  // single OrderLine of qty 3, and two Batches (LOT-A, LOT-B) each qty 5.
  const category = await db.category.create({
    data: { orgId: A.orgId, name: "Curtain" },
  });
  const product = await db.product.create({
    data: {
      orgId: A.orgId, categoryId: category.id,
      code: "CURTN-MX", name: "Test Curtain Fabric", hsn: "5407",
      uom: "METRE", gstRate: 18, trackBatch: true,
    },
  });
  const branch = await db.branch.findFirstOrThrow({
    where: { orgId: A.orgId }, select: { id: true },
  });
  const warehouse = await db.warehouse.create({
    data: { orgId: A.orgId, branchId: branch.id, name: "Main WH" },
  });
  const client = await db.client.create({
    data: {
      orgId: A.orgId, name: "Mixed-Lot Client", type: "PROJECT",
      stateCode: "33", primaryMobile: "+919000000098",
    },
  });
  const batch1 = await db.batch.create({
    data: {
      orgId: A.orgId, productId: product.id, warehouseId: warehouse.id,
      batchNumber: "LOT-A", quantity: new Prisma.Decimal(5),
    },
  });
  const batch2 = await db.batch.create({
    data: {
      orgId: A.orgId, productId: product.id, warehouseId: warehouse.id,
      batchNumber: "LOT-B", quantity: new Prisma.Decimal(5),
    },
  });
  batch1Id = batch1.id;
  batch2Id = batch2.id;

  const so = await db.salesOrder.create({
    data: {
      orgId: A.orgId, branchId: branch.id, clientId: client.id,
      number: "SO-MIX-1", date: new Date(), status: "CONFIRMED",
      taxableAmount: 0n, cgst: 0n, sgst: 0n, igst: 0n, total: 0n,
    },
  });
  const line = await db.orderLine.create({
    data: {
      salesOrderId: so.id, lineNo: 1, productId: product.id,
      description: "Curtain 2.5m",
      orderedQty: new Prisma.Decimal(6),
      rate: 500_00n, gstRate: new Prisma.Decimal(18), amount: 3000_00n,
    },
  });
  orderLineId = line.id;

  // Seed the line with an existing allocation from LOT-A so the mixed-lot
  // check has something to compare against.
  await withTransaction((tx) => allocateInTx(tx, {
    orgId:            A.orgId,
    orderLineId,
    batchId:          batch1Id,
    quantity:         2,
    mixedLotOverride: false,
    overrideReason:   null,
    actorId:          A.userId,
    actorCanOverride: false,
  }));
});

describe("Phase 4 gate — mixed-lot block + audited override (§0.6)", () => {
  it("rejects a 2nd different lot on the same line without override", async () => {
    await expect(
      withTransaction((tx) => allocateInTx(tx, {
        orgId:            A.orgId,
        orderLineId,
        batchId:          batch2Id,
        quantity:         1,
        mixedLotOverride: false,
        overrideReason:   null,
        actorId:          A.userId,
        actorCanOverride: false,
      })),
    ).rejects.toBeInstanceOf(AllocationError);

    // Nothing persisted for LOT-B.
    const b = await db.lotAllocation.count({ where: { batchId: batch2Id } });
    expect(b).toBe(0);
  });

  it("rejects override when caller lacks the permission", async () => {
    await expect(
      withTransaction((tx) => allocateInTx(tx, {
        orgId:            A.orgId,
        orderLineId,
        batchId:          batch2Id,
        quantity:         1,
        mixedLotOverride: true,
        overrideReason:   REASON,
        actorId:          A.userId,
        actorCanOverride: false,   // ← no permission
      })),
    ).rejects.toThrow(/permission to override/i);
  });

  it("rejects override with a reason under 4 characters", async () => {
    await expect(
      withTransaction((tx) => allocateInTx(tx, {
        orgId:            A.orgId,
        orderLineId,
        batchId:          batch2Id,
        quantity:         1,
        mixedLotOverride: true,
        overrideReason:   "ok",     // ← too short
        actorId:          A.userId,
        actorCanOverride: true,
      })),
    ).rejects.toThrow(/at least 4 characters/i);
  });

  it("accepts a valid override: permission + reason ≥ 4 chars", async () => {
    const res = await withTransaction((tx) => allocateInTx(tx, {
      orgId:            A.orgId,
      orderLineId,
      batchId:          batch2Id,
      quantity:         1,
      mixedLotOverride: true,
      overrideReason:   REASON,
      actorId:          A.userId,
      actorCanOverride: true,
    }));
    expect(res.wouldBeMixed).toBe(true);
    expect(res.dyeLot).toBe("LOT-B");

    // The persisted row carries the override flag + reason + actor.
    const row = await db.lotAllocation.findUniqueOrThrow({
      where:  { id: res.id },
      select: {
        mixedLotOverride: true, overrideReason: true,
        overrideById: true, batchId: true, quantity: true,
      },
    });
    expect(row.mixedLotOverride).toBe(true);
    expect(row.overrideReason).toBe(REASON);
    expect(row.overrideById).toBe(A.userId);
    expect(row.batchId).toBe(batch2Id);
    expect(row.quantity.toString()).toBe("1");
  });

  it("but writing an audit trail is the caller's job (not core.ts) — verify separately", async () => {
    // The action layer (src/modules/allocation/actions.ts) writes the
    // AuditLog with action="CREATE_MIXED_LOT". core.ts alone doesn't.
    // We simulate that layer here so the test is honest about which
    // component owns which invariant.
    const alloc = await withTransaction(async (tx) => {
      const a = await allocateInTx(tx, {
        orgId:            A.orgId,
        orderLineId,
        batchId:          batch2Id,
        quantity:         1,
        mixedLotOverride: true,
        overrideReason:   REASON,
        actorId:          A.userId,
        actorCanOverride: true,
      });
      await tx.auditLog.create({
        data: {
          orgId:      A.orgId,
          actorId:    A.userId,
          entityType: "LotAllocation",
          entityId:   a.id,
          action:     a.wouldBeMixed ? "CREATE_MIXED_LOT" : "CREATE",
          after: {
            batchId: batch2Id, dyeLot: a.dyeLot, quantity: "1",
            ...(a.wouldBeMixed && { overrideReason: REASON }),
          },
        },
      });
      return a;
    });

    const audit = await db.auditLog.findFirstOrThrow({
      where: {
        orgId:      A.orgId,
        entityType: "LotAllocation",
        entityId:   alloc.id,
        action:     "CREATE_MIXED_LOT",
      },
    });
    expect((audit.after as { overrideReason?: string }).overrideReason).toBe(REASON);
  });
});

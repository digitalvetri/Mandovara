// Phase 4 gate — 50 parallel allocations against the same dye-lot NEVER
// over-allocate. Batch quantity = 10. 50 concurrent attempts of qty=1.
// Expect exactly 10 successes and 40 failures with AllocationError.
//
// Concurrency correctness lives in allocateInTx: it does
// SELECT ... FOR UPDATE on the Batch row, so peers serialise on the lock
// and each attempt sees a consistent (on-hand − allocated) balance.

import { beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma as db } from "@/kernel/db/client";
import { withTransaction } from "@/kernel/db/transaction";
import { allocateInTx, AllocationError } from "@/modules/allocation/core";
import { setupTwoTenants, type Tenant } from "../../kernel/fixtures";

let A: Tenant;
let batchId: string;
const orderLineIds: string[] = [];
const N = 50;
const BATCH_QTY = 10;

beforeAll(async () => {
  const t = await setupTwoTenants(db);
  A = t.A;

  // Minimal fixture: one product (batch-tracked), one warehouse,
  // one batch with quantity 10, one sales order with N order lines
  // (each requesting qty 1 from the same batch).
  const category = await db.category.create({
    data: { orgId: A.orgId, name: "Wallpaper" },
  });
  const product = await db.product.create({
    data: {
      orgId: A.orgId, categoryId: category.id,
      code: "WPPR-TEST", name: "Test Wallpaper", hsn: "4814", uom: "ROLL",
      gstRate: 18, trackBatch: true,
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
      orgId: A.orgId, name: "Contentious Client", type: "PROJECT",
      stateCode: "33", primaryMobile: "+919000000099",
    },
  });
  const batch = await db.batch.create({
    data: {
      orgId: A.orgId, productId: product.id, warehouseId: warehouse.id,
      batchNumber: "LOT-42", quantity: new Prisma.Decimal(BATCH_QTY),
    },
  });
  batchId = batch.id;

  const so = await db.salesOrder.create({
    data: {
      orgId: A.orgId, branchId: branch.id, clientId: client.id,
      number: "SO-CONT-1", date: new Date(), status: "CONFIRMED",
      taxableAmount: 0n, cgst: 0n, sgst: 0n, igst: 0n, total: 0n,
    },
  });
  for (let i = 0; i < N; i++) {
    const line = await db.orderLine.create({
      data: {
        salesOrderId: so.id, lineNo: i + 1, productId: product.id,
        description: `Line ${i + 1}`,
        orderedQty: new Prisma.Decimal(1),
        rate: 100_00n, gstRate: new Prisma.Decimal(18), amount: 100_00n,
      },
    });
    orderLineIds.push(line.id);
  }
});

describe("Phase 4 gate — 50 concurrent dye-lot allocations", () => {
  it("exactly 10 succeed, 40 fail — never over-allocate", async () => {
    const attempts = await Promise.allSettled(
      orderLineIds.map((orderLineId) =>
        withTransaction(
          (tx) =>
            allocateInTx(tx, {
              orgId:            A.orgId,
              orderLineId,
              batchId,
              quantity:         1,
              mixedLotOverride: false,
              overrideReason:   null,
              actorId:          A.userId,
              actorCanOverride: false,
            }),
          { maxWaitMs: 60_000, timeoutMs: 60_000 },
        ),
      ),
    );

    const succeeded = attempts.filter((a) => a.status === "fulfilled");
    const failed    = attempts.filter((a) => a.status === "rejected");

    expect(succeeded.length).toBe(BATCH_QTY);
    expect(failed.length).toBe(N - BATCH_QTY);

    for (const f of failed) {
      const reason = (f as PromiseRejectedResult).reason;
      expect(reason).toBeInstanceOf(AllocationError);
      expect((reason as AllocationError).message).toMatch(/available|Only \d/i);
    }

    // Ground truth: the sum of persisted allocations equals batch quantity.
    // Not one paisa more.
    const rows = await db.lotAllocation.findMany({
      where: { batchId, releasedAt: null },
      select: { quantity: true },
    });
    const total = rows.reduce(
      (s, r) => s.plus(r.quantity),
      new Prisma.Decimal(0),
    );
    expect(total.toString()).toBe(String(BATCH_QTY));

    // And the corresponding order lines have their reservedQty ratcheted.
    const lines = await db.orderLine.findMany({
      where:  { id: { in: orderLineIds } },
      select: { reservedQty: true },
    });
    const totalReserved = lines.reduce(
      (s, l) => s + Number(l.reservedQty),
      0,
    );
    expect(totalReserved).toBe(BATCH_QTY);
  });
});

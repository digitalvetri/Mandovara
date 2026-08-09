// Fixture for the §12.2 #4 mixed-lot allocation spec. Creates a
// fresh product + two batches (LOT-A, LOT-B) + one SalesOrder line
// with an existing LOT-A allocation, so the UI is guaranteed to hit
// the mixed-lot gate when the spec picks LOT-B. Self-cleans via
// cleanupMixedLotFixture.

import { Prisma, PrismaClient } from "@prisma/client";
import { allocateInTx } from "@/modules/allocation/core";

export interface MixedLotFixture {
  productId:   string;
  batchAId:    string;
  batchBId:    string;
  orderId:     string;
  orderLineId: string;
  allocId:     string;
  clientId:    string;
  categoryId:  string;
}

export async function seedMixedLotFixture(): Promise<MixedLotFixture> {
  const db = new PrismaClient();
  try {
    const branch = await db.branch.findFirstOrThrow({ select: { id: true, orgId: true } });
    const uniq = Date.now();

    const category = await db.category.create({
      data: { orgId: branch.orgId, name: `E2E MixedLot ${uniq}` },
      select: { id: true },
    });
    const product = await db.product.create({
      data: {
        orgId:       branch.orgId,
        categoryId:  category.id,
        code:        `E2E-ML-${uniq}`,
        name:        `E2E mixed-lot ${uniq}`,
        hsn:         "5407",
        uom:         "METRE",
        gstRate:     new Prisma.Decimal(18),
        trackBatch:  true,
        status:      "ACTIVE",
      },
      select: { id: true },
    });
    const warehouse = await db.warehouse.findFirstOrThrow({
      where: { orgId: branch.orgId }, select: { id: true },
    });
    const batchA = await db.batch.create({
      data: {
        orgId:       branch.orgId,
        productId:   product.id,
        warehouseId: warehouse.id,
        batchNumber: `E2E-${uniq}-LOT-A`,
        quantity:    new Prisma.Decimal(10),
      },
      select: { id: true },
    });
    const batchB = await db.batch.create({
      data: {
        orgId:       branch.orgId,
        productId:   product.id,
        warehouseId: warehouse.id,
        batchNumber: `E2E-${uniq}-LOT-B`,
        quantity:    new Prisma.Decimal(10),
      },
      select: { id: true },
    });
    const client = await db.client.create({
      data: {
        orgId:         branch.orgId,
        name:          `E2E MixedLot Client ${uniq}`,
        type:          "PROJECT",
        status:        "ACTIVE",
        stateCode:     "33",
        primaryMobile: "+919000000099",
      },
      select: { id: true },
    });
    const owner = await db.user.findFirstOrThrow({
      where: { email: "owner@mandovara.example" }, select: { id: true },
    });
    const order = await db.salesOrder.create({
      data: {
        orgId:        branch.orgId,
        branchId:     branch.id,
        clientId:     client.id,
        number:       `E2E/ML/${uniq}`,
        date:         new Date(),
        status:       "CONFIRMED",
        taxableAmount: 0n, cgst: 0n, sgst: 0n, igst: 0n, total: 0n,
      },
      select: { id: true },
    });
    const orderLine = await db.orderLine.create({
      data: {
        salesOrderId: order.id,
        lineNo:       1,
        productId:    product.id,
        description:  "E2E mixed-lot line",
        orderedQty:   new Prisma.Decimal(6),
        rate:         500_00n,
        gstRate:      new Prisma.Decimal(18),
        amount:       3000_00n,
      },
      select: { id: true },
    });

    // Seed the LOT-A allocation via the same tx primitive the UI uses.
    // Use interactive transaction to match production shape.
    const alloc = await db.$transaction((tx) => allocateInTx(tx, {
      orgId:            branch.orgId,
      orderLineId:      orderLine.id,
      batchId:          batchA.id,
      quantity:         2,
      mixedLotOverride: false,
      overrideReason:   null,
      actorId:          owner.id,
      actorCanOverride: false,
    }));

    return {
      productId:   product.id,
      batchAId:    batchA.id,
      batchBId:    batchB.id,
      orderId:     order.id,
      orderLineId: orderLine.id,
      allocId:     alloc.id,
      clientId:    client.id,
      categoryId:  category.id,
    };
  } finally {
    await db.$disconnect();
  }
}

export async function cleanupMixedLotFixture(fx: MixedLotFixture): Promise<void> {
  const db = new PrismaClient();
  try {
    // Order matters — allocations first (FK RESTRICT on Batch),
    // then order + client, then batches + product + category.
    // AuditLog rows are append-only (DB-level rule from Phase 4);
    // leaving them is fine — the timestamped fixture code + the
    // "E2E:" prefix in the override reason keep them traceable.
    await db.lotAllocation.deleteMany({ where: { orderLineId: fx.orderLineId } });
    await db.salesOrder.delete({ where: { id: fx.orderId } });
    await db.client.delete({ where: { id: fx.clientId } });
    await db.batch.delete({ where: { id: fx.batchAId } });
    await db.batch.delete({ where: { id: fx.batchBId } });
    await db.product.delete({ where: { id: fx.productId } });
    await db.category.delete({ where: { id: fx.categoryId } });
  } catch (e) {
    // Best-effort cleanup — a partial teardown between test runs
    // is annoying but not fatal (unique keys use timestamped names).
    console.warn("mixed-lot cleanup partial:", (e as Error).message);
  } finally {
    await db.$disconnect();
  }
}

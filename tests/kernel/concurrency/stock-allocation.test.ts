// Phase 4 gate — 50 parallel allocations of the same colourway+lot never over-reserve.
//
// Stock starts at 100 units. 50 allocations of 3 units = 150 total demand.
// At most 33 can succeed (99 units reserved); the remaining 17+ must fail
// with InsufficientStockError. Final reserved must equal succeeded × 3.
// Every failure must be an InsufficientStockError — no other error is acceptable.

import { beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma as db } from "@/kernel/db/client";
import { withTransaction } from "@/kernel/db/transaction";
import { allocateStockBalance } from "@/kernel/stock/allocate";
import { InsufficientStockError } from "@/modules/stock/lib";

const DYE_LOT = "LOT-CONC-ALLOC-01";
const INITIAL_QTY = new Decimal(100);
const PER_ALLOC = new Decimal(3);
const PARALLEL = 50;

let orgId: string;
let testUserId: string;
let colourwayId: string;

beforeAll(async () => {
  // Build minimum Mandovara entities required for StockBalance (FK on colourwayId)
  const org = await db.organization.create({
    data: {
      name: "StockAllocConcurrencyOrg",
      stateCode: "33",
      settings: {} as Prisma.InputJsonValue,
    },
  });
  orgId = org.id;

  const user = await db.user.create({
    data: {
      organizationId: orgId,
      mobile: "+919988776655",
      name: "Stock Test User",
      role: "STORE",
      branchIds: [],
      status: "ACTIVE",
    },
  });
  testUserId = user.id;

  const brand = await db.brand.create({
    data: { organizationId: orgId, name: "ConcTestBrand" },
  });

  const coll = await db.collection.create({
    data: {
      organizationId: orgId,
      brandId: brand.id,
      name: "ConcTestCollection",
      family: "CURTAIN_FABRIC",
      isActive: true,
    },
  });

  const design = await db.design.create({
    data: {
      organizationId: orgId,
      collectionId: coll.id,
      code: "CONC-D-001",
      name: "ConcDesign",
      family: "CURTAIN_FABRIC",
      patternMatch: "FREE",
      specs: {} as Prisma.InputJsonValue,
      hsn: "5407",
      gstRate: new Prisma.Decimal(12),
      isActive: true,
    },
  });

  const cw = await db.colourway.create({
    data: {
      organizationId: orgId,
      designId: design.id,
      code: "CONC-CW-001",
      colourName: "Concurrent Pearl",
      sellUnit: "METRE",
      isActive: true,
    },
  });
  colourwayId = cw.id;

  // Seed the initial stock balance
  await db.stockBalance.create({
    data: {
      organizationId: orgId,
      colourwayId,
      dyeLot: DYE_LOT,
      quantity: INITIAL_QTY,
      reserved: new Decimal(0),
      value: BigInt(100 * 50_000), // 100m at 50 000 paise/m = ₹500/m
    },
  });
}, 30_000);

describe("stock allocation — 50 parallel allocations never over-reserve", () => {
  it(
    `starts at ${INITIAL_QTY}, tries ${PARALLEL}×${PER_ALLOC}, reserved never exceeds ${INITIAL_QTY}`,
    async () => {
      // Each allocation goes against a unique order line (simulates 50 separate orders)
      const results = await Promise.allSettled(
        Array.from({ length: PARALLEL }, (_, i) => {
          const fakeOrderLineId = `conc-test-line-${i}-${orgId.slice(0, 8)}`;
          return withTransaction(
            (tx) =>
              allocateStockBalance(tx, {
                organizationId: orgId,
                orderLineId:    fakeOrderLineId,
                colourwayId,
                dyeLot:         DYE_LOT,
                quantity:       PER_ALLOC,
                rate:           50_000n,
                createdById:    testUserId,
              }),
            { maxWaitMs: 60_000, timeoutMs: 60_000 },
          );
        }),
      );

      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed    = results.filter((r) => r.status === "rejected");

      // Every failure must be InsufficientStockError — nothing else acceptable
      for (const r of failed) {
        if (r.status !== "rejected") continue;
        const err = r.reason as unknown;
        expect(
          err instanceof InsufficientStockError,
          `Expected InsufficientStockError, got: ${err instanceof Error ? err.message : String(err)}`,
        ).toBe(true);
      }

      // No over-reservation: succeeded × 3 ≤ 100
      const totalReserved = succeeded * Number(PER_ALLOC);
      expect(totalReserved).toBeLessThanOrEqual(Number(INITIAL_QTY));

      // Final StockBalance.reserved matches exactly what we committed
      const balance = await db.stockBalance.findFirstOrThrow({
        where: { organizationId: orgId, colourwayId, dyeLot: DYE_LOT },
      });
      expect(Number(balance.reserved)).toBe(totalReserved);
      expect(Number(balance.reserved)).toBeGreaterThanOrEqual(0);
      expect(Number(balance.quantity)).toBe(Number(INITIAL_QTY)); // quantity unchanged by allocation

      // Allocation rows match exactly the number that succeeded
      const allocCount = await db.allocation.count({
        where: { organizationId: orgId, colourwayId, dyeLot: DYE_LOT },
      });
      expect(allocCount).toBe(succeeded);

      // StockMove(ALLOCATE) rows match — the append-only ledger is consistent
      const moveCount = await db.stockMove.count({
        where: { organizationId: orgId, colourwayId, dyeLot: DYE_LOT, type: "ALLOCATE" },
      });
      expect(moveCount).toBe(succeeded);

      // At least one must have failed — 50×3=150 > 100
      expect(failed.length).toBeGreaterThan(0);
    },
    90_000,
  );
});

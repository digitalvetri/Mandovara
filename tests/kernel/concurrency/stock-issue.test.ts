// @ts-nocheck
// Gate: 50 parallel stock issues of the same colourway NEVER oversell.
// Stock starts at 100 units. 50 issues of 3 units each = 150 total demand.
// At most 33 issues can succeed (99 units); the rest must fail with NegativeStockError.

import { beforeAll, describe, expect, it } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma as db } from "@/kernel/db/client";
import { issueStock, NegativeStockError } from "@/kernel/inventory/issue";
import { setupTwoTenants, type Tenant } from "../fixtures";

let A: Tenant;
let colourwayId: string;

const INITIAL_QTY = new Decimal(100);
const PARALLEL = 50;
const PER_ISSUE = new Decimal(3);

beforeAll(async () => {
  const t = await setupTwoTenants(db);
  A = t.A;

  // Build minimal catalog chain: Brand -> Collection -> Design -> Colourway
  const brand = await db.brand.create({
    data: { organizationId: A.orgId, name: `Test Brand ${A.orgId.slice(-6)}` },
  });
  const collection = await db.collection.create({
    data: {
      organizationId: A.orgId,
      brandId: brand.id,
      name: "Test Collection",
      family: "CURTAIN_FABRIC",
    },
  });
  const design = await db.design.create({
    data: {
      organizationId: A.orgId,
      collectionId: collection.id,
      code: `DSN-${A.orgId.slice(-6)}`,
      name: "Concurrent Test Fabric",
      family: "CURTAIN_FABRIC",
      specs: {},
      hsn: "5407",
      gstRate: 12,
    },
  });
  const colourway = await db.colourway.create({
    data: {
      organizationId: A.orgId,
      designId: design.id,
      code: `CW-${A.orgId.slice(-6)}`,
      colourName: "Ivory",
      sellUnit: "METRE",
    },
  });
  colourwayId = colourway.id;

  // Create a stock balance with 100 metres, no dye lot
  await db.stockBalance.create({
    data: {
      organizationId: A.orgId,
      colourwayId: colourway.id,
      dyeLot: null,
      quantity: INITIAL_QTY,
      value: BigInt(100) * 500_00n, // Rs 500/m in paise
    },
  });
}, 30_000);

describe("stock issue - 50 parallel issues never oversell", () => {
  it(`starts at ${INITIAL_QTY}, tries ${PARALLEL}x${PER_ISSUE}, balance never < 0`, async () => {
    const results = await Promise.allSettled(
      Array.from({ length: PARALLEL }, (_, i) =>
        db.$transaction(
          async (tx) => {
            await issueStock(tx, {
              organizationId: A.orgId,
              colourwayId,
              dyeLot: null,
              quantity: PER_ISSUE,
              rate: 500_00n,
              type: "ISSUE_TO_MAKE",
              refType: "TEST",
              refId: `test-issue-${i}`,
              createdById: A.userId,
              occurredAt: new Date(),
            });
          },
          { maxWait: 60_000, timeout: 60_000 },
        ),
      ),
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed    = results.filter((r) => r.status === "rejected");
    const totalIssued = PER_ISSUE.times(succeeded);

    for (const r of failed) {
      if (r.status !== "rejected") continue;
      expect(r.reason).toBeInstanceOf(NegativeStockError);
      expect(r.reason.message).toContain(colourwayId);
    }

    // Zero oversell: succeeded x per-issue <= initial stock
    expect(totalIssued.toNumber()).toBeLessThanOrEqual(INITIAL_QTY.toNumber());

    // Final balance matches what was issued
    const balance = await db.stockBalance.findFirstOrThrow({
      where: { colourwayId, dyeLot: null },
    });
    const expectedQty = INITIAL_QTY.minus(totalIssued);
    expect(balance.quantity.toString()).toBe(expectedQty.toString());
    expect(Number(balance.quantity)).toBeGreaterThanOrEqual(0);

    // Each successful issue appended a StockMove(ISSUE_TO_MAKE)
    const moveCount = await db.stockMove.count({
      where: { colourwayId, type: "ISSUE_TO_MAKE", refType: "TEST" },
    });
    expect(moveCount).toBe(succeeded);
  }, 90_000);
});

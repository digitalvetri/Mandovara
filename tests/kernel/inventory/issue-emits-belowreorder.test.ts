// @ts-nocheck
// issueStock is the physical-decrement path for the Make + Install flows.
// When an issue drops on-hand through the reorder line, it must return a
// crossing telling its caller to publish `stock.belowReorder` after commit.
// This test drives the full DB path: colourway with a threshold + one lot
// with just enough stock, then issue enough to cross.

import { beforeAll, describe, expect, it } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma as db } from "@/kernel/db/client";
import { issueStock } from "@/kernel/inventory/issue";
import { setupTwoTenants, type Tenant } from "../fixtures";

let A: Tenant;
let colourwayId: string;
let colourwayNoThresholdId: string;

beforeAll(async () => {
  const t = await setupTwoTenants(db);
  A = t.A;

  const brand = await db.brand.create({
    data: { organizationId: A.orgId, name: `Reorder Brand ${A.orgId.slice(-6)}` },
  });
  const collection = await db.collection.create({
    data: {
      organizationId: A.orgId,
      brandId: brand.id,
      name: "Reorder Test Collection",
      family: "CURTAIN_FABRIC",
    },
  });
  const design = await db.design.create({
    data: {
      organizationId: A.orgId,
      collectionId: collection.id,
      code: `DSN-RO-${A.orgId.slice(-6)}`,
      name: "Reorder Test Fabric",
      family: "CURTAIN_FABRIC",
      specs: {},
      hsn: "5407",
      gstRate: 12,
    },
  });

  // SKU with a reorder line at 10; single lot with 12 units.
  const cwLow = await db.colourway.create({
    data: {
      organizationId: A.orgId,
      designId: design.id,
      code: `CW-RO-LOW-${A.orgId.slice(-6)}`,
      colourName: "Cream",
      sellUnit: "METRE",
      reorderLevel: new Decimal(10),
    },
  });
  colourwayId = cwLow.id;
  await db.stockBalance.create({
    data: {
      organizationId: A.orgId,
      colourwayId: cwLow.id,
      dyeLot: null,
      quantity: new Decimal(12),
      value: 6000_00n,
    },
  });

  // SKU with NO reorder line; issues should never signal a crossing.
  const cwNone = await db.colourway.create({
    data: {
      organizationId: A.orgId,
      designId: design.id,
      code: `CW-RO-NONE-${A.orgId.slice(-6)}`,
      colourName: "Ecru",
      sellUnit: "METRE",
    },
  });
  colourwayNoThresholdId = cwNone.id;
  await db.stockBalance.create({
    data: {
      organizationId: A.orgId,
      colourwayId: cwNone.id,
      dyeLot: null,
      quantity: new Decimal(50),
      value: 25000_00n,
    },
  });
}, 30_000);

describe("issueStock → ReorderCrossing", () => {
  it("returns crossedThreshold=true when the issue drops on-hand through the reorder line", async () => {
    // 12 on-hand, reorder at 10 → issue 5 lands at 7, crosses.
    const crossing = await db.$transaction(async (tx) => {
      return await issueStock(tx, {
        organizationId: A.orgId,
        colourwayId,
        dyeLot: null,
        quantity: new Decimal(5),
        rate: 500_00n,
        type: "ISSUE_TO_MAKE",
        refType: "TEST",
        refId: "test-crossing-cross",
        createdById: A.userId,
        occurredAt: new Date(),
      });
    });

    expect(crossing.crossedThreshold).toBe(true);
    expect(crossing.currentQty).toBe("7");
    expect(crossing.reorderLevel).toBe("10");
  });

  it("returns crossedThreshold=false when the issue lands but the SKU was already below the line", async () => {
    // After the previous test the SKU is at 7 (already below 10). Any
    // further issue is not a fresh trip.
    const crossing = await db.$transaction(async (tx) => {
      return await issueStock(tx, {
        organizationId: A.orgId,
        colourwayId,
        dyeLot: null,
        quantity: new Decimal(1),
        rate: 500_00n,
        type: "ISSUE_TO_MAKE",
        refType: "TEST",
        refId: "test-crossing-noop",
        createdById: A.userId,
        occurredAt: new Date(),
      });
    });

    expect(crossing.crossedThreshold).toBe(false);
    expect(crossing.currentQty).toBe("6");
  });

  it("returns crossedThreshold=false when the SKU has no reorder level set", async () => {
    const crossing = await db.$transaction(async (tx) => {
      return await issueStock(tx, {
        organizationId: A.orgId,
        colourwayId: colourwayNoThresholdId,
        dyeLot: null,
        quantity: new Decimal(45),          // huge drawdown, still no threshold
        rate: 500_00n,
        type: "ISSUE_TO_SITE",
        refType: "TEST",
        refId: "test-crossing-nothreshold",
        createdById: A.userId,
        occurredAt: new Date(),
      });
    });

    expect(crossing.crossedThreshold).toBe(false);
    expect(crossing.reorderLevel).toBeNull();
  });

  it("writes the StockMove with the caller-specified type (ISSUE_TO_SITE, not hardcoded MAKE)", async () => {
    const moves = await db.stockMove.findMany({
      where: { colourwayId: colourwayNoThresholdId, refId: "test-crossing-nothreshold" },
    });
    expect(moves.length).toBe(1);
    expect(moves[0]!.type).toBe("ISSUE_TO_SITE");
  });
});

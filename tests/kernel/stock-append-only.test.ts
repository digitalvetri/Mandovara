// Demonstrates the Phase 4 gate: "direct UPDATE on StockMove fails at the DB."
// The append-only trigger (StockMove_no_update, StockMove_no_delete) is part
// of the 20260808040024_mandovara_init migration and lives at the Postgres level —
// bypassing Prisma does not bypass it.

import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma as db } from "@/kernel/db/client";

async function makeMinimalMove(orgId: string, cwId: string, userId: string) {
  return db.stockMove.create({
    data: {
      organizationId: orgId,
      colourwayId:    cwId,
      dyeLot:         "TEST-LOT",
      type:           "GRN_IN",
      quantity:       new Decimal("1"),
      rate:           1000n,
      refType:        "GRN",
      refId:          "fake-grn-id",
      occurredAt:     new Date(),
      createdById:    userId,
    },
  });
}

async function makeOrg() {
  const org = await db.organization.create({
    data: { name: "AppendOnlyTestOrg", stateCode: "33", settings: {} as Prisma.InputJsonValue },
  });
  const user = await db.user.create({
    data: {
      organizationId: org.id,
      mobile: "+919977665544",
      name: "AppendTest",
      role: "STORE",
      branchIds: [],
      status: "ACTIVE",
    },
  });
  const brand = await db.brand.create({ data: { organizationId: org.id, name: "ATB" } });
  const coll  = await db.collection.create({
    data: {
      organizationId: org.id, brandId: brand.id,
      name: "ATC", family: "CURTAIN_FABRIC", isActive: true,
    },
  });
  const design = await db.design.create({
    data: {
      organizationId: org.id, collectionId: coll.id,
      code: "ATD-001", name: "AT Design", family: "CURTAIN_FABRIC",
      patternMatch: "FREE", specs: {} as Prisma.InputJsonValue,
      hsn: "5407", gstRate: new Prisma.Decimal(12), isActive: true,
    },
  });
  const cw = await db.colourway.create({
    data: {
      organizationId: org.id, designId: design.id,
      code: "ATCW-001", colourName: "AT Colour", sellUnit: "METRE", isActive: true,
    },
  });
  return { orgId: org.id, userId: user.id, cwId: cw.id };
}

describe("StockMove append-only DB trigger", () => {
  it("allows INSERT on StockMove", async () => {
    const { orgId, userId, cwId } = await makeOrg();
    const move = await makeMinimalMove(orgId, cwId, userId);
    expect(move.id).toBeTruthy();
  }, 30_000);

  it("rejects UPDATE on StockMove with a Postgres exception", async () => {
    const { orgId, userId, cwId } = await makeOrg();
    const move = await makeMinimalMove(orgId, cwId, userId);

    await expect(
      // Raw SQL to confirm the trigger fires even outside Prisma's ORM layer
      db.$executeRaw`
        UPDATE "StockMove" SET "rate" = 9999 WHERE "id" = ${move.id}
      `,
    ).rejects.toThrow(/append-only/i);
  }, 30_000);

  it("rejects DELETE on StockMove with a Postgres exception", async () => {
    const { orgId, userId, cwId } = await makeOrg();
    const move = await makeMinimalMove(orgId, cwId, userId);

    await expect(
      db.$executeRaw`
        DELETE FROM "StockMove" WHERE "id" = ${move.id}
      `,
    ).rejects.toThrow(/append-only/i);
  }, 30_000);
});

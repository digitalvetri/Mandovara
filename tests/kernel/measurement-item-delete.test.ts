// Deleting a measured window must actually delete it.
//
// CalcResult.measurementItemId defaulted to ON DELETE RESTRICT. The engine
// writes a CalcResult for every item that has dimensions, so the Delete
// button on any real measurement failed with
//
//   Foreign key constraint violated on the constraint:
//   `CalcResult_measurementItemId_fkey`   (P2003)
//
// and the UI showed a full-page "Something went wrong". Nothing in the
// suite covered delete, so it shipped. This test is the reason it cannot
// ship again — it exercises the constraint at the database level, where
// the rule actually lives.

import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma as db } from "@/kernel/db/client";

let seq = 0;
async function makeMeasuredItem(withCalc: boolean) {
  const n = `${Date.now()}-${seq++}`;
  const org = await db.organization.create({
    data: { name: `DelTestOrg-${n}`, stateCode: "33", settings: {} as Prisma.InputJsonValue },
  });
  const user = await db.user.create({
    data: {
      organizationId: org.id, mobile: `+9199${String(n).slice(-8)}`,
      name: "DelTest", role: "MEASURE_EXEC", branchIds: [], status: "ACTIVE",
    },
  });
  // Lead-scoped: a round can belong to a lead OR a project, never both.
  const lead = await db.lead.create({
    data: {
      organizationId: org.id, number: `DEL-${n}`, name: "Del Lead",
      mobile: "+919000000000", source: "WALK_IN", ownerId: user.id,
    },
  });
  const round = await db.measurement.create({
    data: {
      organizationId: org.id, leadId: lead.id, number: `MEA-DEL-${n}`,
      visitedAt: new Date(), measuredById: user.id,
    },
  });
  const room = await db.room.create({
    data: { organizationId: org.id, leadId: lead.id, name: "Hall" },
  });
  const item = await db.measurementItem.create({
    data: {
      organizationId: org.id, measurementId: round.id, roomId: room.id,
      label: "East window", surface: "WINDOW",
      widthMm: new Prisma.Decimal("1524"), heightMm: new Prisma.Decimal("2438.4"),
      quantity: 1, family: "CURTAIN_FABRIC",
      headingType: "PINCH_PLEAT", fullness: new Prisma.Decimal("2"), photoKeys: [],
    },
  });
  if (withCalc) {
    await db.calcResult.create({
      data: {
        organizationId: org.id, measurementItemId: item.id, engineVersion: "test",
        inputs: {} as Prisma.InputJsonValue,
        materialQty: new Prisma.Decimal("8.52"), materialUnit: "METRE", warnings: [],
      },
    });
  }
  return { orgId: org.id, itemId: item.id };
}

describe("deleting a MeasurementItem", () => {
  it("succeeds when the engine has computed material for it", async () => {
    // The case that was broken: every window with dimensions has a calc row.
    const { itemId } = await makeMeasuredItem(true);
    await expect(db.measurementItem.delete({ where: { id: itemId } })).resolves.toBeTruthy();
    expect(await db.measurementItem.count({ where: { id: itemId } })).toBe(0);
  }, 30_000);

  it("takes the calc row with it rather than orphaning it", async () => {
    const { itemId } = await makeMeasuredItem(true);
    await db.measurementItem.delete({ where: { id: itemId } });
    // measurementItemId is UNIQUE, so a surviving row would be unreachable.
    expect(await db.calcResult.count({ where: { measurementItemId: itemId } })).toBe(0);
  }, 30_000);

  it("still works for an item measured before a product was picked", async () => {
    const { itemId } = await makeMeasuredItem(false);
    await expect(db.measurementItem.delete({ where: { id: itemId } })).resolves.toBeTruthy();
  }, 30_000);

  it("keeps a quotation line that referenced it, unlinked", async () => {
    // QuotationLine.measurementItemId is SET NULL by design — deleting a
    // measurement must not take a priced quotation line with it.
    const rule = await db.$queryRawUnsafe<{ delete_rule: string }[]>(`
      SELECT rc.delete_rule
        FROM information_schema.referential_constraints rc
       WHERE rc.constraint_name = 'QuotationLine_measurementItemId_fkey'
    `);
    expect(rule[0]?.delete_rule).toBe("SET NULL");
  }, 30_000);
});

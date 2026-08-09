// Phase 4 gate #3 — mixed-lot BLOCK + audited OVERRIDE, end-to-end.
//
// Goes through the actual allocateLots server action (not the pure
// allocateInTx primitive), then reads AuditLog to prove the action
// layer actually wrote the CREATE_MIXED_LOT row with the override
// reason. This is the audit-trail equivalent of smoke-quote-freeze.ts.
//
// Run: pnpm tsx scripts/smoke-mixed-lot-audit.ts

import { Prisma } from "@prisma/client";
import { prisma } from "../src/kernel/db/client";
import { allocateLots, releaseAllocation } from "../src/modules/allocation/actions";

const REASON = "SMOKE audit — client approved shade drift";

async function main() {
  // Use the seeded owner's org — devContext() inside allocateLots resolves
  // to the same org, and we're careful to clean up whatever we create.
  const owner = await prisma.user.findFirstOrThrow({
    where: { email: "owner@mandovara.example" },
    select: { orgId: true, id: true },
  });
  const branch = await prisma.branch.findFirstOrThrow({
    where: { orgId: owner.orgId }, select: { id: true },
  });
  const warehouse = await prisma.warehouse.findFirstOrThrow({
    where: { orgId: owner.orgId }, select: { id: true },
  });
  const client = await prisma.client.findFirstOrThrow({
    where: { orgId: owner.orgId }, select: { id: true },
  });
  const category = await prisma.category.findFirstOrThrow({
    where: { orgId: owner.orgId }, select: { id: true },
  });

  // Fresh product + two batches so this smoke never touches seeded state.
  const uniq = `SMOKE-MX-${Date.now()}`;
  const product = await prisma.product.create({
    data: {
      orgId: owner.orgId, categoryId: category.id,
      code: uniq, name: "SMOKE Curtain", hsn: "5407", uom: "METRE",
      gstRate: 18, trackBatch: true,
    },
    select: { id: true },
  });
  const batchA = await prisma.batch.create({
    data: {
      orgId: owner.orgId, productId: product.id, warehouseId: warehouse.id,
      batchNumber: `${uniq}-A`, quantity: new Prisma.Decimal(5),
    },
    select: { id: true },
  });
  const batchB = await prisma.batch.create({
    data: {
      orgId: owner.orgId, productId: product.id, warehouseId: warehouse.id,
      batchNumber: `${uniq}-B`, quantity: new Prisma.Decimal(5),
    },
    select: { id: true },
  });
  const so = await prisma.salesOrder.create({
    data: {
      orgId: owner.orgId, branchId: branch.id, clientId: client.id,
      number: uniq, date: new Date(), status: "CONFIRMED",
      taxableAmount: 0n, cgst: 0n, sgst: 0n, igst: 0n, total: 0n,
    },
    select: { id: true },
  });
  const line = await prisma.orderLine.create({
    data: {
      salesOrderId: so.id, lineNo: 1, productId: product.id,
      description: "SMOKE Curtain 2m",
      orderedQty: new Prisma.Decimal(6),
      rate: 500_00n, gstRate: new Prisma.Decimal(18), amount: 3000_00n,
    },
    select: { id: true },
  });
  console.log(`fixture: product ${uniq}, order line ${line.id}, batches ${batchA.id} / ${batchB.id}`);

  // Step 1 — seed the line with an allocation from LOT-A (clean single-lot).
  const first = await allocateLots({
    orderLineId: line.id, batchId: batchA.id, quantity: 2,
    mixedLotOverride: false,
  });
  if (!first.ok) { console.error("FAIL: first allocation errored:", first); process.exit(1); }
  console.log(`step 1: LOT-A allocation ${first.data!.id} · mixed=${first.data!.mixedLotOverride}`);

  // Step 2 — try LOT-B without override. Must be rejected by the gate.
  const blocked = await allocateLots({
    orderLineId: line.id, batchId: batchB.id, quantity: 1,
    mixedLotOverride: false,
  });
  if (blocked.ok) { console.error("FAIL: mixed-lot allocation was NOT blocked"); process.exit(1); }
  console.log(`step 2: LOT-B without override → blocked (${blocked.error})`);

  // Step 3 — try LOT-B WITH override + reason. Must succeed.
  const overridden = await allocateLots({
    orderLineId: line.id, batchId: batchB.id, quantity: 1,
    mixedLotOverride: true, overrideReason: REASON,
  });
  if (!overridden.ok) { console.error("FAIL: override was rejected:", overridden); process.exit(1); }
  console.log(`step 3: LOT-B with override → ok (${overridden.data!.id}), mixed=${overridden.data!.mixedLotOverride}`);

  // Step 4 — the load-bearing assertion: actions.ts wrote an AuditLog row
  // with action="CREATE_MIXED_LOT" and the override reason in `after`.
  const audit = await prisma.auditLog.findFirst({
    where: {
      orgId: owner.orgId,
      entityType: "LotAllocation",
      entityId: overridden.data!.id,
      action: "CREATE_MIXED_LOT",
    },
    select: { id: true, actorId: true, after: true },
  });
  if (!audit) { console.error("FAIL: no CREATE_MIXED_LOT AuditLog row"); process.exit(1); }
  const after = audit.after as { overrideReason?: string; dyeLot?: string; quantity?: string };
  console.log(`step 4: AuditLog ${audit.id} actor=${audit.actorId}`);
  console.log(`         after.dyeLot         = ${after.dyeLot}`);
  console.log(`         after.quantity       = ${after.quantity}`);
  console.log(`         after.overrideReason = ${after.overrideReason}`);
  if (after.overrideReason !== REASON) {
    console.error(`FAIL: audit reason mismatch (want '${REASON}', got '${after.overrideReason}')`);
    process.exit(1);
  }
  console.log("PASS — §0.6 mixed-lot override was blocked, permitted, and audited by actions.ts");

  // Cleanup — release allocations, then drop the fixture. Order matters:
  // Batch FK on LotAllocation is RESTRICT so allocations must go first.
  await releaseAllocation({ id: overridden.data!.id });
  await releaseAllocation({ id: first.data!.id });
  await prisma.lotAllocation.deleteMany({ where: { orderLineId: line.id } });
  await prisma.orderLine.delete({ where: { id: line.id } });
  await prisma.salesOrder.delete({ where: { id: so.id } });
  await prisma.batch.delete({ where: { id: batchA.id } });
  await prisma.batch.delete({ where: { id: batchB.id } });
  await prisma.product.delete({ where: { id: product.id } });
  console.log("Cleaned up smoke rows.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

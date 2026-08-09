// Smoke: prove §15 rule 3 wiring end-to-end. Builds a real quotation
// against seeded data, sends it, then reads back the QuotationLine.
// Expects: calcSnapshot column populated with engineVersion, inputs,
// outputs. Cleans up its own rows after.
//
// Run with: pnpm tsx scripts/smoke-quote-freeze.ts

import { prisma } from "../src/kernel/db/client";
import { runEngine } from "../src/modules/measurement/engine";
import { createQuotation, setQuotationStatus } from "../src/modules/quotations/actions";

async function main() {
  // Pick any project so we can attach a fresh measurement to it.
  const project = await prisma.project.findFirstOrThrow({
    select: { id: true, orgId: true, clientId: true, number: true, name: true },
  });
  const branch = await prisma.branch.findFirstOrThrow({
    where: { orgId: project.orgId }, select: { id: true },
  });
  const m2m = await prisma.product.findFirstOrThrow({
    where: { orgId: project.orgId, requiresMeasurement: true, status: "ACTIVE" },
    select: { id: true, code: true, name: true },
  });
  console.log(`Project ${project.number} · client ${project.clientId} · SKU ${m2m.code}`);

  // Fresh measurement + CalcResult for the freeze target.
  const measurement = await prisma.measurementItem.create({
    data: {
      orgId: project.orgId, projectId: project.id,
      roomLabel: "SMOKE freeze", label: "SMOKE freeze — window 1",
      family: "CURTAIN",
      inputs: {
        windowWidthMm: 1800, windowHeightMm: 2100, fullness: 2.5,
        fabricWidthMm: 1100, patternMatch: "FREE", patternRepeatMm: 0,
        railroadable: false, railroadedFabricWidthMm: 0, eyelet: false, lining: false,
      },
    },
    select: { id: true },
  });
  const engine = runEngine({
    family: "CURTAIN",
    projectId: project.id,
    roomLabel: "SMOKE freeze",
    label:     "SMOKE freeze — window 1",
    inputs: {
      windowWidthMm: 1800, windowHeightMm: 2100, fullness: 2.5,
      fabricWidthMm: 1100, patternMatch: "FREE", patternRepeatMm: 0,
      railroadable: false, railroadedFabricWidthMm: 0, eyelet: false, lining: false,
    },
  });
  await prisma.calcResult.create({
    data: {
      orgId: project.orgId, measurementItemId: measurement.id,
      engineVersion: engine.engineVersion, family: "CURTAIN",
      inputs: {
        windowWidthMm: 1800, windowHeightMm: 2100, fullness: 2.5,
        fabricWidthMm: 1100, patternMatch: "FREE", patternRepeatMm: 0,
        railroadable: false, railroadedFabricWidthMm: 0, eyelet: false, lining: false,
      },
      outputs: engine.outputs as object,
      warnings: engine.warnings,
    },
  });

  // Create a DRAFT quote with one M2M line referencing that measurement.
  const create = await createQuotation({
    clientId: project.clientId, branchId: branch.id,
    date:       new Date().toISOString().slice(0, 10),
    validUntil: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
    lines: [{
      productId:         m2m.id,
      description:       `SMOKE ${m2m.name}`,
      quantity:          1,
      rate:              "1000",
      discountPct:       0,
      measurementItemId: measurement.id,
    }],
  });
  if (!create.ok) {
    console.error("createQuotation FAILED:", create.error, create.fieldErrors);
    process.exit(1);
  }
  const quoteId = create.data!.id;
  console.log(`Draft quote ${quoteId} created`);

  // Assert: line exists WITH measurementItemId AND no snapshot yet (DRAFT).
  const linesBefore = await prisma.quotationLine.findMany({
    where: { quotationId: quoteId },
    select: { id: true, measurementItemId: true, calcSnapshot: true },
  });
  console.log(`  before SEND: ${linesBefore.length} line(s)`);
  for (const l of linesBefore) {
    console.log(`    line ${l.id}  measurementItemId=${l.measurementItemId}  snapshot=${l.calcSnapshot === null ? "null" : "SET"}`);
  }
  if (linesBefore.length !== 1) {
    console.error(`FAIL: expected exactly 1 line, got ${linesBefore.length}`);
    process.exit(1);
  }
  if (linesBefore[0]!.measurementItemId !== measurement.id) {
    console.error(`FAIL: measurementItemId not persisted (want ${measurement.id}, got ${linesBefore[0]!.measurementItemId})`);
    process.exit(1);
  }
  if (linesBefore[0]!.calcSnapshot !== null) {
    console.error("FAIL: DRAFT line should not carry calcSnapshot yet.");
    process.exit(1);
  }

  // SEND the quote — this is the moment the freeze must fire.
  const send = await setQuotationStatus({ id: quoteId, status: "SENT" });
  if (!send.ok) {
    console.error("setQuotationStatus FAILED:", send.error);
    process.exit(1);
  }
  console.log(`Quote flipped to SENT`);

  // Read back: measurement-linked line must now have a snapshot with the
  // engineVersion + outputs frozen.
  const linesAfter = await prisma.quotationLine.findMany({
    where: { quotationId: quoteId },
    select: {
      id: true, measurementItemId: true, calcSnapshot: true,
    },
  });
  let fail = false;
  let inspected = 0;
  for (const l of linesAfter) {
    if (!l.measurementItemId) {
      console.error(`FAIL: line ${l.id} lost measurementItemId across the SEND write`);
      fail = true; continue;
    }
    inspected++;
    if (l.calcSnapshot === null) {
      console.error(`FAIL: line ${l.id} has measurementItemId but calcSnapshot is null`);
      fail = true;
      continue;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = l.calcSnapshot as any;
    console.log(`  line ${l.id}`);
    console.log(`    engineVersion   = ${s.engineVersion}`);
    console.log(`    family          = ${s.family}`);
    console.log(`    outputs.fabricM = ${s.outputs?.fabricMetres}`);
    console.log(`    outputs.panels  = ${s.outputs?.panels}`);
    console.log(`    frozenAt        = ${s.frozenAt}`);
    if (s.engineVersion !== "curtain@1.0.0") { console.error("FAIL: engineVersion wrong"); fail = true; }
    if (!s.outputs?.fabricMetres)             { console.error("FAIL: outputs missing"); fail = true; }
    if (s.measurementItemId !== l.measurementItemId) { console.error("FAIL: measurementItemId mismatch"); fail = true; }
  }
  if (inspected === 0) { console.error("FAIL: no M2M lines were inspected — loop guard was silent"); fail = true; }
  if (fail) process.exit(1);
  console.log(`PASS — §15 rule 3 wiring writes calcSnapshot on DRAFT → SENT (${inspected} line(s) inspected)`);

  // Cleanup: drop the quote (cascades to lines), then the measurement +
  // calc so re-running the smoke doesn't accumulate rows.
  await prisma.quotation.delete({ where: { id: quoteId } });
  await prisma.calcResult.deleteMany({ where: { measurementItemId: measurement.id } });
  await prisma.measurementItem.delete({ where: { id: measurement.id } });
  console.log("Cleaned up smoke rows.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

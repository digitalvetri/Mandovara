// §14 Phase 5 gate — cut-list identity end-to-end.
//
// Runs the full spine: MeasurementItem + CalcResult →
// createQuotation (DRAFT) → setQuotationStatus SENT (freezes
// calcSnapshot) → setQuotationStatus ACCEPTED → createOrderFromQuotation
// (propagates measurementItemId + calcSnapshot onto OrderLine) →
// createMakeJobFromOrder (materialises MakeJobLine from the snapshot).
//
// Asserts panels + cutLengthMm are byte-identical at FOUR reads:
//   1. CalcResult.outputs
//   2. QuotationLine.calcSnapshot.outputs
//   3. OrderLine.calcSnapshot.outputs
//   4. MakeJobLine.{panels, cutLengthMm}
//
// Any drift = the gate fails. Self-cleaning; safe to re-run.
//
// Run: pnpm tsx scripts/smoke-cut-list-identity.ts

import { Prisma } from "@prisma/client";
import { prisma } from "../src/kernel/db/client";
import { runEngine } from "../src/modules/measurement/engine";
import { createQuotation, setQuotationStatus } from "../src/modules/quotations/actions";
import { createOrderFromQuotation } from "../src/modules/orders/actions";
import { createMakeJobFromOrder } from "../src/modules/make/actions";

const CURTAIN_INPUT = {
  windowWidthMm:   1800,
  windowHeightMm:  2100,
  fullness:        2.5,
  fabricWidthMm:   1100,
  patternMatch:    "FREE" as const,
  patternRepeatMm: 0,
  railroadable:    false,
  railroadedFabricWidthMm: 0,
  eyelet:          false,
  lining:          false,
};
const EXPECTED_PANELS = 5;
const EXPECTED_CUT_LENGTH_MM = 2400;

// Track what we create so cleanup runs even on assertion failure.
type Created = {
  measurementId?: string;
  quoteId?: string;
  orderId?: string;
  makeJobId?: string;
};
const created: Created = {};

async function main() {
  // 1. Fixture: fresh curtain measurement + CalcResult on any project.
  const project = await prisma.project.findFirstOrThrow({
    select: { id: true, orgId: true, clientId: true, number: true },
  });
  const branch = await prisma.branch.findFirstOrThrow({
    where:  { orgId: project.orgId },
    select: { id: true },
  });
  const m2m = await prisma.product.findFirstOrThrow({
    where:  { orgId: project.orgId, requiresMeasurement: true, status: "ACTIVE" },
    select: { id: true, name: true },
  });
  console.log(`fixture: project ${project.number}  ·  M2M SKU ${m2m.name}`);

  // Seed now reserves NumberingSeries counters post-seed (see
  // reserveNumberingCounters in prisma/seed/transactions.ts), so no
  // local counter bump needed here.

  const measurement = await prisma.measurementItem.create({
    data: {
      orgId: project.orgId, projectId: project.id,
      roomLabel: "SMOKE cut-list", label:  "SMOKE cut-list — window 1",
      family: "CURTAIN", inputs: CURTAIN_INPUT,
    },
    select: { id: true },
  });
  created.measurementId = measurement.id;

  const engine = runEngine({
    family: "CURTAIN", projectId: project.id,
    roomLabel: "SMOKE cut-list",
    label:     "SMOKE cut-list — window 1",
    inputs:    CURTAIN_INPUT,
  });
  await prisma.calcResult.create({
    data: {
      orgId: project.orgId, measurementItemId: measurement.id,
      engineVersion: engine.engineVersion, family: "CURTAIN",
      inputs:   CURTAIN_INPUT,
      outputs:  engine.outputs as object,
      warnings: engine.warnings,
    },
  });

  // HOP 1 — CalcResult.outputs must carry the engine's values.
  const calc = await prisma.calcResult.findUniqueOrThrow({
    where:  { measurementItemId: measurement.id },
    select: { outputs: true, engineVersion: true },
  });
  const calcOutputs = calc.outputs as { panels?: number; cutLengthMm?: number };
  console.log(`hop 1 · CalcResult.outputs         panels=${calcOutputs.panels}  cutLengthMm=${calcOutputs.cutLengthMm}`);
  assertEq("hop 1 panels", calcOutputs.panels, EXPECTED_PANELS);
  assertEq("hop 1 cutLengthMm", calcOutputs.cutLengthMm, EXPECTED_CUT_LENGTH_MM);

  // 2. DRAFT quote → SEND (freezes calcSnapshot).
  const draft = await createQuotation({
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
  if (!draft.ok) throw new Error(`createQuotation FAILED: ${draft.error} ${JSON.stringify(draft.fieldErrors)}`);
  created.quoteId = draft.data!.id;

  const send = await setQuotationStatus({ id: created.quoteId, status: "SENT" });
  if (!send.ok) throw new Error(`SEND FAILED: ${send.error}`);
  const accept = await setQuotationStatus({ id: created.quoteId, status: "ACCEPTED" });
  if (!accept.ok) throw new Error(`ACCEPT FAILED: ${accept.error}`);

  // HOP 2 — QuotationLine.calcSnapshot.outputs after SEND freeze.
  const qLines = await prisma.quotationLine.findMany({
    where: { quotationId: created.quoteId },
    select: { calcSnapshot: true, measurementItemId: true },
  });
  const qOutputs = extractOutputs(qLines[0]?.calcSnapshot);
  console.log(`hop 2 · QuotationLine.calcSnapshot panels=${qOutputs.panels}  cutLengthMm=${qOutputs.cutLengthMm}`);
  assertEq("hop 2 panels", qOutputs.panels, EXPECTED_PANELS);
  assertEq("hop 2 cutLengthMm", qOutputs.cutLengthMm, EXPECTED_CUT_LENGTH_MM);

  // 3. Convert to order — Phase 5a edit copies the snapshot across.
  const orderRes = await createOrderFromQuotation({ quotationId: created.quoteId });
  if (!orderRes.ok) throw new Error(`createOrderFromQuotation FAILED: ${orderRes.error}`);
  created.orderId = orderRes.data!.id;
  console.log(`order ${orderRes.data!.number} minted from quote`);

  // HOP 3 — OrderLine.calcSnapshot.outputs.
  const oLines = await prisma.orderLine.findMany({
    where: { salesOrderId: created.orderId },
    select: { id: true, calcSnapshot: true, measurementItemId: true },
  });
  const oOutputs = extractOutputs(oLines[0]?.calcSnapshot);
  console.log(`hop 3 · OrderLine.calcSnapshot     panels=${oOutputs.panels}  cutLengthMm=${oOutputs.cutLengthMm}`);
  assertEq("hop 3 panels", oOutputs.panels, EXPECTED_PANELS);
  assertEq("hop 3 cutLengthMm", oOutputs.cutLengthMm, EXPECTED_CUT_LENGTH_MM);
  assertEq("hop 3 measurementItemId propagated", oLines[0]?.measurementItemId, measurement.id);

  // 4. Mint the make job — buildCutList reads the snapshot.
  const mj = await createMakeJobFromOrder({ orderId: created.orderId });
  if (!mj.ok) throw new Error(`createMakeJobFromOrder FAILED: ${mj.error}`);
  created.makeJobId = mj.data!.id;
  console.log(`make job ${mj.data!.number} minted (${mj.data!.lineCount} line(s))`);

  // HOP 4 — MakeJobLine columns match what the engine produced.
  const mLines = await prisma.makeJobLine.findMany({
    where:  { makeJobId: created.makeJobId },
    select: { panels: true, cutLengthMm: true, orderLineId: true, roomLabel: true },
  });
  if (mLines.length !== 1) {
    throw new Error(`FAIL: expected 1 MakeJobLine, got ${mLines.length}`);
  }
  const mLine = mLines[0]!;
  const mCutLenNum = mLine.cutLengthMm == null ? null : Number(mLine.cutLengthMm);
  console.log(`hop 4 · MakeJobLine                panels=${mLine.panels}  cutLengthMm=${mCutLenNum}  roomLabel=${mLine.roomLabel}`);
  assertEq("hop 4 panels", mLine.panels, EXPECTED_PANELS);
  assertEq("hop 4 cutLengthMm", mCutLenNum, EXPECTED_CUT_LENGTH_MM);
  assertEq("hop 4 orderLineId links back", mLine.orderLineId, oLines[0]?.id);

  console.log("");
  console.log(`PASS — §14 Phase 5 identity holds across all 4 hops`);
  console.log(`       panels=${EXPECTED_PANELS}  cutLengthMm=${EXPECTED_CUT_LENGTH_MM}`);
}

// ── helpers ──────────────────────────────────────────────────────

function assertEq(what: string, got: unknown, want: unknown): void {
  // Prisma.Decimal vs number: coerce for comparison but log the raw.
  const g = got instanceof Prisma.Decimal ? Number(got) : got;
  if (g !== want) {
    throw new Error(`FAIL: ${what}  want=${want}  got=${g}`);
  }
}

function extractOutputs(snapshot: unknown): { panels?: number; cutLengthMm?: number } {
  if (snapshot == null || typeof snapshot !== "object") return {};
  const s = snapshot as { outputs?: unknown };
  if (s.outputs == null || typeof s.outputs !== "object") return {};
  return s.outputs as { panels?: number; cutLengthMm?: number };
}


async function cleanup() {
  // Order matters: FK RESTRICT on MakeJobLine.orderLineId means we
  // must drop the make job before its order. Cascades on MakeJob →
  // MakeJobLine handle the child rows.
  try {
    if (created.makeJobId)  await prisma.makeJob.delete({ where: { id: created.makeJobId } });
    if (created.orderId) {
      // Quotation.status was set to CONVERTED; drop the order first,
      // then the quote (which cascades to QuotationLine rows).
      await prisma.salesOrder.delete({ where: { id: created.orderId } });
    }
    if (created.quoteId)    await prisma.quotation.delete({ where: { id: created.quoteId } });
    if (created.measurementId) {
      await prisma.calcResult.deleteMany({ where: { measurementItemId: created.measurementId } });
      await prisma.measurementItem.delete({ where: { id: created.measurementId } });
    }
    console.log("Cleaned up smoke rows.");
  } catch (e) {
    console.warn("cleanup partial:", (e as Error).message);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

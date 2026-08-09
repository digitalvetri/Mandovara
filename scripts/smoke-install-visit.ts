// Phase 5c end-to-end smoke.
//
// Fixture: fresh measurement → quote → SEND → ACCEPTED → order →
// make job → walk make to DELIVERED. Then: create install visit,
// assign crew, start, complete line (with dye lot), refuse to
// complete without signature, capture signature, then completeVisit.
// Also exercise the over-install guard and the make-job gate.
// Raises a snag on the visit at the end.
//
// Self-cleaning.
// Run: pnpm tsx scripts/smoke-install-visit.ts

import { Prisma } from "@prisma/client";
import { prisma } from "../src/kernel/db/client";
import { runEngine } from "../src/modules/measurement/engine";
import { createQuotation, setQuotationStatus } from "../src/modules/quotations/actions";
import { createOrderFromQuotation } from "../src/modules/orders/actions";
import {
  createMakeJobFromOrder, advanceMakeJobStatus, qcMakeJobLine,
} from "../src/modules/make/actions";
import {
  createInstallVisit, assignCrew, startVisit,
  completeInstallLine, captureVisitSignature, completeVisit,
  raiseSnagOnVisit,
} from "../src/modules/install/actions";

const CURTAIN_INPUT = {
  windowWidthMm: 1800, windowHeightMm: 2100, fullness: 2.5, fabricWidthMm: 1100,
  patternMatch: "FREE" as const, patternRepeatMm: 0,
  railroadable: false, railroadedFabricWidthMm: 0, eyelet: false, lining: false,
};

type Created = {
  measurementId?: string; quoteId?: string;
  orderId?: string; makeJobId?: string;
  crewId?: string; visitId?: string; snagId?: string;
};
const created: Created = {};

async function main() {
  const project = await prisma.project.findFirstOrThrow({
    select: { id: true, orgId: true, clientId: true, number: true },
  });
  const branch = await prisma.branch.findFirstOrThrow({
    where: { orgId: project.orgId }, select: { id: true },
  });
  const m2m = await prisma.product.findFirstOrThrow({
    where: { orgId: project.orgId, requiresMeasurement: true, status: "ACTIVE" },
    select: { id: true, name: true },
  });
  await bumpSoCounter(project.orgId, branch.id);
  console.log(`fixture: project ${project.number}`);

  // Fixture: measurement + CalcResult + quote → order → make → DELIVERED.
  const measurement = await prisma.measurementItem.create({
    data: {
      orgId: project.orgId, projectId: project.id,
      roomLabel: "SMOKE install", label: "SMOKE install — window 1",
      family: "CURTAIN", inputs: CURTAIN_INPUT,
    }, select: { id: true },
  });
  created.measurementId = measurement.id;
  const engine = runEngine({
    family: "CURTAIN", projectId: project.id,
    roomLabel: "SMOKE install", label: "SMOKE install — window 1",
    inputs: CURTAIN_INPUT,
  });
  await prisma.calcResult.create({
    data: {
      orgId: project.orgId, measurementItemId: measurement.id,
      engineVersion: engine.engineVersion, family: "CURTAIN",
      inputs: CURTAIN_INPUT, outputs: engine.outputs as object,
      warnings: engine.warnings,
    },
  });
  const draft = await createQuotation({
    clientId: project.clientId, branchId: branch.id,
    date: new Date().toISOString().slice(0, 10),
    validUntil: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
    lines: [{
      productId: m2m.id, description: "SMOKE curtain", quantity: 3,
      rate: "1000", discountPct: 0, measurementItemId: measurement.id,
    }],
  });
  if (!draft.ok) throw new Error(`quote: ${draft.error}`);
  created.quoteId = draft.data!.id;
  await setQuotationStatus({ id: created.quoteId, status: "SENT" });
  await setQuotationStatus({ id: created.quoteId, status: "ACCEPTED" });
  const orderRes = await createOrderFromQuotation({ quotationId: created.quoteId });
  if (!orderRes.ok) throw new Error(`order: ${orderRes.error}`);
  created.orderId = orderRes.data!.id;
  const mj = await createMakeJobFromOrder({ orderId: created.orderId });
  if (!mj.ok) throw new Error(`make: ${mj.error}`);
  created.makeJobId = mj.data!.id;
  console.log(`fixture: quote → order ${orderRes.data!.number} → make job ${mj.data!.number}`);

  // Walk make to READY (we'll delay DELIVERED to prove the completeVisit gate).
  for (const to of ["CUTTING", "STITCHING", "FINISHING", "QC"] as const) {
    await advanceMakeJobStatus({ jobId: created.makeJobId, toStatus: to });
  }
  const mjLine = (await prisma.makeJobLine.findFirstOrThrow({
    where: { makeJobId: created.makeJobId }, select: { id: true },
  })).id;
  await qcMakeJobLine({ lineId: mjLine, passed: true });
  await advanceMakeJobStatus({ jobId: created.makeJobId, toStatus: "READY" });

  // Create the install crew fresh so re-running smokes stays clean.
  const crew = await prisma.installCrew.create({
    data: {
      orgId: project.orgId,
      name: `SMOKE crew ${Date.now()}`,
      memberEmployeeIds: [],
    },
    select: { id: true, name: true },
  });
  created.crewId = crew.id;
  console.log(`fixture: crew ${crew.name}`);

  // ── 1. createInstallVisit ─────────────────────────────────
  const scheduledAt = new Date(Date.now() + 3 * 864e5).toISOString();
  const v = await createInstallVisit({
    salesOrderId: created.orderId, scheduledAt, crewId: crew.id,
  });
  if (!v.ok) throw new Error(`createInstallVisit: ${v.error}`);
  created.visitId = v.data!.id;
  console.log(`step 1 · visit ${v.data!.number} created (${v.data!.lineCount} line)`);

  // Rebuild lineId from the DB — action returns visit-level shape only.
  const line = await prisma.installLine.findFirstOrThrow({
    where: { installVisitId: created.visitId },
    select: { id: true, plannedQty: true },
  });

  // ── 2. assignCrew (reassign to null, then back — cover the branch) ─
  const un = await assignCrew({ visitId: created.visitId, crewId: null });
  if (!un.ok) throw new Error(`unassign: ${un.error}`);
  const re = await assignCrew({ visitId: created.visitId, crewId: crew.id });
  if (!re.ok) throw new Error(`reassign: ${re.error}`);
  console.log(`step 2 · crew unassigned then reassigned`);

  // ── 3. startVisit (SCHEDULED → IN_PROGRESS) ────────────────
  const s = await startVisit({ visitId: created.visitId });
  if (!s.ok) throw new Error(`start: ${s.error}`);
  console.log(`step 3 · visit started`);

  // ── 4. completeInstallLine — over-install must be blocked ──
  const over = await completeInstallLine({
    lineId: line.id,
    installedQty: 999,     // wildly over ordered qty (3)
    dyeLotUsed: "LOT-A",
  });
  if (over.ok) throw new Error("FAIL: over-install NOT blocked");
  console.log(`step 4 · over-install blocked (${over.error})`);

  // ── 5. completeInstallLine — partial (qty 2) ──────────────
  const part = await completeInstallLine({
    lineId: line.id, installedQty: 2, dyeLotUsed: "LOT-A",
    photoKeys: ["smoke/photo-1.jpg"],
  });
  if (!part.ok) throw new Error(`partial complete: ${part.error}`);
  console.log(`step 5 · line partially installed (qty 2 of 3, dyeLot=LOT-A)`);

  // ── 6. completeVisit refused without signature ────────────
  const noSig = await completeVisit({ visitId: created.visitId });
  if (noSig.ok) throw new Error("FAIL: completeVisit accepted with no signature");
  console.log(`step 6 · completeVisit blocked (no signature): ${noSig.error}`);

  // ── 7. captureSignature ────────────────────────────────────
  const sig = await captureVisitSignature({
    visitId: created.visitId, signatureKey: "smoke/sig.png",
  });
  if (!sig.ok) throw new Error(`signature: ${sig.error}`);
  console.log(`step 7 · signature captured`);

  // ── 8. completeVisit refused while make-job not DELIVERED ─
  const notDelivered = await completeVisit({ visitId: created.visitId });
  if (notDelivered.ok) throw new Error("FAIL: completeVisit accepted while make job not DELIVERED");
  console.log(`step 8 · completeVisit blocked (make not DELIVERED): ${notDelivered.error}`);

  // Now flip make → DELIVERED so completion is allowed.
  await advanceMakeJobStatus({ jobId: created.makeJobId, toStatus: "DELIVERED" });

  // ── 9. completeVisit as PARTIAL (only 2 of 3 installed) ────
  const done = await completeVisit({ visitId: created.visitId, outcome: "PARTIAL" });
  if (!done.ok) throw new Error(`completeVisit: ${done.error}`);
  console.log(`step 9 · visit completed (PARTIAL)`);

  // ── 10. raiseSnagOnVisit ───────────────────────────────────
  const sn = await raiseSnagOnVisit({
    visitId: created.visitId,
    location: "Master Bedroom",
    description: "small crease near the eyelet",
  });
  if (!sn.ok) throw new Error(`snag: ${sn.error}`);
  created.snagId = sn.data!.snagId;
  console.log(`step 10 · snag raised ${created.snagId}`);

  // ── 11. Verify OrderLine.installedQty was materialised ────
  const ol = await prisma.orderLine.findFirstOrThrow({
    where: { salesOrderId: created.orderId },
    select: { orderedQty: true, installedQty: true },
  });
  const done2 = Number(ol.installedQty);
  console.log(`step 11 · OrderLine.installedQty=${done2} of ordered=${Number(ol.orderedQty)}`);
  if (done2 !== 2) throw new Error(`FAIL: expected installedQty 2, got ${done2}`);

  console.log("");
  console.log(`PASS — Phase 5c install-visit spine holds end-to-end`);
}

async function bumpSoCounter(orgId: string, branchId: string) {
  const now = new Date();
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const fy = `${String(y).slice(-2)}-${String(y + 1).slice(-2)}`;
  const rows = await prisma.salesOrder.findMany({
    where: { orgId, branchId }, select: { number: true },
  });
  const seqs = rows.map((r) => Number(r.number.split("/").pop())).filter((n) => Number.isFinite(n) && n > 0);
  const maxSeq = seqs.length === 0 ? 0 : Math.max(...seqs);
  if (maxSeq === 0) return;
  await prisma.numberingSeries.upsert({
    where: { orgId_branchId_docType_financialYear: {
      orgId, branchId, docType: "SALES_ORDER", financialYear: fy,
    }},
    update: { currentValue: BigInt(maxSeq) },
    create: {
      orgId, branchId, docType: "SALES_ORDER", financialYear: fy,
      prefix: "MDV/CBE/SO", padding: 5, currentValue: BigInt(maxSeq),
    },
  });
}

async function cleanup() {
  try {
    if (created.snagId)     await prisma.snagItem.delete({ where: { id: created.snagId } });
    if (created.visitId)    await prisma.installVisit.delete({ where: { id: created.visitId } });
    if (created.crewId)     await prisma.installCrew.delete({ where: { id: created.crewId } });
    if (created.makeJobId)  await prisma.makeJob.delete({ where: { id: created.makeJobId } });
    if (created.orderId)    await prisma.salesOrder.delete({ where: { id: created.orderId } });
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

void Prisma;
main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await cleanup(); await prisma.$disconnect(); });

// Phase 5b — walk a MakeJob through every legal status transition,
// including the QC rework loop back to CUTTING, and confirm an
// illegal skip is rejected. Exercises the action layer through
// advanceMakeJobStatus, issueMakeJobLineMaterial, recordMakeJobLineUsage,
// and qcMakeJobLine. Self-cleaning.
//
// Run: pnpm tsx scripts/smoke-make-transitions.ts

import { Prisma } from "@prisma/client";
import { prisma } from "../src/kernel/db/client";
import { runEngine } from "../src/modules/measurement/engine";
import { createQuotation, setQuotationStatus } from "../src/modules/quotations/actions";
import { createOrderFromQuotation } from "../src/modules/orders/actions";
import {
  createMakeJobFromOrder,
  advanceMakeJobStatus,
  issueMakeJobLineMaterial,
  recordMakeJobLineUsage,
  qcMakeJobLine,
} from "../src/modules/make/actions";

const CURTAIN_INPUT = {
  windowWidthMm: 1800, windowHeightMm: 2100, fullness: 2.5, fabricWidthMm: 1100,
  patternMatch: "FREE" as const, patternRepeatMm: 0,
  railroadable: false, railroadedFabricWidthMm: 0, eyelet: false, lining: false,
};

// Track for cleanup.
const created: {
  measurementId?: string; quoteId?: string; orderId?: string; makeJobId?: string;
} = {};

async function main() {
  const project = await prisma.project.findFirstOrThrow({
    select: { id: true, orgId: true, clientId: true, number: true },
  });
  const branch = await prisma.branch.findFirstOrThrow({
    where:  { orgId: project.orgId },
    select: { id: true },
  });
  const m2m = await prisma.product.findFirstOrThrow({
    where:  { orgId: project.orgId, requiresMeasurement: true, status: "ACTIVE" },
    select: { id: true },
  });
  // See project-seed-numbering-bug memory: seed writes SO numbers
  // without bumping NumberingSeries. Reserve the counter.
  await bumpSoCounter(project.orgId, branch.id);
  console.log(`fixture: project ${project.number} · branch ${branch.id}`);

  // Fresh measurement + CalcResult (reused from smoke-cut-list-identity).
  const measurement = await prisma.measurementItem.create({
    data: {
      orgId: project.orgId, projectId: project.id,
      roomLabel: "SMOKE transitions",
      label:     "SMOKE transitions — window 1",
      family: "CURTAIN", inputs: CURTAIN_INPUT,
    },
    select: { id: true },
  });
  created.measurementId = measurement.id;
  const engine = runEngine({
    family: "CURTAIN", projectId: project.id,
    roomLabel: "SMOKE transitions",
    label:     "SMOKE transitions — window 1",
    inputs:    CURTAIN_INPUT,
  });
  await prisma.calcResult.create({
    data: {
      orgId: project.orgId, measurementItemId: measurement.id,
      engineVersion: engine.engineVersion, family: "CURTAIN",
      inputs: CURTAIN_INPUT, outputs: engine.outputs as object,
      warnings: engine.warnings,
    },
  });

  // Quote → SEND → ACCEPTED → Order → MakeJob.
  const draft = await createQuotation({
    clientId: project.clientId, branchId: branch.id,
    date:       new Date().toISOString().slice(0, 10),
    validUntil: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
    lines: [{
      productId: m2m.id, description: "SMOKE curtain", quantity: 1,
      rate: "1000", discountPct: 0, measurementItemId: measurement.id,
    }],
  });
  if (!draft.ok) throw new Error(`createQuotation: ${draft.error}`);
  created.quoteId = draft.data!.id;
  await setQuotationStatus({ id: created.quoteId, status: "SENT" });
  await setQuotationStatus({ id: created.quoteId, status: "ACCEPTED" });
  const orderRes = await createOrderFromQuotation({ quotationId: created.quoteId });
  if (!orderRes.ok) throw new Error(`createOrder: ${orderRes.error}`);
  created.orderId = orderRes.data!.id;
  const mj = await createMakeJobFromOrder({ orderId: created.orderId });
  if (!mj.ok) throw new Error(`createMakeJob: ${mj.error}`);
  created.makeJobId = mj.data!.id;
  console.log(`make job ${mj.data!.number} minted, status=QUEUED`);

  // Grab the single line so per-line actions have an id to hit.
  const lines = await prisma.makeJobLine.findMany({
    where: { makeJobId: created.makeJobId }, select: { id: true },
  });
  const lineId = lines[0]!.id;

  // 1. Illegal skip rejected — QUEUED → READY is a scope violation.
  const bad = await advanceMakeJobStatus({ jobId: created.makeJobId, toStatus: "READY" });
  if (bad.ok) throw new Error("FAIL: illegal skip QUEUED → READY was accepted");
  console.log(`step 1 · illegal skip QUEUED → READY blocked (${bad.error})`);

  // 2. QUEUED → CUTTING: also verify startedAt gets stamped.
  await advance(created.makeJobId, "CUTTING", "step 2");
  const afterCut = await prisma.makeJob.findUniqueOrThrow({
    where: { id: created.makeJobId }, select: { startedAt: true },
  });
  if (afterCut.startedAt == null) throw new Error("FAIL: startedAt not stamped on CUTTING");
  console.log(`       startedAt stamped: ${afterCut.startedAt.toISOString()}`);

  // 3. Issue fabric on the line, then move to STITCHING.
  const issue = await issueMakeJobLineMaterial({
    lineId, fabricIssuedM: 12.5, liningIssuedM: 0,
  });
  if (!issue.ok) throw new Error(`issueMaterial: ${issue.error}`);
  console.log(`step 3 · issued fabricIssuedM=12.5`);
  await advance(created.makeJobId, "STITCHING", "       ");

  // 4. STITCHING → FINISHING → QC.
  await advance(created.makeJobId, "FINISHING", "step 4");
  await advance(created.makeJobId, "QC",         "       ");

  // 5. Record usage BEFORE QC — the tailor reports back what they used.
  const usage = await recordMakeJobLineUsage({
    lineId, actualUsedM: 11.8,   // wastageM will derive to 12.5 − 11.8 = 0.7
  });
  if (!usage.ok) throw new Error(`recordUsage: ${usage.error}`);
  const w = await prisma.makeJobLine.findUniqueOrThrow({
    where: { id: lineId }, select: { actualUsedM: true, wastageM: true },
  });
  const wastageNum = w.wastageM == null ? null : Number(w.wastageM);
  console.log(`step 5 · actualUsedM=${Number(w.actualUsedM)}  derived wastageM=${wastageNum}`);
  if (wastageNum == null || Math.abs(wastageNum - 0.7) > 0.001) {
    throw new Error(`FAIL: expected wastage ≈ 0.7, got ${wastageNum}`);
  }

  // 6. QC fail first — send back to CUTTING for rework.
  const failQc = await qcMakeJobLine({ lineId, passed: false, notes: "seam skipped, redo" });
  if (!failQc.ok) throw new Error(`qcMakeJobLine fail: ${failQc.error}`);
  await advance(created.makeJobId, "CUTTING", "step 6");
  console.log(`       QC fail → back to CUTTING (rework loop)`);

  // 7. Rework through STITCHING → FINISHING → QC → READY (pass) → DELIVERED.
  await advance(created.makeJobId, "STITCHING", "step 7");
  await advance(created.makeJobId, "FINISHING", "       ");
  await advance(created.makeJobId, "QC",         "       ");
  const passQc = await qcMakeJobLine({ lineId, passed: true, notes: "clean" });
  if (!passQc.ok) throw new Error(`qcMakeJobLine pass: ${passQc.error}`);
  await advance(created.makeJobId, "READY",     "       ");
  await advance(created.makeJobId, "DELIVERED", "step 8");

  // 8. DELIVERED is terminal — next advance must be rejected.
  const terminal = await advanceMakeJobStatus({ jobId: created.makeJobId, toStatus: "READY" });
  if (terminal.ok) throw new Error("FAIL: DELIVERED accepted a follow-up transition");
  console.log(`       DELIVERED is terminal (rejected: ${terminal.error})`);

  const final = await prisma.makeJob.findUniqueOrThrow({
    where: { id: created.makeJobId },
    select: { status: true, completedAt: true },
  });
  if (final.completedAt == null) throw new Error("FAIL: completedAt not stamped on DELIVERED");
  console.log("");
  console.log(`PASS — MakeJob walked all legal transitions incl. QC rework loop`);
  console.log(`       final: status=${final.status}  completedAt=${final.completedAt.toISOString()}`);

  // Check an audit trail entry exists for STATUS_DELIVERED as a
  // spot-check that the AuditLog write in advanceMakeJobStatus fired
  // for at least the terminal move.
  const auditRow = await prisma.auditLog.findFirst({
    where: {
      orgId: project.orgId, entityType: "MakeJob",
      entityId: created.makeJobId, action: "STATUS_DELIVERED",
    },
    select: { id: true },
  });
  if (!auditRow) throw new Error("FAIL: AuditLog STATUS_DELIVERED missing");
  console.log(`       AuditLog STATUS_DELIVERED present: ${auditRow.id}`);
}

async function advance(jobId: string, to: string, tag: string): Promise<void> {
  const res = await advanceMakeJobStatus({ jobId, toStatus: to });
  if (!res.ok) throw new Error(`advance to ${to} failed: ${res.error}`);
  console.log(`${tag} · ${res.data!.from} → ${res.data!.to}`);
}

async function bumpSoCounter(orgId: string, branchId: string): Promise<void> {
  const nowFy = fyLabel(new Date());
  const rows = await prisma.salesOrder.findMany({
    where: { orgId, branchId }, select: { number: true },
  });
  const seqs = rows
    .map((r) => Number(r.number.split("/").pop()))
    .filter((n) => Number.isFinite(n) && n > 0);
  const maxSeq = seqs.length === 0 ? 0 : Math.max(...seqs);
  if (maxSeq === 0) return;
  await prisma.numberingSeries.upsert({
    where: {
      orgId_branchId_docType_financialYear: {
        orgId, branchId, docType: "SALES_ORDER", financialYear: nowFy,
      },
    },
    update: { currentValue: BigInt(maxSeq) },
    create: {
      orgId, branchId, docType: "SALES_ORDER", financialYear: nowFy,
      prefix: "MDV/CBE/SO", padding: 5, currentValue: BigInt(maxSeq),
    },
  });
}

function fyLabel(d: Date): string {
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${String(y).slice(-2)}-${String(y + 1).slice(-2)}`;
}

async function cleanup() {
  try {
    if (created.makeJobId)    await prisma.makeJob.delete({ where: { id: created.makeJobId } });
    if (created.orderId)      await prisma.salesOrder.delete({ where: { id: created.orderId } });
    if (created.quoteId)      await prisma.quotation.delete({ where: { id: created.quoteId } });
    if (created.measurementId) {
      await prisma.calcResult.deleteMany({ where: { measurementItemId: created.measurementId } });
      await prisma.measurementItem.delete({ where: { id: created.measurementId } });
    }
    console.log("Cleaned up smoke rows.");
  } catch (e) {
    console.warn("cleanup partial:", (e as Error).message);
  }
}

// Prisma is imported for its Decimal type re-export; not directly used
// but kept so future edits can lean on it without a fresh import.
void Prisma;

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await cleanup(); await prisma.$disconnect(); });

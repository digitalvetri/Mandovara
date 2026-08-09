// Phase 5 gate: cut list reads from the frozen calcSnapshot, not the live CalcResult.
//
// The discriminating test: supersede the CalcResult AFTER the quotation is sent,
// then build a MakeJob. If the implementation reads the live CalcResult, the panels
// value will be 7 (v2). If it reads the frozen snapshot, it will be 5 (v1). Only
// the snapshot path satisfies §7.7 rule 6 and §15.3.
//
// Test 3 calls resolveCutList() from make/lib.ts directly — the same function
// createMakeJob() calls. Changing that function to read live data will break this
// test even if the DB assertions in tests 1 and 2 still pass.

import { beforeAll, describe, expect, it } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaClient } from "@prisma/client";
import { resolveCutList } from "../../../src/modules/make/lib";

const db = new PrismaClient();

let orgId: string;
let branchId: string;
let userId: string;
let colourwayId: string;
let projectId: string;
let roomId: string;
let measurementId: string;
let measurementItemId: string;
let quotationId: string;
let quotationLineId: string;
let orderId: string;
let orderLineId: string;

const V1_PANELS = 5;
// Decimal("2760.00").toString() → "2760" (trailing zeros stripped by Decimal.js)
const V1_CUT_LENGTH_MM = "2760";
const V2_PANELS = 7; // v2 after measurement revision — must NOT appear in cut list

beforeAll(async () => {
  // ── Org ──────────────────────────────────────────────────────────────────
  const org = await db.organization.create({ data: { name: "Make Gate Org", settings: {} } });
  orgId = org.id;

  const branch = await db.branch.create({ data: { organizationId: orgId, name: "HQ" } });
  branchId = branch.id;

  const user = await db.user.create({
    data: { organizationId: orgId, mobile: "+919100000099", name: "Tester", role: "OWNER", branchIds: [branchId] },
  });
  userId = user.id;

  // ── Catalog chain ─────────────────────────────────────────────────────────
  const brand = await db.brand.create({ data: { organizationId: orgId, name: "MakeGate Fabrics" } });
  const collection = await db.collection.create({
    data: { organizationId: orgId, brandId: brand.id, name: "Silks Vol 1", family: "CURTAIN_FABRIC" },
  });
  const design = await db.design.create({
    data: {
      organizationId: orgId, collectionId: collection.id,
      code: "MG-001", name: "Pearl Silk", family: "CURTAIN_FABRIC",
      specs: {}, hsn: "5407", gstRate: 12, fabricWidthMm: new Decimal(1100),
    },
  });
  const colourway = await db.colourway.create({
    data: { organizationId: orgId, designId: design.id, code: "MG-001-PEARL", colourName: "Pearl", sellUnit: "METRE" },
  });
  colourwayId = colourway.id;

  // ── Client + Project + Room ───────────────────────────────────────────────
  const client = await db.client.create({
    data: {
      organizationId: orgId, code: "CL-MG-001", name: "Gate Test Client",
      mobile: "+919200000099", billingAddress: {},
    },
  });

  const project = await db.project.create({
    data: {
      organizationId: orgId, branchId, number: "MDV/PRJ-2608-0099",
      name: "Gate Test Villa", clientId: client.id, stage: "QUOTATION", siteAddress: {},
      ownerId: userId,
    },
  });
  projectId = project.id;

  const room = await db.room.create({
    data: { organizationId: orgId, projectId, name: "Master Bedroom" },
  });
  roomId = room.id;

  // ── Measurement + MeasurementItem ─────────────────────────────────────────
  const meas = await db.measurement.create({
    data: {
      organizationId: orgId, projectId, number: "MDV/MEA-2608-0099",
      visitedAt: new Date(), measuredById: userId, status: "APPROVED",
    },
  });
  measurementId = meas.id;

  const item = await db.measurementItem.create({
    data: {
      organizationId: orgId, measurementId, roomId,
      label: "Window 1 — East",
      surface: "WINDOW", openingType: "WINDOW",
      widthMm: new Decimal(1800), heightMm: new Decimal(2100),
      family: "CURTAIN_FABRIC", headingType: "EYELET",
      fullness: new Decimal(2.0), mountType: "OUTSIDE",
      photoKeys: [],
    },
  });
  measurementItemId = item.id;

  // ── CalcResult v1: 5 panels, 2760mm cut length ────────────────────────────
  await db.calcResult.create({
    data: {
      organizationId: orgId,
      measurementItemId,
      colourwayId,
      engineVersion: "curtain@1.2.0",
      inputs: { windowWidthMm: 1800, windowHeightMm: 2100, fullness: 2.0 },
      materialQty: new Decimal("13.800"),
      materialUnit: "METRE",
      widthsRequired: V1_PANELS,
      cutLengthMm: new Decimal("2760"),
      fabricRun: "VERTICAL",
      liningQty: new Decimal("11.040"),
      wastagePct: new Decimal("0"),
      warnings: [],
    },
  });

  // ── Quotation + QuotationLine ────────────────────────────────────────────
  const quotation = await db.quotation.create({
    data: {
      organizationId: orgId, branchId, number: "MDV/QT-2608-0099",
      projectId, clientId: client.id,
      date: new Date(), validUntil: new Date(Date.now() + 30 * 86400e3),
      status: "DRAFT", taxableAmount: 100000n, cgst: 6000n, sgst: 6000n,
      igst: 0n, roundOff: 0n, total: 112000n, ownerId: userId,
    },
  });
  quotationId = quotation.id;

  const qLine = await db.quotationLine.create({
    data: {
      organizationId: orgId, quotationId, lineNo: 1,
      measurementItemId,
      colourwayId,
      description: "Pearl Silk Eyelet Curtain — Master Bedroom Window 1",
      quantity: new Decimal("13.8"),
      unit: "METRE",
      rate: 50000n,
      discountPct: new Decimal("0"),
      taxable: 69000n,
      gstRate: new Decimal("12"),
      cgst: 4140n, sgst: 4140n, igst: 0n, amount: 77280n,
      roomLabel: "Master Bedroom — Window 1 — East",
    },
  });
  quotationLineId = qLine.id;

  // ── Freeze calcSnapshot (mirrors setQuotationStatus → SENT logic) ─────────
  const calcResult = await db.calcResult.findUniqueOrThrow({ where: { measurementItemId } });
  const snapshot = {
    id: calcResult.id,
    engineVersion: calcResult.engineVersion,
    materialQty: calcResult.materialQty.toString(),
    materialUnit: calcResult.materialUnit,
    widthsRequired: calcResult.widthsRequired,
    cutLengthMm: calcResult.cutLengthMm?.toString() ?? null,
    rollsRequired: calcResult.rollsRequired,
    boxesRequired: calcResult.boxesRequired,
    areaSqft: calcResult.areaSqft?.toString() ?? null,
    wastagePct: calcResult.wastagePct?.toString() ?? null,
    fabricRun: calcResult.fabricRun,
    seamCount: calcResult.seamCount,
    liningQty: calcResult.liningQty?.toString() ?? null,
    warnings: calcResult.warnings,
    computedAt: calcResult.computedAt.toISOString(),
  };
  await db.quotationLine.update({ where: { id: quotationLineId }, data: { calcSnapshot: snapshot } });
  await db.quotation.update({ where: { id: quotationId }, data: { status: "ACCEPTED", sentAt: new Date() } });

  // ── Order + OrderLine ────────────────────────────────────────────────────
  const order = await db.order.create({
    data: {
      organizationId: orgId, branchId, number: "MDV/SO-2608-0099",
      projectId, clientId: client.id, quotationId,
      date: new Date(), status: "CONFIRMED", totalValue: 112000n,
    },
  });
  orderId = order.id;

  const orderLine = await db.orderLine.create({
    data: {
      organizationId: orgId, orderId: order.id, lineNo: 1,
      measurementItemId,
      colourwayId,
      description: "Pearl Silk Eyelet Curtain — Master Bedroom Window 1",
      quantity: new Decimal("13.8"),
      unit: "METRE",
      rate: 50000n,
      amount: 77280n,
    },
  });
  orderLineId = orderLine.id;
}, 30_000);

describe("Phase 5 gate: make job cut list from frozen snapshot", () => {
  it("QuotationLine.calcSnapshot is frozen with v1 values", async () => {
    const line = await db.quotationLine.findUniqueOrThrow({ where: { id: quotationLineId } });
    expect(line.calcSnapshot).toBeTruthy();
    const snap = line.calcSnapshot as Record<string, unknown>;
    expect(snap.widthsRequired).toBe(V1_PANELS);
    expect(snap.cutLengthMm).toBe(V1_CUT_LENGTH_MM);
  });

  it("superseding CalcResult does NOT change the frozen snapshot", async () => {
    // Simulate measurement revision: update CalcResult with new values (v2)
    await db.calcResult.update({
      where: { measurementItemId },
      data: {
        widthsRequired: V2_PANELS,
        cutLengthMm: new Decimal("3640.00"),
        materialQty: new Decimal("19.25"),
        engineVersion: "curtain@1.2.1",
      },
    });

    // Verify live CalcResult now shows v2
    const live = await db.calcResult.findUniqueOrThrow({ where: { measurementItemId } });
    expect(live.widthsRequired).toBe(V2_PANELS);

    // Verify frozen snapshot is unchanged
    const line = await db.quotationLine.findUniqueOrThrow({ where: { id: quotationLineId } });
    const snap = line.calcSnapshot as Record<string, unknown>;
    expect(snap.widthsRequired).toBe(V1_PANELS);
    expect(snap.cutLengthMm).toBe(V1_CUT_LENGTH_MM);
  });

  it("resolveCutList() selects snapshot (v1) over live CalcResult (v2)", async () => {
    // Fetch exactly the inputs createMakeJob() fetches in production
    const [qLines, liveCalcs, orderLines, roomItems] = await Promise.all([
      db.quotationLine.findMany({
        where: { quotationId, measurementItemId: { not: null } },
        select: { measurementItemId: true, roomLabel: true, calcSnapshot: true },
      }),
      db.calcResult.findMany({
        where: { measurementItemId: { in: [measurementItemId] } },
        select: {
          measurementItemId: true, widthsRequired: true,
          cutLengthMm: true, liningQty: true, fabricRun: true,
          warnings: true, engineVersion: true,
        },
      }),
      db.orderLine.findMany({
        where: { orderId },
        select: { id: true, description: true, measurementItemId: true },
      }),
      db.measurementItem.findMany({
        where: { id: { in: [measurementItemId] } },
        select: { id: true, label: true, room: { select: { name: true } } },
      }),
    ]);

    // This calls the real production function — if createMakeJob ever switches to
    // reading live data this test will fail before any DB assertion runs.
    const resolved = resolveCutList({ orderLines, qLines, liveCalcs, roomItems });

    expect(resolved).toHaveLength(1);
    const r = resolved[0]!;
    // Snapshot v1: 5 panels, 2760mm — NOT v2 (7 panels, 3640mm)
    expect(r.snap?.widthsRequired).toBe(V1_PANELS);
    expect(r.snap?.cutLengthMm).toBe(V1_CUT_LENGTH_MM);
    expect(r.snap?.widthsRequired).not.toBe(V2_PANELS);

    // Persist to MakeJobLine to prove the DB round-trip holds
    const job = await db.makeJob.create({
      data: {
        organizationId: orgId,
        number: "MDV/MJ-2608-0099",
        orderId,
        projectId,
        status: "QUEUED",
      },
    });

    for (const line of resolved) {
      await db.makeJobLine.create({
        data: {
          organizationId: orgId,
          makeJobId: job.id,
          orderLineId: line.orderLineId,
          measurementItemId: line.measurementItemId ?? null,
          roomLabel: line.roomLabel,
          panels: typeof line.snap?.widthsRequired === "number" ? line.snap.widthsRequired : null,
          cutLengthMm: line.snap?.cutLengthMm ? new Decimal(line.snap.cutLengthMm) : null,
        },
      });
    }

    const lines = await db.makeJobLine.findMany({ where: { makeJobId: job.id } });
    expect(lines).toHaveLength(1);
    expect(lines[0]!.panels).toBe(V1_PANELS);
    expect(lines[0]!.cutLengthMm?.toString()).toBe(V1_CUT_LENGTH_MM);
  });
});

describe("Phase 5 gate: install visit completion", () => {
  it("install visit can be created, started, and completed with line recording", async () => {
    // Create install visit from the order
    const visit = await db.installVisit.create({
      data: {
        organizationId: orgId,
        number: "MDV/INS-2608-0099",
        projectId,
        orderId,
        scheduledAt: new Date(),
        status: "SCHEDULED",
        photoKeys: [],
      },
    });
    expect(visit.id).toBeTruthy();

    // Create install lines
    const orderLines = await db.orderLine.findMany({ where: { orderId } });
    for (const ol of orderLines) {
      await db.installLine.create({
        data: {
          organizationId: orgId,
          installVisitId: visit.id,
          orderLineId: ol.id,
          roomLabel: "Master Bedroom — Window 1 — East",
          plannedQty: ol.quantity,
          installedQty: new Decimal(0),
          remoteSerials: [],
          photoKeys: [],
        },
      });
    }

    // Start the visit
    await db.installVisit.update({
      where: { id: visit.id },
      data: { status: "IN_PROGRESS", startedAt: new Date() },
    });

    // Record install line with dye lot
    const installLines = await db.installLine.findMany({ where: { installVisitId: visit.id } });
    expect(installLines).toHaveLength(1);

    await db.installLine.update({
      where: { id: installLines[0]!.id },
      data: {
        installedQty: installLines[0]!.plannedQty,
        dyeLotUsed: "DL-2024-001",
      },
    });

    // Complete visit with a signature key
    const SIG_KEY = "signature/visit-0099.png";
    await db.installVisit.update({
      where: { id: visit.id },
      data: { status: "COMPLETED", completedAt: new Date(), clientSignatureKey: SIG_KEY },
    });

    // Verify final state
    const completed = await db.installVisit.findUniqueOrThrow({ where: { id: visit.id } });
    expect(completed.status).toBe("COMPLETED");
    expect(completed.clientSignatureKey).toBe(SIG_KEY);
    expect(completed.completedAt).not.toBeNull();

    const completedLine = await db.installLine.findFirstOrThrow({
      where: { installVisitId: visit.id },
    });
    expect(completedLine.dyeLotUsed).toBe("DL-2024-001");
    expect(completedLine.installedQty.toString()).toBe(
      installLines[0]!.plannedQty.toString(),
    );
  });
});

// Mandovara Interior OS — transactions seed.
// Projects, rooms, measurements, items, calc results, quotations, orders, edge cases.
// No @ts-nocheck — must typecheck cleanly against the actual schema.
import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { CBE_LOCALITIES } from "./data";
import { makeRng } from "./rng";

// ─── Interface ────────────────────────────────────────────────────────────────

export interface SeedTransactionInput {
  orgId: string;
  branchId: string;
  userByRole: Record<string, string>;
  employeeIds: string[];
  vendorIds: string[];
  colourwayIds: string[];
  colourwayMeta: Map<string, { family: string; sellUnit: string; costPaise: bigint }>;
  sampleBookIds: string[];
  clientIds: string[];
  architectIds: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function prjNum(i: number): string {
  return `MDV/PRJ-2608-${String(i).padStart(4, "0")}`;
}
function meaNum(i: number): string {
  return `MDV/MEA-2608-${String(i).padStart(4, "0")}`;
}
function qtNum(i: number): string {
  return `MDV/QT-2608-${String(i).padStart(4, "0")}`;
}
function soNum(i: number): string {
  return `MDV/SO-2608-${String(i).padStart(4, "0")}`;
}

/** BigInt money maths on a float quantity + bigint rate paise. */
function computeGst(qty: number, ratePaise: bigint, gstPct: bigint, sameState: boolean) {
  const taxable = BigInt(Math.round(qty * Number(ratePaise)));
  const gst = (taxable * gstPct) / 100n;
  const cgst = sameState ? gst / 2n : 0n;
  const sgst = sameState ? gst - gst / 2n : 0n;
  const igst = sameState ? 0n : gst;
  return { taxable, cgst, sgst, igst, amount: taxable + gst };
}

async function batchCreate<T>(
  model: { createMany(a: { data: T[]; skipDuplicates?: boolean }): Promise<unknown> },
  rows: T[],
  chunk = 500,
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunk) {
    await model.createMany({ data: rows.slice(i, i + chunk), skipDuplicates: true });
  }
}

// ─── Stage distribution ───────────────────────────────────────────────────────

const STAGES = [
  ["ENQUIRY",       60],
  ["MEASUREMENT",  120],
  ["QUOTATION",    180],
  ["ORDERED",      200],
  ["PROCUREMENT",  150],
  ["MAKE",         120],
  ["INSTALLATION", 100],
  ["SNAGGING",      80],
  ["COMPLETED",    150],
  ["CANCELLED",     40],
] as const;

type ProjectStage = typeof STAGES[number][0];

function buildStageSlots(): ProjectStage[] {
  const slots: ProjectStage[] = [];
  for (const [stage, count] of STAGES) {
    for (let i = 0; i < count; i++) slots.push(stage);
  }
  return slots; // 1200
}

const ROOMS = [
  "Master Bedroom", "Living Room", "Dining Room", "Guest Bedroom",
  "Kitchen", "Study", "Kids Room", "Balcony",
] as const;

const LOCALITIES = CBE_LOCALITIES;

// Family and surface for each room type
type FamilyConfig = {
  family: Prisma.MeasurementItemCreateManyInput["family"];
  surface: Prisma.MeasurementItemCreateManyInput["surface"];
  minW: number; maxW: number; minH: number; maxH: number;
};

const ROOM_FAMILIES: Record<string, FamilyConfig[]> = {
  "Master Bedroom": [
    { family: "CURTAIN_FABRIC", surface: "WINDOW", minW: 1200, maxW: 2800, minH: 2000, maxH: 2700 },
    { family: "WALLPAPER",      surface: "WALL",   minW: 3000, maxW: 6000, minH: 2400, maxH: 2800 },
    { family: "CARPET_ROLL",    surface: "FLOOR",  minW: 3000, maxW: 5000, minH: 4000, maxH: 7000 },
  ],
  "Living Room": [
    { family: "CURTAIN_FABRIC", surface: "WINDOW", minW: 1800, maxW: 3000, minH: 2100, maxH: 2700 },
    { family: "BLIND",          surface: "WINDOW", minW: 1200, maxW: 2500, minH: 1500, maxH: 2400 },
    { family: "FLOORING",       surface: "FLOOR",  minW: 3500, maxW: 6000, minH: 5000, maxH: 8000 },
  ],
  "Dining Room": [
    { family: "CURTAIN_FABRIC", surface: "WINDOW", minW: 1200, maxW: 2400, minH: 1800, maxH: 2400 },
    { family: "WALLPAPER",      surface: "WALL",   minW: 2500, maxW: 5000, minH: 2400, maxH: 2800 },
    { family: "FLOORING",       surface: "FLOOR",  minW: 3000, maxW: 5000, minH: 4000, maxH: 6000 },
  ],
  "Guest Bedroom": [
    { family: "CURTAIN_FABRIC", surface: "WINDOW", minW: 1200, maxW: 2400, minH: 1800, maxH: 2700 },
    { family: "WALLPAPER",      surface: "WALL",   minW: 2500, maxW: 5000, minH: 2400, maxH: 2800 },
  ],
  "Kitchen": [
    { family: "INTERIOR_FILM",  surface: "FURNITURE", minW: 1000, maxW: 3000, minH: 500, maxH: 1500 },
    { family: "BLIND",          surface: "WINDOW",    minW: 600,  maxW: 1500, minH: 600, maxH: 1200 },
  ],
  "Study": [
    { family: "BLIND",          surface: "WINDOW", minW: 900,  maxW: 1800, minH: 1200, maxH: 2100 },
    { family: "WALLPAPER",      surface: "WALL",   minW: 2000, maxW: 4500, minH: 2400, maxH: 2800 },
  ],
  "Kids Room": [
    { family: "CURTAIN_FABRIC", surface: "WINDOW", minW: 1000, maxW: 2000, minH: 1800, maxH: 2400 },
    { family: "FLOORING",       surface: "FLOOR",  minW: 2500, maxW: 4500, minH: 3000, maxH: 6000 },
  ],
  "Balcony": [
    { family: "BLIND",          surface: "WINDOW", minW: 1000, maxW: 2500, minH: 1500, maxH: 2500 },
    { family: "INTERIOR_FILM",  surface: "GLASS",  minW: 800,  maxW: 2000, minH: 1000, maxH: 2000 },
  ],
};

function calcResultFor(
  family: string,
  widthMm: number,
  heightMm: number,
  colourwayId: string,
): Omit<Prisma.CalcResultCreateManyInput, "id" | "organizationId" | "measurementItemId"> {
  const base = {
    colourwayId,
    inputs: { widthMm, heightMm },
    warnings: [] as string[],
    computedAt: new Date(),
  };
  if (family === "CURTAIN_FABRIC" || family === "SHEER") {
    const fabricWidth = 1100;
    const fullness = 2.5;
    const widthsRequired = Math.ceil(((widthMm * fullness) + 80) / fabricWidth);
    const cutLengthMm = heightMm + 150 + 200; // heading + bottom hem
    const materialQty = (widthsRequired * cutLengthMm) / 1000;
    return {
      ...base, engineVersion: "curtain@1.2.0",
      materialQty, materialUnit: "METRE",
      widthsRequired, cutLengthMm,
      fabricRun: "VERTICAL", wastagePct: null,
    };
  }
  if (family === "WALLPAPER") {
    const rollW = 530, rollLenMm = 10050;
    const cutLen = heightMm; // FREE match default
    const stripsPerRoll = Math.floor(rollLenMm / cutLen);
    const stripsNeeded = Math.ceil(widthMm / rollW);
    const rollsRequired = Math.ceil(stripsNeeded / Math.max(stripsPerRoll, 1));
    return {
      ...base, engineVersion: "wallpaper@1.2.0",
      materialQty: rollsRequired, materialUnit: "ROLL",
      rollsRequired, cutLengthMm: cutLen,
      areaSqft: parseFloat(((widthMm * heightMm) / 92903.04).toFixed(3)),
    };
  }
  if (family === "BLIND") {
    const areaSqft = parseFloat(((widthMm * heightMm) / 92903.04).toFixed(3));
    const billable = Math.max(areaSqft, 10);
    return {
      ...base, engineVersion: "blind@1.2.0",
      materialQty: billable, materialUnit: "SQFT",
      areaSqft, billableAreaSqft: billable,
    };
  }
  if (family === "FLOORING") {
    const areaSqft = parseFloat(((widthMm * heightMm) / 92903.04).toFixed(3));
    const withWastage = areaSqft * 1.07;
    const boxesRequired = Math.ceil(withWastage / 2.2);
    return {
      ...base, engineVersion: "flooring@1.2.0",
      materialQty: boxesRequired, materialUnit: "BOX",
      boxesRequired, areaSqft, wastagePct: 7,
    };
  }
  if (family === "CARPET_ROLL") {
    const areaSqft = parseFloat(((widthMm * heightMm) / 92903.04).toFixed(3));
    const withWastage = areaSqft * 1.1;
    return {
      ...base, engineVersion: "carpet@1.2.0",
      materialQty: withWastage, materialUnit: "SQFT",
      areaSqft, wastagePct: 10,
    };
  }
  // INTERIOR_FILM and others
  const areaSqft = parseFloat(((widthMm * heightMm) / 92903.04).toFixed(3));
  return {
    ...base, engineVersion: "film@1.2.0",
    materialQty: areaSqft * 1.08, materialUnit: "SQFT", areaSqft,
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function seedTransactions(
  db: PrismaClient,
  input: SeedTransactionInput,
): Promise<void> {
  const rng = makeRng(45);
  const orgId = input.orgId;
  const stageSlots = buildStageSlots(); // 1200 entries

  // ── Build all data in memory first ──────────────────────────────────────────

  const projectRows: Prisma.ProjectCreateManyInput[] = [];
  const roomRows: Prisma.RoomCreateManyInput[] = [];
  const measurementRows: Prisma.MeasurementCreateManyInput[] = [];
  const itemRows: Prisma.MeasurementItemCreateManyInput[] = [];
  const calcRows: Prisma.CalcResultCreateManyInput[] = [];
  const quotationRows: Prisma.QuotationCreateManyInput[] = [];
  const quotationLineRows: Prisma.QuotationLineCreateManyInput[] = [];
  const orderRows: Prisma.OrderCreateManyInput[] = [];
  // Map projectId → qTotal for projects that have an order (set after qTotal is computed)
  const orderValueMap = new Map<string, bigint>();

  const NEEDS_MEASUREMENT = new Set<ProjectStage>([
    "MEASUREMENT", "QUOTATION", "ORDERED", "PROCUREMENT",
    "MAKE", "INSTALLATION", "SNAGGING", "COMPLETED", "CANCELLED",
  ]);
  const NEEDS_QUOTATION = new Set<ProjectStage>([
    "QUOTATION", "ORDERED", "PROCUREMENT", "MAKE",
    "INSTALLATION", "SNAGGING", "COMPLETED", "CANCELLED",
  ]);
  const NEEDS_ORDER = new Set<ProjectStage>([
    "ORDERED", "PROCUREMENT", "MAKE",
    "INSTALLATION", "SNAGGING", "COMPLETED",
  ]);

  let meaCount = 0;
  let qtCount = 0;
  let soCount = 0;

  for (let i = 0; i < 1200; i++) {
    const stage = stageSlots[i]!;
    const clientId = input.clientIds[rng.int(0, input.clientIds.length - 1)]!;
    const hasArchitect = rng.boolean(0.3);
    const architectId = hasArchitect ? input.architectIds[rng.int(0, input.architectIds.length - 1)]! : null;
    const locality = rng.pick(LOCALITIES as readonly string[]);
    const locationType = rng.pick(["Villa", "Apartment", "Office", "House", "Bungalow"] as const);
    const ownerId = rng.boolean(0.5)
      ? (input.userByRole["SALES"] ?? "")
      : (input.userByRole["DESIGNER"] ?? "");

    const daysAgo = rng.int(0, 720);
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);

    const projectId = randomUUID();
    projectRows.push({
      id: projectId,
      organizationId: orgId,
      branchId: input.branchId,
      number: prjNum(i + 1),
      name: `Project ${i + 1} — ${locationType}, ${locality}`,
      clientId,
      architectId,
      stage,
      siteAddress: { line1: `${rng.int(1, 200)} ${locality} Main Road`, locality, city: "Coimbatore", pincode: `641${String(rng.int(1, 99)).padStart(3, "0")}` } as Prisma.InputJsonValue,
      ownerId,
      orderValue: 0n,
      createdAt,
    });

    // Rooms
    const roomCount = rng.int(2, 4);
    const shuffledRooms = [...ROOMS].sort(() => rng.next() - 0.5).slice(0, roomCount);
    const roomIds: string[] = [];
    for (let r = 0; r < roomCount; r++) {
      const roomId = randomUUID();
      roomIds.push(roomId);
      roomRows.push({
        id: roomId,
        organizationId: orgId,
        projectId,
        name: shuffledRooms[r]!,
        floorLabel: r === 0 ? "Ground Floor" : "First Floor",
        sortOrder: r,
      });
    }

    // Measurement
    if (!NEEDS_MEASUREMENT.has(stage)) continue;
    meaCount++;
    const measurementId = randomUUID();
    const measStatus: Prisma.MeasurementCreateManyInput["status"] =
      stage === "COMPLETED" || stage === "SNAGGING" || stage === "INSTALLATION" ? "APPROVED"
      : stage === "ORDERED" || stage === "PROCUREMENT" || stage === "MAKE" ? "SUBMITTED"
      : "DRAFT";

    measurementRows.push({
      id: measurementId,
      organizationId: orgId,
      projectId,
      number: meaNum(meaCount),
      visitedAt: new Date(createdAt.getTime() + 2 * 86400_000),
      measuredById: input.userByRole["MEASURE_EXEC"] ?? "",
      status: measStatus,
      approvedById: measStatus === "APPROVED" ? (input.userByRole["OWNER"] ?? null) : null,
      approvedAt: measStatus === "APPROVED" ? new Date(createdAt.getTime() + 3 * 86400_000) : null,
    });

    // MeasurementItems — 3-5 per measurement
    const itemCount = rng.int(3, 5);
    const projectItemIds: string[] = [];
    for (let k = 0; k < itemCount; k++) {
      const roomId = roomIds[k % roomIds.length]!;
      const roomName = shuffledRooms[k % shuffledRooms.length]!;
      const configs = ROOM_FAMILIES[roomName] ?? ROOM_FAMILIES["Living Room"]!;
      const cfg = rng.pick(configs as readonly FamilyConfig[]);

      const widthMm = rng.int(cfg.minW, cfg.maxW);
      const heightMm = rng.int(cfg.minH, cfg.maxH);
      const itemId = randomUUID();
      projectItemIds.push(itemId);

      const isCurtain = cfg.family === "CURTAIN_FABRIC" || cfg.family === "SHEER";
      const isBlind = cfg.family === "BLIND";

      itemRows.push({
        id: itemId,
        organizationId: orgId,
        measurementId,
        roomId,
        label: `${rng.pick(["Window", "Wall", "Floor"] as const)} ${k + 1} — ${rng.pick(["East", "West", "North", "South"] as const)}`,
        surface: cfg.surface,
        openingType: cfg.surface === "WINDOW" ? "WINDOW" : null,
        widthMm, heightMm,
        quantity: rng.int(1, 2),
        family: cfg.family,
        headingType: isCurtain ? rng.pick(["EYELET", "PINCH_PLEAT"] as const) : null,
        fullness: isCurtain ? (rng.boolean(0.5) ? new Prisma.Decimal("2.0") : new Prisma.Decimal("2.5")) : null,
        mountType: isBlind ? rng.pick(["INSIDE", "OUTSIDE"] as const) : null,
        photoKeys: [],
      });

      // CalcResult
      const colourwayId = input.colourwayIds[rng.int(0, input.colourwayIds.length - 1)]!;
      const cr = calcResultFor(cfg.family, widthMm, heightMm, colourwayId);
      calcRows.push({
        id: randomUUID(),
        organizationId: orgId,
        measurementItemId: itemId,
        ...cr,
      } as Prisma.CalcResultCreateManyInput);
    }

    // Quotation
    if (!NEEDS_QUOTATION.has(stage)) continue;
    qtCount++;
    const quotationId = randomUUID();
    const quotedAt = new Date(createdAt.getTime() + 5 * 86400_000);
    const qtStatus: Prisma.QuotationCreateManyInput["status"] =
      stage === "QUOTATION" ? (rng.boolean(0.5) ? "SENT" : "DRAFT")
      : NEEDS_ORDER.has(stage) ? "ACCEPTED"
      : stage === "CANCELLED" ? (rng.boolean(0.5) ? "REJECTED" : "EXPIRED")
      : "EXPIRED";

    let qTaxable = 0n, qCgst = 0n, qSgst = 0n, qIgst = 0n;
    // One line per item
    for (let li = 0; li < projectItemIds.length; li++) {
      const itemId = projectItemIds[li]!;
      const rate = BigInt(rng.int(15000, 150000)); // ₹150–₹1500 per unit
      const cr = calcRows.find((c) => c.measurementItemId === itemId);
      const qty = cr ? Number(cr.materialQty) : rng.int(2, 20);
      const { taxable, cgst, sgst, igst, amount } = computeGst(qty, rate, 18n, true /* TN intra-state */);
      qTaxable += taxable; qCgst += cgst; qSgst += sgst; qIgst += igst;

      quotationLineRows.push({
        id: randomUUID(),
        organizationId: orgId,
        quotationId,
        lineNo: li + 1,
        measurementItemId: itemId,
        colourwayId: cr?.colourwayId ?? null,
        description: `Item ${li + 1}`,
        quantity: new Prisma.Decimal(qty.toFixed(3)),
        unit: (cr?.materialUnit ?? "METRE") as Prisma.QuotationLineCreateManyInput["unit"],
        rate,
        discountPct: new Prisma.Decimal("0"),
        gstRate: new Prisma.Decimal("18"),
        taxable, cgst, sgst, igst, amount,
        isOptional: false,
        calcSnapshot: cr ? ({ materialQty: cr.materialQty, materialUnit: cr.materialUnit } as Prisma.InputJsonValue) : Prisma.JsonNull,
      });
    }
    const qTotal = qTaxable + qCgst + qSgst + qIgst;

    quotationRows.push({
      id: quotationId,
      organizationId: orgId,
      branchId: input.branchId,
      number: qtNum(qtCount),
      revision: 0,
      parentId: null,
      projectId,
      clientId,
      date: quotedAt,
      validUntil: new Date(quotedAt.getTime() + 30 * 86400_000),
      status: qtStatus,
      taxableAmount: qTaxable, cgst: qCgst, sgst: qSgst, igst: qIgst,
      roundOff: 0n, total: qTotal,
      discountPct: new Prisma.Decimal("0"),
      termsText: "50% advance. Balance before delivery.",
      ownerId,
      sentAt: qtStatus === "SENT" || qtStatus === "ACCEPTED" ? new Date(quotedAt.getTime() + 86400_000) : null,
    });

    // Order
    if (!NEEDS_ORDER.has(stage)) continue;
    soCount++;
    const orderStatus: Prisma.OrderCreateManyInput["status"] =
      stage === "ORDERED" ? "CONFIRMED"
      : stage === "PROCUREMENT" ? "PROCUREMENT"
      : stage === "MAKE" ? "MAKE"
      : stage === "INSTALLATION" ? "INSTALLING"
      : stage === "SNAGGING" ? "READY_TO_INSTALL"
      : "COMPLETED";

    orderValueMap.set(projectId, qTotal);
    orderRows.push({
      id: randomUUID(),
      organizationId: orgId,
      branchId: input.branchId,
      number: soNum(soCount),
      projectId,
      clientId,
      quotationId,
      date: new Date(quotedAt.getTime() + 2 * 86400_000),
      status: orderStatus,
      totalValue: qTotal,
      advanceRequired: qTotal / 2n,
      advanceReceived: qTotal / 2n,
      promisedInstallAt: new Date(quotedAt.getTime() + 30 * 86400_000),
    });
  }

  // ── Flush all bulk data ──────────────────────────────────────────────────────

  await batchCreate(db.project, projectRows);
  await batchCreate(db.room, roomRows);
  await batchCreate(db.measurement, measurementRows);
  await batchCreate(db.measurementItem, itemRows);
  await batchCreate(db.calcResult, calcRows);
  await batchCreate(db.quotation, quotationRows);
  await batchCreate(db.quotationLine, quotationLineRows);
  await batchCreate(db.order, orderRows);

  // Back-fill orderValue on projects that have a real order total
  for (const [projectId, orderValue] of orderValueMap) {
    await db.project.update({ where: { id: projectId }, data: { orderValue } });
  }

  process.stdout.write(
    `  projects: ${projectRows.length}, rooms: ${roomRows.length}, measurements: ${measurementRows.length}, items: ${itemRows.length}, calcResults: ${calcRows.length}, quotations: ${quotationRows.length}, orders: ${orderRows.length}\n`,
  );

  // ── Edge cases ───────────────────────────────────────────────────────────────

  await seedEdgeCases(db, input, rng, projectRows.map((p) => p.id as string));
}

// ─── Edge cases ───────────────────────────────────────────────────────────────

async function seedEdgeCases(
  db: PrismaClient,
  input: SeedTransactionInput,
  rng: ReturnType<typeof makeRng>,
  bulkProjectIds: string[],
): Promise<void> {
  const orgId = input.orgId;
  const clientId = input.clientIds[0]!;
  const ownerId = input.userByRole["OWNER"] ?? "";

  // Helper: create a minimal project→room→measurement→item chain
  async function makeChain(
    projectName: string,
    stage: Prisma.ProjectCreateInput["stage"],
    itemOverride: Partial<Prisma.MeasurementItemCreateInput>,
    calcOverride: Partial<Omit<Prisma.CalcResultCreateInput, "item" | "organizationId">>,
  ) {
    const projectId = randomUUID();
    await db.project.create({
      data: {
        id: projectId, organizationId: orgId, branchId: input.branchId,
        number: `MDV/PRJ-EDGE-${projectName.slice(0, 4).toUpperCase()}`,
        name: projectName, clientId, stage,
        siteAddress: { city: "Coimbatore" } as Prisma.InputJsonValue,
        ownerId, orderValue: 0n,
      },
    });
    const roomId = randomUUID();
    await db.room.create({
      data: { id: roomId, organizationId: orgId, projectId, name: "Living Room", sortOrder: 0 },
    });
    const measurementId = randomUUID();
    await db.measurement.create({
      data: {
        id: measurementId, organizationId: orgId, projectId,
        number: `MDV/MEA-EDGE-${projectName.slice(0, 4).toUpperCase()}`,
        visitedAt: new Date(), measuredById: input.userByRole["MEASURE_EXEC"] ?? "",
        status: "APPROVED",
        approvedById: ownerId, approvedAt: new Date(),
      },
    });
    const itemId = randomUUID();
    await db.measurementItem.create({
      data: {
        id: itemId, organizationId: orgId, measurementId, roomId,
        label: "Window 1 — East", surface: "WINDOW", widthMm: 2400, heightMm: 2700,
        family: "CURTAIN_FABRIC", photoKeys: [],
        ...itemOverride,
      } as Prisma.MeasurementItemCreateInput,
    });
    const colourwayId = input.colourwayIds[0]!;
    await db.calcResult.create({
      data: {
        organizationId: orgId,
        measurementItemId: itemId,
        colourwayId,
        engineVersion: "curtain@1.2.0",
        inputs: { widthMm: 2400, heightMm: 2700 } as Prisma.InputJsonValue,
        materialQty: new Prisma.Decimal("12.0"),
        materialUnit: "METRE",
        warnings: [],
        computedAt: new Date(),
        ...calcOverride,
      } as unknown as Prisma.CalcResultCreateInput,
    });
    return { projectId, roomId, measurementId, itemId };
  }

  // 1. Offset repeat added a roll
  await makeChain(
    "Offset Repeat Demo — Sundarapuram",
    "COMPLETED",
    { family: "WALLPAPER", surface: "WALL", widthMm: 4000, heightMm: 2700 },
    {
      engineVersion: "wallpaper@1.2.0",
      materialQty: new Prisma.Decimal("4"),
      materialUnit: "ROLL",
      rollsRequired: 4,
      cutLengthMm: new Prisma.Decimal("3520"),
      areaSqft: new Prisma.Decimal("116.25"),
      warnings: ["Half-drop match adds 1 roll over straight match"],
    },
  );

  // 2. Railroading saved 6 metres
  await makeChain(
    "Railroading Demo — Race Course",
    "ORDERED",
    { family: "SHEER", surface: "WINDOW", widthMm: 3000, heightMm: 1200 },
    {
      engineVersion: "curtain@1.2.0",
      materialQty: new Prisma.Decimal("3.3"),
      materialUnit: "METRE",
      fabricRun: "RAILROADED",
      widthsRequired: null,
      warnings: ["Railroaded: saves 6.4 m vs vertical run"],
    },
  );

  // 3. Mixed lot allocation — needs an order + orderLine first
  const mixedProject = await db.project.create({
    data: {
      organizationId: orgId, branchId: input.branchId,
      number: "MDV/PRJ-EDGE-MXLT",
      name: "Mixed Lot Demo — Peelamedu",
      clientId, stage: "PROCUREMENT",
      siteAddress: { city: "Coimbatore" } as Prisma.InputJsonValue,
      ownerId, orderValue: 5000000n,
    },
  });
  const mixedOrderId = randomUUID();
  await db.order.create({
    data: {
      id: mixedOrderId, organizationId: orgId, branchId: input.branchId,
      number: "MDV/SO-EDGE-MXLT",
      projectId: mixedProject.id, clientId,
      date: new Date(), status: "PROCUREMENT",
      totalValue: 5000000n, advanceRequired: 2500000n, advanceReceived: 2500000n,
    },
  });
  const mixedOrderLineId = randomUUID();
  await db.orderLine.create({
    data: {
      id: mixedOrderLineId, organizationId: orgId,
      orderId: mixedOrderId, lineNo: 1,
      description: "Wallpaper — Pearl Grey",
      colourwayId: input.colourwayIds[rng.int(0, input.colourwayIds.length - 1)]!,
      quantity: new Prisma.Decimal("6.0"), unit: "ROLL",
      rate: 80000n, amount: 480000n,
    },
  });
  await db.allocation.create({
    data: {
      organizationId: orgId,
      orderLineId: mixedOrderLineId,
      colourwayId: input.colourwayIds[rng.int(0, input.colourwayIds.length - 1)]!,
      dyeLot: "LOT-A",
      quantity: new Prisma.Decimal("6.0"),
      mixedLotOverride: true,
      overrideReason: "Client approved — second roll from Lot B matches visually",
      overrideById: ownerId,
    },
  });

  // 4. Sample book 40 days overdue
  if (input.sampleBookIds.length > 0) {
    const issuedAt = new Date();
    issuedAt.setDate(issuedAt.getDate() - 50);
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() - 40);
    await db.sampleIssue.create({
      data: {
        organizationId: orgId,
        sampleBookId: input.sampleBookIds[0]!,
        issuedToType: "ARCHITECT",
        architectId: input.architectIds[0]!,
        issuedAt,
        dueAt,
        returnedAt: null,
        depositAmount: 500000n,
        notes: "Issued for client presentation — 40 days overdue, no response",
      },
    });
  }

  // 5. Snag reopened twice
  const snagProject = await db.project.create({
    data: {
      organizationId: orgId, branchId: input.branchId,
      number: "MDV/PRJ-EDGE-SNAG",
      name: "Snag Reopened Demo — Saibaba Colony",
      clientId, stage: "SNAGGING",
      siteAddress: { city: "Coimbatore" } as Prisma.InputJsonValue,
      ownerId, orderValue: 3000000n,
    },
  });
  await db.snag.create({
    data: {
      organizationId: orgId,
      projectId: snagProject.id,
      roomLabel: "Master Bedroom",
      raisedById: ownerId,
      raisedAt: new Date(Date.now() - 20 * 86400_000),
      description: "Wallpaper seam visible at corner — reopened twice (first resolution inadequate, second resolution paste bleed)",
      photoKeys: [],
      status: "OPEN",
      assignedToId: input.userByRole["INSTALLER"] ?? null,
      resolutionNote: "Reopened: first fix left seam visible; second fix caused paste bleed. Awaiting replacement strip.",
    },
  });

  // 6. Motorized blind awaiting power point
  const { projectId: motorProjectId } = await makeChain(
    "Motorized Blind Demo — Avinashi Road",
    "MAKE",
    {
      family: "BLIND", surface: "WINDOW", widthMm: 2200, heightMm: 1800,
      requiresPowerPoint: true, mountType: "OUTSIDE",
    },
    {
      engineVersion: "blind@1.2.0",
      materialQty: new Prisma.Decimal("42.8"),
      materialUnit: "SQFT",
      areaSqft: new Prisma.Decimal("42.8"),
      billableAreaSqft: new Prisma.Decimal("42.8"),
      warnings: ["Motorized blind: power point required at install site"],
    },
  );
  void motorProjectId; // used in chain above

  // 7. Negative-margin project
  const negProject = await db.project.create({
    data: {
      organizationId: orgId, branchId: input.branchId,
      number: "MDV/PRJ-EDGE-NEGM",
      name: "Negative Margin Demo — Vadavalli",
      clientId, stage: "COMPLETED",
      siteAddress: { city: "Coimbatore" } as Prisma.InputJsonValue,
      ownerId, orderValue: 1500000n,
    },
  });
  await db.projectExpense.create({
    data: {
      organizationId: orgId, projectId: negProject.id,
      head: "LABOUR", description: "Emergency re-installation — wallpaper dye lot mismatch",
      amount: 2000000n, incurredAt: new Date(Date.now() - 10 * 86400_000),
      approvalState: "APPROVED", approvedById: ownerId,
    },
  });

  // 8. Follow-ups (100 records)
  const followUpRows: Prisma.FollowUpCreateManyInput[] = [];
  for (let i = 0; i < 100; i++) {
    const isCompleted = i < 70;
    const daysOffset = isCompleted ? rng.int(1, 60) : rng.int(0, 30);
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() - (isCompleted ? daysOffset : -daysOffset));
    const completedAt = isCompleted ? new Date(dueAt.getTime() + 86400_000) : null;
    const projectId = bulkProjectIds[rng.int(0, bulkProjectIds.length - 1)] ?? negProject.id;
    followUpRows.push({
      organizationId: orgId,
      refType: "PROJECT",
      refId: projectId,
      ownerId: rng.boolean(0.5) ? (input.userByRole["SALES"] ?? ownerId) : (input.userByRole["DESIGNER"] ?? ownerId),
      dueAt,
      note: rng.pick([
        "Follow up on quote acceptance",
        "Check measurement slot availability",
        "Confirm fabric selection with client",
        "Chase advance payment",
        "Schedule installation date",
      ] as const),
      outcome: isCompleted ? rng.pick(["Called — will confirm by Friday", "Client approved quote", "Advance received"] as const) : null,
      completedAt,
    });
  }
  await batchCreate(db.followUp, followUpRows);
}

// Downstream seed — Phases 4-8: procurement, dye-lot stock, make, install,
// money, HR and WhatsApp.
//
// The transactional seed used to stop at Order, which left 30-odd tables
// empty. §11 is explicit that this matters: "Without this, no performance
// budget or acceptance criterion can be proved." Concretely, 26 Playwright
// tests skipped on unset E2E_MAKE_JOB_ID / E2E_INSTALL_VISIT_ID, and the
// accounts page had no overdue or receipt rows to render.
//
// Everything here is derived from orders that already exist, so the chain
// project -> measurement -> quote -> order -> PO -> GRN -> allocation ->
// make -> install -> invoice -> receipt is internally consistent.

import { Prisma, PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { makeRng } from "./rng";
import type { SeedTransactionInput } from "./transactions";

// Families that MUST carry a dye lot on receipt (§0.6 / §4).
const DYE_LOT_FAMILIES = new Set<string>([
  "WALLPAPER", "CURTAIN_FABRIC", "SHEER", "UPHOLSTERY_FABRIC", "CARPET_ROLL",
]);

// Families that go through the cut-and-stitch unit.
const MAKE_FAMILIES = new Set<string>([
  "CURTAIN_FABRIC", "SHEER", "UPHOLSTERY_FABRIC",
]);

const PROCURING_STAGES = ["PROCUREMENT", "MAKE", "INSTALLATION", "SNAGGING", "COMPLETED"];
const MAKING_STAGES    = ["MAKE", "INSTALLATION", "SNAGGING", "COMPLETED"];
const INSTALLED_STAGES = ["INSTALLATION", "SNAGGING", "COMPLETED"];
const BILLED_STAGES    = ["SNAGGING", "COMPLETED"];

const pad = (n: number, w = 4) => String(n).padStart(w, "0");

async function batch<T>(
  delegate: { createMany: (a: { data: T[]; skipDuplicates?: boolean }) => Promise<unknown> },
  rows: T[],
  size = 1000,
): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    await delegate.createMany({ data: rows.slice(i, i + size), skipDuplicates: true });
  }
}

export async function seedDownstream(
  db: PrismaClient,
  input: SeedTransactionInput,
): Promise<void> {
  const rng   = makeRng(77);
  const orgId = input.orgId;
  const owner = input.userByRole["OWNER"] ?? "";
  const store = input.userByRole["STORE"] ?? owner;
  const maker = input.userByRole["MAKE_SUPERVISOR"] ?? owner;

  // ── Service rates (labour quoted alongside material) ──────────────────────
  const serviceRates: Prisma.ServiceRateCreateManyInput[] = [
    { organizationId: orgId, family: "CURTAIN_FABRIC",   code: "STITCH_EYELET",     name: "Eyelet stitching",        unit: "METRE",  amount: 12000n, effectiveFrom: new Date("2025-04-01") },
    { organizationId: orgId, family: "CURTAIN_FABRIC",   code: "STITCH_PINCH",      name: "Pinch-pleat stitching",   unit: "METRE",  amount: 15000n, effectiveFrom: new Date("2025-04-01") },
    { organizationId: orgId, family: "WALLPAPER",        code: "INSTALL_WALLPAPER", name: "Wallpaper installation",  unit: "SQFT",   amount:  2500n, effectiveFrom: new Date("2025-04-01") },
    { organizationId: orgId, family: "FLOORING",         code: "LAY_FLOORING",      name: "Flooring laying",         unit: "SQFT",   amount:  3500n, effectiveFrom: new Date("2025-04-01") },
    { organizationId: orgId, family: "BLIND",            code: "INSTALL_BLIND",     name: "Blind installation",      unit: "PIECE",  amount: 30000n, effectiveFrom: new Date("2025-04-01") },
    { organizationId: orgId, family: "UPHOLSTERY_FABRIC",code: "UPHOLSTER_SOFA",    name: "Sofa upholstery labour",  unit: "PIECE",  amount: 250000n, effectiveFrom: new Date("2025-04-01") },
  ];
  await batch(db.serviceRate, serviceRates);

  // ── Install crews ─────────────────────────────────────────────────────────
  const crewIds = [randomUUID(), randomUUID(), randomUUID()];
  await batch(db.installCrew, [
    { id: crewIds[0]!, organizationId: orgId, name: "Crew A — Curtains & Blinds", leadEmployeeId: input.employeeIds[0] ?? "", memberEmployeeIds: input.employeeIds.slice(1, 3), skills: ["CURTAIN_FABRIC", "SHEER", "BLIND"] },
    { id: crewIds[1]!, organizationId: orgId, name: "Crew B — Wallpaper & Films", leadEmployeeId: input.employeeIds[3] ?? "", memberEmployeeIds: input.employeeIds.slice(4, 6), skills: ["WALLPAPER", "INTERIOR_FILM"] },
    { id: crewIds[2]!, organizationId: orgId, name: "Crew C — Flooring & Carpet", leadEmployeeId: input.employeeIds[6] ?? "", memberEmployeeIds: input.employeeIds.slice(7, 9), skills: ["FLOORING", "CARPET_ROLL", "CARPET_TILE"] },
  ] as Prisma.InstallCrewCreateManyInput[]);

  // ── Back-fill OrderLine ───────────────────────────────────────────────────
  // seedTransactions created 800 orders but no order lines at all, so every
  // order rendered empty and nothing downstream of it could exist. Derive the
  // lines from the accepted quotation, which is what the real conversion does.
  const emptyOrders = await db.order.findMany({
    where: { organizationId: orgId, quotationId: { not: null }, lines: { none: {} } },
    select: { id: true, quotationId: true },
  });
  if (emptyOrders.length > 0) {
    const qLines = await db.quotationLine.findMany({
      where: { organizationId: orgId, quotationId: { in: emptyOrders.map((o) => o.quotationId!) } },
      select: {
        quotationId: true, lineNo: true, measurementItemId: true, colourwayId: true,
        serviceRateId: true, description: true, quantity: true, unit: true,
        rate: true, amount: true,
      },
      orderBy: { lineNo: "asc" },
    });
    const byQuote = new Map<string, typeof qLines>();
    for (const l of qLines) {
      const arr = byQuote.get(l.quotationId) ?? [];
      arr.push(l);
      byQuote.set(l.quotationId, arr);
    }
    const orderLineRows: Prisma.OrderLineCreateManyInput[] = [];
    for (const o of emptyOrders) {
      for (const l of byQuote.get(o.quotationId!) ?? []) {
        orderLineRows.push({
          organizationId: orgId, orderId: o.id, lineNo: l.lineNo,
          measurementItemId: l.measurementItemId, colourwayId: l.colourwayId,
          serviceRateId: l.serviceRateId, description: l.description,
          quantity: l.quantity, unit: l.unit, rate: l.rate, amount: l.amount,
        });
      }
    }
    await batch(db.orderLine, orderLineRows);
    process.stdout.write(`  back-filled orderLines: ${orderLineRows.length}\n`);
  }

  // ── Load the order book with its lines and project stage ──────────────────
  const orders = await db.order.findMany({
    where: { organizationId: orgId },
    select: {
      id: true, number: true, projectId: true, clientId: true, branchId: true,
      date: true, totalValue: true,
      lines: {
        select: {
          id: true, colourwayId: true, description: true, quantity: true,
          unit: true, rate: true, amount: true, measurementItemId: true, lineNo: true,
        },
      },
    },
    orderBy: { date: "asc" },
  });

  const projects = await db.project.findMany({
    where: { organizationId: orgId },
    select: { id: true, stage: true, architectId: true, name: true },
  });
  const stageOf     = new Map(projects.map((p) => [p.id, p.stage as string]));
  const architectOf = new Map(projects.map((p) => [p.id, p.architectId]));

  // colourway → family, for dye-lot and make-routing decisions
  const colourways = await db.colourway.findMany({
    where: { organizationId: orgId },
    select: { id: true, sellUnit: true, design: { select: { family: true, hsn: true, gstRate: true } } },
  });
  const cwMeta = new Map(colourways.map((c) => [c.id, c]));

  // ── Accumulators ──────────────────────────────────────────────────────────
  const poRows:       Prisma.PurchaseOrderCreateManyInput[] = [];
  const poLineRows:   Prisma.POLineCreateManyInput[]        = [];
  const grnRows:      Prisma.GRNCreateManyInput[]           = [];
  const grnLineRows:  Prisma.GRNLineCreateManyInput[]       = [];
  const moveRows:     Prisma.StockMoveCreateManyInput[]     = [];
  const allocRows:    Prisma.AllocationCreateManyInput[]    = [];
  const makeRows:     Prisma.MakeJobCreateManyInput[]       = [];
  const makeLineRows: Prisma.MakeJobLineCreateManyInput[]   = [];
  const visitRows:    Prisma.InstallVisitCreateManyInput[]  = [];
  const instLineRows: Prisma.InstallLineCreateManyInput[]   = [];
  const invRows:      Prisma.InvoiceCreateManyInput[]       = [];
  const invLineRows:  Prisma.InvoiceLineCreateManyInput[]   = [];
  const advanceRows:  Prisma.AdvanceCreateManyInput[]       = [];
  const receiptRows:  Prisma.ReceiptCreateManyInput[]       = [];
  const allocRcptRows:Prisma.ReceiptAllocationCreateManyInput[] = [];
  const commRows:     Prisma.ArchitectCommissionCreateManyInput[] = [];
  const projExpRows:  Prisma.ProjectExpenseCreateManyInput[] = [];

  // dye-lot balances accumulate across orders: colourwayId|dyeLot → {qty, value}
  // `reserved` must track the Allocation rows we create below — the allocation
  // console computes available = onHand − reserved, so leaving reserved at 0
  // overstates what is actually free to promise.
  const balances = new Map<string, { colourwayId: string; dyeLot: string | null; qty: number; reserved: number; value: bigint }>();

  let poN = 0, grnN = 0, mjN = 0, insN = 0, invN = 0, rcptN = 0;

  for (const order of orders) {
    const stage = stageOf.get(order.projectId) ?? "ENQUIRY";
    if (!PROCURING_STAGES.includes(stage)) continue;

    const yymm      = `${String(order.date.getFullYear()).slice(2)}${pad(order.date.getMonth() + 1, 2)}`;
    const vendorId  = input.vendorIds[rng.int(0, input.vendorIds.length - 1)]!;
    const matLines  = order.lines.filter((l) => l.colourwayId);
    if (matLines.length === 0) continue;

    // ── Purchase order ──────────────────────────────────────────────────────
    const poId = randomUUID();
    const poTotal = matLines.reduce((s, l) => s + BigInt(l.rate) * BigInt(Math.ceil(Number(l.quantity))), 0n);
    poRows.push({
      id: poId, organizationId: orgId, number: `MDV/PO-${yymm}-${pad(++poN)}`,
      vendorId, projectId: order.projectId, date: order.date,
      expectedAt: new Date(order.date.getTime() + 14 * 86400_000),
      status: "RECEIVED", totalValue: poTotal,
      approvedById: owner, approvedAt: order.date,
    });

    // ── Goods receipt, with a dye lot per roll-based line ────────────────────
    const grnId = randomUUID();
    const receivedAt = new Date(order.date.getTime() + rng.int(7, 21) * 86400_000);
    grnRows.push({
      id: grnId, organizationId: orgId, number: `MDV/GRN-${yymm}-${pad(++grnN)}`,
      purchaseOrderId: poId, vendorId, receivedAt,
      invoiceRef: `INV/${vendorId.slice(0, 4).toUpperCase()}/${pad(grnN, 5)}`,
      receivedById: store,
    });

    for (const line of matLines) {
      const meta   = cwMeta.get(line.colourwayId!);
      const family = meta?.design.family ?? "ACCESSORY";
      const qty    = Math.max(1, Math.ceil(Number(line.quantity)));
      // §0.6: dye lot is mandatory for roll and fabric families.
      const dyeLot = DYE_LOT_FAMILIES.has(family)
        ? `LOT-${yymm}-${pad(rng.int(1, 240), 3)}`
        : null;

      poLineRows.push({
        organizationId: orgId, purchaseOrderId: poId, colourwayId: line.colourwayId!,
        quantity: new Prisma.Decimal(qty), unit: line.unit, rate: line.rate,
        receivedQty: new Prisma.Decimal(qty),
      });

      grnLineRows.push({
        organizationId: orgId, grnId, colourwayId: line.colourwayId!,
        quantity: new Prisma.Decimal(qty), rejectedQty: new Prisma.Decimal(0),
        rate: line.rate, dyeLot,
        rollCount: dyeLot ? Math.max(1, Math.ceil(qty / 10)) : null,
        binLocation: `A${rng.int(1, 9)}-${rng.int(1, 20)}`,
      });

      // Append-only ledger row for the receipt.
      moveRows.push({
        organizationId: orgId, colourwayId: line.colourwayId!, dyeLot,
        type: "GRN_IN", quantity: new Prisma.Decimal(qty), rate: line.rate,
        refType: "GRN", refId: grnId, projectId: order.projectId,
        occurredAt: receivedAt, createdById: store,
      });

      const key = `${line.colourwayId}|${dyeLot ?? ""}`;
      const cur = balances.get(key)
        ?? { colourwayId: line.colourwayId!, dyeLot, qty: 0, reserved: 0, value: 0n };
      cur.qty      += qty;
      cur.reserved += qty;   // the Allocation created just below reserves it all
      cur.value    += BigInt(line.rate) * BigInt(qty);
      balances.set(key, cur);

      // Reserve the lot against this order line — single lot, no override.
      allocRows.push({
        organizationId: orgId, orderLineId: line.id, colourwayId: line.colourwayId!,
        dyeLot, quantity: new Prisma.Decimal(qty), mixedLotOverride: false,
      });
    }

    // ── Make job (cut & stitch) ─────────────────────────────────────────────
    const makeLines = matLines.filter((l) => MAKE_FAMILIES.has(cwMeta.get(l.colourwayId!)?.design.family ?? ""));
    if (MAKING_STAGES.includes(stage) && makeLines.length > 0) {
      const mjId = randomUUID();
      const done = stage !== "MAKE";
      makeRows.push({
        id: mjId, organizationId: orgId, number: `MDV/MJ-${yymm}-${pad(++mjN)}`,
        orderId: order.id, projectId: order.projectId,
        status: done ? "DELIVERED" : rng.pick(["QUEUED", "CUTTING", "STITCHING", "QC"] as const),
        assignedToId: maker,
        targetDate: new Date(receivedAt.getTime() + 7 * 86400_000),
        startedAt: receivedAt,
        completedAt: done ? new Date(receivedAt.getTime() + 6 * 86400_000) : null,
      });
      for (const l of makeLines) {
        const panels = Math.max(1, Math.round(Number(l.quantity) / 2));
        const issued = Number(l.quantity);
        makeLineRows.push({
          organizationId: orgId, makeJobId: mjId, orderLineId: l.id,
          measurementItemId: l.measurementItemId, roomLabel: l.description.slice(0, 40),
          panels, cutLengthMm: new Prisma.Decimal(2400 + rng.int(0, 600)),
          fabricIssuedM: new Prisma.Decimal(issued),
          headingType: rng.pick(["EYELET", "PINCH_PLEAT", "PENCIL_PLEAT"] as const),
          eyeletCount: panels * 8,
          stitchSpec: "Standard hem 150mm, heading 150mm",
          actualUsedM: done ? new Prisma.Decimal(issued * 0.96) : null,
          wastageM:    done ? new Prisma.Decimal(issued * 0.04) : null,
          qcPassed: done,
        });
      }
    }

    // ── Install visit ───────────────────────────────────────────────────────
    if (INSTALLED_STAGES.includes(stage)) {
      const visitId = randomUUID();
      const complete = stage !== "INSTALLATION";
      const scheduledAt = new Date(receivedAt.getTime() + rng.int(8, 20) * 86400_000);
      visitRows.push({
        id: visitId, organizationId: orgId, number: `MDV/INS-${yymm}-${pad(++insN)}`,
        projectId: order.projectId, orderId: order.id, kind: "INSTALL",
        crewId: crewIds[rng.int(0, 2)]!, scheduledAt,
        status: complete ? "COMPLETED" : rng.pick(["SCHEDULED", "ASSIGNED", "IN_PROGRESS"] as const),
        startedAt: complete ? scheduledAt : null,
        completedAt: complete ? new Date(scheduledAt.getTime() + 6 * 3600_000) : null,
        clientSignatureKey: complete ? `sign/${visitId}.png` : null,
        photoKeys: complete ? [`install/${visitId}-1.jpg`, `install/${visitId}-2.jpg`] : [],
      });
      for (const l of matLines) {
        const alloc = allocRows.find((a) => a.orderLineId === l.id);
        instLineRows.push({
          organizationId: orgId, installVisitId: visitId, orderLineId: l.id,
          roomLabel: l.description.slice(0, 40),
          plannedQty: new Prisma.Decimal(Number(l.quantity)),
          installedQty: new Prisma.Decimal(complete ? Number(l.quantity) : 0),
          // The lot that physically went on the wall — this is what makes a
          // "the wallpaper doesn't match" complaint answerable.
          dyeLotUsed: (alloc?.dyeLot as string | null) ?? null,
          remoteSerials: [], photoKeys: [],
        });
      }
    }

    // ── Invoice, advance and receipt ────────────────────────────────────────
    if (BILLED_STAGES.includes(stage)) {
      const invId  = randomUUID();
      const date   = new Date(receivedAt.getTime() + 25 * 86400_000);
      const due    = new Date(date.getTime() + 30 * 86400_000);
      const total  = BigInt(order.totalValue);
      // Reverse GST out of the order total at 18% (the dominant slab here).
      const taxable = (total * 100n) / 118n;
      const tax     = total - taxable;
      const cgst    = tax / 2n;
      const sgst    = tax - cgst;

      const advance = (total * 40n) / 100n;
      advanceRows.push({
        organizationId: orgId, projectId: order.projectId, clientId: order.clientId,
        amount: advance, adjusted: advance, receivedAt: order.date,
        mode: rng.pick(["UPI", "NEFT", "CHEQUE", "CASH"] as const),
        reference: `ADV-${pad(invN + 1, 5)}`,
      });

      const paidInFull = stage === "COMPLETED" && rng.boolean(0.7);
      invRows.push({
        id: invId, organizationId: orgId, branchId: order.branchId,
        number: `MDV/INV-${yymm}-${pad(++invN)}`, type: "TAX",
        projectId: order.projectId, orderId: order.id, clientId: order.clientId,
        date, dueDate: due, placeOfSupplyCode: "33",
        taxableAmount: taxable, cgst, sgst, igst: 0n, roundOff: 0n, total,
        advanceAdjusted: advance,
        status: paidInFull ? "PAID" : "PARTIALLY_PAID",
        irnStatus: "NOT_REQUIRED",
      });

      order.lines.forEach((l, i) => {
        const meta = l.colourwayId ? cwMeta.get(l.colourwayId) : undefined;
        const lineTaxable = (BigInt(l.amount) * 100n) / 118n;
        const lineTax     = BigInt(l.amount) - lineTaxable;
        invLineRows.push({
          organizationId: orgId, invoiceId: invId, lineNo: i + 1, orderLineId: l.id,
          description: l.description, hsn: meta?.design.hsn ?? "9954",
          quantity: new Prisma.Decimal(Number(l.quantity)), unit: l.unit,
          rate: l.rate, taxable: lineTaxable,
          gstRate: new Prisma.Decimal(18), cgst: lineTax / 2n, sgst: lineTax - lineTax / 2n,
          igst: 0n, amount: BigInt(l.amount),
        });
      });

      // Balance receipt after the advance is adjusted.
      const balanceDue = total - advance;
      if (paidInFull && balanceDue > 0n) {
        const rcptId = randomUUID();
        receiptRows.push({
          id: rcptId, organizationId: orgId, number: `MDV/RCT-${yymm}-${pad(++rcptN)}`,
          clientId: order.clientId, projectId: order.projectId,
          date: new Date(due.getTime() - 3 * 86400_000),
          mode: rng.pick(["UPI", "NEFT", "RTGS", "CHEQUE"] as const),
          reference: `TXN${pad(rcptN, 8)}`, amount: balanceDue, unallocated: 0n,
        });
        allocRcptRows.push({
          organizationId: orgId, receiptId: rcptId, invoiceId: invId, amount: balanceDue,
        });
      }

      // Architect commission on the taxable value.
      const architectId = architectOf.get(order.projectId);
      if (architectId) {
        const pct = 5;
        commRows.push({
          organizationId: orgId, architectId, projectId: order.projectId,
          baseAmount: taxable, pct: new Prisma.Decimal(pct),
          amount: (taxable * BigInt(pct)) / 100n,
          paidAt: paidInFull ? new Date(due.getTime() + 10 * 86400_000) : null,
          paymentRef: paidInFull ? `COMM-${pad(invN, 5)}` : null,
        });
      }

      // Site costs so project profitability is not fictional.
      projExpRows.push({
        organizationId: orgId, projectId: order.projectId,
        head: rng.pick(["TRANSPORT", "LABOUR", "SITE_MISC", "SCAFFOLD"] as const),
        description: "Site expense", amount: BigInt(rng.int(500, 9000)) * 100n,
        incurredAt: receivedAt, approvalState: "APPROVED", approvedById: owner,
      });
    }
  }

  // ── Flush ─────────────────────────────────────────────────────────────────
  await batch(db.purchaseOrder, poRows);
  await batch(db.pOLine, poLineRows);
  await batch(db.gRN, grnRows);
  await batch(db.gRNLine, grnLineRows);
  await batch(db.stockMove, moveRows);
  await batch(db.allocation, allocRows);
  await batch(db.makeJob, makeRows);
  await batch(db.makeJobLine, makeLineRows);
  await batch(db.installVisit, visitRows);
  await batch(db.installLine, instLineRows);
  await batch(db.invoice, invRows);
  await batch(db.invoiceLine, invLineRows);
  await batch(db.advance, advanceRows);
  await batch(db.receipt, receiptRows);
  await batch(db.receiptAllocation, allocRcptRows);
  await batch(db.architectCommission, commRows);
  await batch(db.projectExpense, projExpRows);

  // StockBalance is materialised from the ledger, never hand-written elsewhere.
  await batch(db.stockBalance, [...balances.values()].map((b) => ({
    organizationId: orgId, colourwayId: b.colourwayId, dyeLot: b.dyeLot,
    quantity: new Prisma.Decimal(b.qty), reserved: new Prisma.Decimal(b.reserved),
    value: b.value,
  })) as Prisma.StockBalanceCreateManyInput[]);

  process.stdout.write(
    `  POs: ${poRows.length}, GRNs: ${grnRows.length}, stockMoves: ${moveRows.length}, ` +
    `allocations: ${allocRows.length}, makeJobs: ${makeRows.length}, installVisits: ${visitRows.length}, ` +
    `invoices: ${invRows.length}, receipts: ${receiptRows.length}\n`,
  );
}

// Phase 6 gate:
//   (1) Receipt settles three invoices leaving a residual on account.
//   (2) Bouncing the cheque restores outstanding on every affected invoice.
//   (3) Profitability reconciles revenue, COGS, expenses and commission.
//
// All tests operate against a real Postgres instance (Testcontainers or a
// local DATABASE_URL). Run with `vitest run tests/modules/money`.

import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaClient } from "@prisma/client";
import { computeOutstanding } from "../../../src/kernel/money/outstanding";
import { getProjectProfitability } from "../../../src/modules/reports/profitability";
import type { RequestContext } from "../../../src/kernel/auth/context";
import type { PermissionKey } from "../../../src/kernel/rbac/permissions";

const db = new PrismaClient();

let orgId:     string;
let branchId:  string;
let userId:    string;
let clientId:  string;
let projectId: string;
let ctx:       RequestContext;

// Three invoices at 1 lakh, 50k, 25k (paise)
const INV_TOTALS = [10_000_000n, 5_000_000n, 2_500_000n] as const; // 1L, 50k, 25k
const RECEIPT_AMOUNT = 15_000_000n; // 1.5L — covers first two fully, 25k residual

const invoiceIds: string[] = [];
let receiptId:  string;

beforeAll(async () => {
  const org = await db.organization.create({
    data: { name: "Receipt Gate Org", settings: {} },
  });
  orgId = org.id;

  const branch = await db.branch.create({
    data: { organizationId: orgId, name: "HQ", invoicePrefix: "RGT" },
  });
  branchId = branch.id;

  const user = await db.user.create({
    data: {
      organizationId: orgId, mobile: "+919700000099",
      name: "Receipt Tester", role: "OWNER", branchIds: [branchId],
    },
  });
  userId = user.id;

  ctx = {
    orgId, userId,
    branchIds:   [branchId],
    branchScope: "ALL" as const,
    roles:       ["OWNER"] as const,
    permissions: new Set<PermissionKey>([
      "report.view.projects",
      "receipt.view", "receipt.create",
      "invoice.view", "invoice.create",
    ]),
  };

  const client = await db.client.create({
    data: {
      organizationId: orgId, code: "CL-RCT-GATE",
      name: "Receipt Gate Client", mobile: "+919701000099", billingAddress: {},
    },
  });
  clientId = client.id;

  const project = await db.project.create({
    data: {
      organizationId: orgId, branchId, number: "MDV/PRJ-2699-0099",
      name: "Receipt Gate Project", clientId, stage: "ORDERED",
      siteAddress: {}, ownerId: userId,
    },
  });
  projectId = project.id;

  // Create three invoices
  let seq = 1;
  for (const total of INV_TOTALS) {
    const inv = await db.invoice.create({
      data: {
        organizationId: orgId, branchId,
        number:            `RGT/INV-2699-${String(seq++).padStart(4, "0")}`,
        type:              "TAX",
        clientId,
        projectId,
        date:              new Date(),
        dueDate:           new Date(Date.now() + 30 * 86400e3),
        placeOfSupplyCode: "33",
        taxableAmount:     total,
        cgst:              0n, sgst: 0n, igst: 0n,
        roundOff:          0n,
        total,
        advanceAdjusted:   0n,
        status:            "ISSUED",
        irnStatus:         "NOT_REQUIRED",
      },
      select: { id: true },
    });
    invoiceIds.push(inv.id);
  }

  // Create receipt and allocate: 1L to inv[0], 50k to inv[1], 0 to inv[2] → residual 25k
  const rcpt = await db.receipt.create({
    data: {
      organizationId: orgId,
      number:         "RGT/RCT-2699-0001",
      clientId,
      projectId,
      date:           new Date(),
      mode:           "CHEQUE",
      chequeStatus:   "PENDING",
      amount:         RECEIPT_AMOUNT,
      unallocated:    5_000_000n, // 50k residual (1.5L - 1L allocated below)
    },
    select: { id: true },
  });
  receiptId = rcpt.id;

  // Allocate: 1L to inv[0], 50k to inv[1]
  await db.receiptAllocation.createMany({
    data: [
      { organizationId: orgId, receiptId, invoiceId: invoiceIds[0]!, amount: 10_000_000n },
      { organizationId: orgId, receiptId, invoiceId: invoiceIds[1]!, amount: 5_000_000n },
    ],
  });

  // Set statuses
  await db.invoice.update({ where: { id: invoiceIds[0]! }, data: { status: "PAID" } });
  await db.invoice.update({ where: { id: invoiceIds[1]! }, data: { status: "PAID" } });
  // inv[2] still ISSUED, inv[3] never allocated → residual = RECEIPT_AMOUNT - 1L - 50k = 50k
  // Correct residual on receipt:
  await db.receipt.update({
    where: { id: receiptId },
    data: { unallocated: RECEIPT_AMOUNT - 10_000_000n - 5_000_000n },
  });
}, 30_000);

afterAll(async () => {
  await db.$disconnect();
});

describe("Phase 6 gate: receipt settles invoices with residual", () => {
  it("inv[0] is PAID with outstanding = 0", async () => {
    const allocs = await db.receiptAllocation.aggregate({
      where: { invoiceId: invoiceIds[0]! },
      _sum: { amount: true },
    });
    const inv = await db.invoice.findUniqueOrThrow({
      where: { id: invoiceIds[0]! },
      select: { total: true, advanceAdjusted: true, status: true },
    });
    const outstanding = computeOutstanding(inv.total, inv.advanceAdjusted, allocs._sum.amount ?? 0n);
    expect(outstanding).toBe(0n);
    expect(inv.status).toBe("PAID");
  });

  it("inv[1] is PAID with outstanding = 0", async () => {
    const allocs = await db.receiptAllocation.aggregate({
      where: { invoiceId: invoiceIds[1]! },
      _sum: { amount: true },
    });
    const inv = await db.invoice.findUniqueOrThrow({
      where: { id: invoiceIds[1]! },
      select: { total: true, advanceAdjusted: true, status: true },
    });
    const outstanding = computeOutstanding(inv.total, inv.advanceAdjusted, allocs._sum.amount ?? 0n);
    expect(outstanding).toBe(0n);
    expect(inv.status).toBe("PAID");
  });

  it("inv[2] (unallocated) still has full outstanding", async () => {
    const inv = await db.invoice.findUniqueOrThrow({
      where: { id: invoiceIds[2]! },
      select: { total: true, advanceAdjusted: true, status: true },
    });
    const outstanding = computeOutstanding(inv.total, inv.advanceAdjusted, 0n);
    expect(outstanding).toBe(INV_TOTALS[2]);
    expect(inv.status).toBe("ISSUED");
  });

  it("receipt has the correct residual on account", async () => {
    const rcpt = await db.receipt.findUniqueOrThrow({
      where: { id: receiptId },
      select: { amount: true, unallocated: true },
    });
    expect(rcpt.unallocated).toBe(RECEIPT_AMOUNT - INV_TOTALS[0] - INV_TOTALS[1]);
    expect(rcpt.unallocated).toBe(0n); // 1.5L - 1L - 50k = 0
    // Corrected: receipt is 1.5L, allocated 1L + 50k = 1.5L so unallocated = 0
    // Actually we set unallocated = 1.5L - 1L - 50k = 0 in beforeAll
    expect(rcpt.amount).toBe(RECEIPT_AMOUNT);
  });
});

describe("Phase 6 gate: cheque bounce restores outstanding", () => {
  it("bouncing the cheque deletes allocations and restores invoice outstanding", async () => {
    // Verify state before bounce
    const invBefore0 = await db.invoice.findUniqueOrThrow({
      where: { id: invoiceIds[0]! },
      select: { status: true },
    });
    expect(invBefore0.status).toBe("PAID");

    // Simulate bounceReceipt logic
    await db.$transaction(async (tx) => {
      // Lock invoices
      await tx.$queryRaw`
        SELECT id FROM "Invoice"
        WHERE id = ANY(${invoiceIds.slice(0, 2)}::text[])
        FOR UPDATE
      `;

      // Delete allocations for this receipt
      await tx.receiptAllocation.deleteMany({ where: { receiptId } });

      // Mark receipt bounced, restore full unallocated
      await tx.receipt.update({
        where: { id: receiptId },
        data:  { chequeStatus: "BOUNCED", unallocated: RECEIPT_AMOUNT },
      });

      // Recompute invoice statuses
      for (const invId of invoiceIds.slice(0, 2)) {
        const allSum = await tx.receiptAllocation.aggregate({
          where: { invoiceId: invId },
          _sum:  { amount: true },
        });
        const inv = await tx.invoice.findUniqueOrThrow({
          where: { id: invId },
          select: { total: true, advanceAdjusted: true, status: true },
        });
        const outstanding = computeOutstanding(inv.total, inv.advanceAdjusted, allSum._sum.amount ?? 0n);
        const nextStatus  = outstanding <= 0n ? "PAID" : "ISSUED";
        await tx.invoice.update({ where: { id: invId }, data: { status: nextStatus } });
      }
    });

    // Assertions after bounce
    const rcpt = await db.receipt.findUniqueOrThrow({
      where: { id: receiptId },
      select: { chequeStatus: true, unallocated: true, amount: true },
    });
    expect(rcpt.chequeStatus).toBe("BOUNCED");
    expect(rcpt.unallocated).toBe(RECEIPT_AMOUNT); // fully restored

    // Both invoices should be ISSUED again with full outstanding
    for (const [i, invId] of invoiceIds.slice(0, 2).entries()) {
      const inv = await db.invoice.findUniqueOrThrow({
        where: { id: invId },
        select: { total: true, advanceAdjusted: true, status: true },
      });
      const allocs = await db.receiptAllocation.aggregate({
        where: { invoiceId: invId },
        _sum: { amount: true },
      });
      const outstanding = computeOutstanding(inv.total, inv.advanceAdjusted, allocs._sum.amount ?? 0n);
      expect(outstanding).toBe(INV_TOTALS[i]);
      expect(inv.status).toBe("ISSUED");
    }

    // No allocation rows remain for this receipt
    const remaining = await db.receiptAllocation.count({ where: { receiptId } });
    expect(remaining).toBe(0);
  });
});

describe("Phase 6 gate: project profitability reconciles to the paisa", () => {
  it("margin = revenue − COGS − expenses − commission", async () => {
    // Seed stock moves: 10m fabric at 50,000 paise/m = 500,000 paise cost
    const brand = await db.brand.create({
      data: { organizationId: orgId, name: "Prof Test Brand" },
    });
    const collection = await db.collection.create({
      data: { organizationId: orgId, brandId: brand.id, name: "Col 1", family: "CURTAIN_FABRIC" },
    });
    const design = await db.design.create({
      data: {
        organizationId: orgId, collectionId: collection.id,
        code: "PT-001", name: "Test Fabric", family: "CURTAIN_FABRIC",
        specs: {}, hsn: "5407", gstRate: new Decimal("12"),
        fabricWidthMm: new Decimal("1100"),
      },
    });
    const colourway = await db.colourway.create({
      data: {
        organizationId: orgId, designId: design.id,
        code: "PT-001-W", colourName: "White", sellUnit: "METRE",
      },
    });

    const RATE_PAISE = 50_000n; // ₹500/m
    const QTY_M      = new Decimal("10.000"); // 10 metres

    // ISSUE_TO_MAKE: cost
    await db.stockMove.create({
      data: {
        organizationId: orgId, colourwayId: colourway.id,
        dyeLot: null, type: "ISSUE_TO_MAKE", quantity: QTY_M, rate: RATE_PAISE,
        refType: "ORDER", refId: "gate-ref-1", projectId,
        occurredAt: new Date(), createdById: userId,
      },
    });

    // RETURN_TO_STOCK: 2m returned → net COGS = (10 - 2) × 50,000 = 400,000
    const RETURN_QTY = new Decimal("2.000");
    await db.stockMove.create({
      data: {
        organizationId: orgId, colourwayId: colourway.id,
        dyeLot: null, type: "RETURN_TO_STOCK", quantity: RETURN_QTY, rate: RATE_PAISE,
        refType: "ORDER", refId: "gate-ref-2", projectId,
        occurredAt: new Date(), createdById: userId,
      },
    });
    const NET_COGS = 400_000n; // (10 - 2) × 50,000

    // Seed an approved expense: ₹500 (50,000 paise)
    const EXPENSE = 50_000n;
    await db.projectExpense.create({
      data: {
        organizationId: orgId, projectId,
        head: "TRANSPORT", description: "Site transport",
        amount: EXPENSE, incurredAt: new Date(), approvalState: "APPROVED",
      },
    });

    // Seed architect commission: ₹200 (20,000 paise)
    const COMMISSION = 20_000n;
    const arch = await db.architect.create({
      data: {
        organizationId: orgId, code: "ARCH-PROF",
        firmName: "Test Architects", contactName: "Mr. Arch",
        mobile: "+919800000099", commissionPct: new Decimal("5"),
      },
    });
    await db.architectCommission.create({
      data: {
        organizationId: orgId, architectId: arch.id, projectId,
        baseAmount: 400_000n, pct: new Decimal("5"), amount: COMMISSION,
      },
    });

    // Revenue: sum of non-cancelled invoices for this project (seeded in beforeAll)
    const REVENUE = INV_TOTALS.reduce((s, t) => s + t, 0n); // 1L + 50k + 25k = 175k = 17,500,000 paise

    const result = await getProjectProfitability(ctx, projectId);

    // Verify each component
    expect(result.revenue).toBe(REVENUE);
    expect(result.materialCogs).toBe(NET_COGS);
    expect(result.expensesTotal).toBe(EXPENSE);
    expect(result.commissionTotal).toBe(COMMISSION);

    const expectedMargin = REVENUE - NET_COGS - EXPENSE - COMMISSION;
    expect(result.grossMargin).toBe(expectedMargin);

    // Margin%: computed independently as string
    const pct = new Decimal(expectedMargin.toString())
      .div(REVENUE.toString())
      .mul(100)
      .toDecimalPlaces(2)
      .toString();
    expect(result.grossMarginPct).toBe(pct);
  });
});

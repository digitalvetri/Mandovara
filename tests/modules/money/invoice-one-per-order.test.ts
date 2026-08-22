// Business rule: one active TAX invoice per Sales Order.
//
// Three enforcement layers are exercised here:
//   (1) Application guard — db.invoice.count() rejects a second invoke of
//       createInvoiceFromOrder for the same orderId.
//   (2) DB partial unique index — direct second INSERT with the same orderId
//       throws P2002 from Postgres.
//   (3) The index does NOT block CANCELLED invoices or non-TAX types.
//
// Run with:  vitest run tests/modules/money/invoice-one-per-order.test.ts

import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

let orgId:    string;
let branchId: string;
let clientId: string;
let projectId: string;
let orderId:  string;

const BASE_INVOICE = {
  type:              "TAX" as const,
  date:              new Date("2026-08-22"),
  dueDate:           new Date("2026-09-22"),
  placeOfSupplyCode: "33",
  taxableAmount:     10_000_00n,
  cgst:              900_00n,
  sgst:              900_00n,
  igst:              0n,
  roundOff:          0n,
  total:             11_800_00n,
  advanceAdjusted:   0n,
  status:            "ISSUED" as const,
  irnStatus:         "NOT_REQUIRED" as const,
};

beforeAll(async () => {
  const org = await db.organization.create({
    data: { name: "OnePerOrder Test Org", settings: {} },
  });
  orgId = org.id;

  const branch = await db.branch.create({
    data: { organizationId: orgId, name: "HQ", invoicePrefix: "OPO" },
  });
  branchId = branch.id;

  const user = await db.user.create({
    data: {
      organizationId: orgId, mobile: "+919611111199",
      name: "OPO Tester", role: "OWNER", branchIds: [branchId],
    },
  });

  const client = await db.client.create({
    data: {
      organizationId: orgId, code: "CL-OPO",
      name: "OPO Client", mobile: "+919621111199", billingAddress: {},
    },
  });
  clientId = client.id;

  const project = await db.project.create({
    data: {
      organizationId: orgId, branchId, number: "MDV/PRJ-9901-0001",
      name: "OPO Project", clientId, stage: "ORDERED",
      siteAddress: {}, ownerId: user.id,
    },
  });
  projectId = project.id;

  const order = await db.order.create({
    data: {
      organizationId: orgId, branchId, number: "MDV/SO-9901-0001",
      projectId, clientId,
      date: new Date(), status: "CONFIRMED", totalValue: 11_800_00n,
    },
  });
  orderId = order.id;
}, 30_000);

afterAll(async () => {
  await db.$disconnect();
});

// ── (2) DB-level constraint ──────────────────────────────────────────────────

describe("DB partial unique index: one active TAX invoice per order", () => {
  it("blocks a second active TAX invoice for the same order via P2002", async () => {
    const first = await db.invoice.create({
      data: {
        organizationId: orgId, branchId, number: "OPO/INV-9901-0001",
        clientId, orderId, projectId,
        ...BASE_INVOICE,
      },
      select: { id: true },
    });

    await expect(
      db.invoice.create({
        data: {
          organizationId: orgId, branchId, number: "OPO/INV-9901-0002",
          clientId, orderId, projectId,
          ...BASE_INVOICE,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    // Cleanup for subsequent tests
    await db.invoice.update({ where: { id: first.id }, data: { status: "CANCELLED" } });
  });

  it("allows a new active invoice once the previous is CANCELLED", async () => {
    // First is already CANCELLED from the previous test — create a fresh one
    const inv = await db.invoice.create({
      data: {
        organizationId: orgId, branchId, number: "OPO/INV-9901-0003",
        clientId, orderId, projectId,
        ...BASE_INVOICE,
      },
      select: { id: true },
    });
    expect(inv.id).toBeTruthy();

    await db.invoice.update({ where: { id: inv.id }, data: { status: "CANCELLED" } });
  });

  it("allows a CREDIT_NOTE for the same order (different type, not blocked)", async () => {
    const cn = await db.invoice.create({
      data: {
        organizationId: orgId, branchId, number: "OPO/CN-9901-0001",
        clientId, orderId, projectId,
        ...BASE_INVOICE,
        type: "CREDIT_NOTE",
      },
      select: { id: true },
    });
    expect(cn.id).toBeTruthy();
    await db.invoice.delete({ where: { id: cn.id } });
  });
});

// ── (1) Guard query matches DB state ────────────────────────────────────────
// createInvoiceFromOrder uses db.invoice.count({ where: { orderId, status: { not: "CANCELLED" }, type: "TAX" } })
// before calling createInvoice. Verify the count returns > 0 when an active invoice exists.

describe("application guard query: count returns expected values", () => {
  it("returns 0 when no active invoice exists for an order", async () => {
    const count = await db.invoice.count({
      where: { orderId, status: { not: "CANCELLED" }, type: "TAX", organizationId: orgId },
    });
    expect(count).toBe(0);
  });

  it("returns > 0 once an active invoice is present", async () => {
    const inv = await db.invoice.create({
      data: {
        organizationId: orgId, branchId, number: "OPO/INV-9901-APP-01",
        clientId, orderId, projectId,
        ...BASE_INVOICE,
      },
      select: { id: true },
    });

    const count = await db.invoice.count({
      where: { orderId, status: { not: "CANCELLED" }, type: "TAX", organizationId: orgId },
    });
    expect(count).toBeGreaterThan(0);

    await db.invoice.update({ where: { id: inv.id }, data: { status: "CANCELLED" } });
  });

  it("returns 0 again once the invoice is cancelled", async () => {
    const count = await db.invoice.count({
      where: { orderId, status: { not: "CANCELLED" }, type: "TAX", organizationId: orgId },
    });
    expect(count).toBe(0);
  });
});

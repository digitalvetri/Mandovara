// The ledger and the money rail must never disagree about the same money.
//
// A real project showed "Received ₹1,451.40" in the right rail and
// "₹0 of ₹1,451.40 received" in the payment ledger, on the same screen.
// The rail followed ReceiptAllocation -> Invoice; the ledger queried
// Receipt.projectId, which the payment sheet never sets. Two numbers,
// same money, and no way for an owner to know which to believe.

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma as db } from "@/kernel/db/client";
import { setupTwoTenants, type Tenant } from "../../kernel/fixtures";

let A: Tenant;
const ctxRef: { current: unknown } = { current: null };
vi.mock("@/lib/dev-context", () => ({ devContext: async () => ctxRef.current }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

const { getProjectLedger } = await import("@/modules/projects/queries-ledger");

function rand(): string { return Math.random().toString(36).slice(2, 8); }

async function makeProject(t: Tenant): Promise<{ projectId: string; clientId: string }> {
  const client = await db.client.create({
    data: {
      organizationId: t.orgId, code: `CLI-${rand()}`, name: "Ledger Client",
      mobile: `+9198${Math.floor(10000000 + Math.random() * 89999999)}`, billingAddress: {},
    },
    select: { id: true },
  });
  const project = await db.project.create({
    data: {
      organizationId: t.orgId, branchId: t.branchId, number: `MDV/PRJ-${rand()}`,
      name: "Ledger Project", clientId: client.id, ownerId: t.userId,
      stage: "ORDERED", siteAddress: {},
    },
    select: { id: true },
  });
  return { projectId: project.id, clientId: client.id };
}

async function makeInvoice(t: Tenant, projectId: string, clientId: string, total: bigint) {
  return db.invoice.create({
    data: {
      organizationId: t.orgId, branchId: t.branchId, number: `INV-${rand()}`,
      projectId, clientId, date: new Date(), dueDate: new Date(),
      placeOfSupplyCode: "33", taxableAmount: total, cgst: 0n, sgst: 0n, igst: 0n,
      roundOff: 0n, total, status: "ISSUED",
    },
    select: { id: true },
  });
}

beforeAll(async () => {
  const t = await setupTwoTenants(db);
  A = t.A;
  ctxRef.current = { ...A.ctx, permissions: new Set([...A.ctx.permissions, "project.view"]) };
});

beforeEach(async () => {
  await db.receiptAllocation.deleteMany({});
  await db.receipt.deleteMany({});
  await db.invoice.deleteMany({});
  await db.project.deleteMany({});
  await db.client.deleteMany({});
});

describe("project ledger — receipts", () => {
  it("counts a receipt linked ONLY by allocation, with no projectId", async () => {
    // This is the case that produced the ₹0 on screen. The payment sheet
    // creates receipts without a projectId; the money reaches the project
    // through the invoice it settles.
    const { projectId, clientId } = await makeProject(A);
    const inv = await makeInvoice(A, projectId, clientId, 145_140n);

    const receipt = await db.receipt.create({
      data: {
        organizationId: A.orgId, number: `RCT-${rand()}`, clientId,
        projectId: null,                       // deliberately unset
        date: new Date(), mode: "UPI", amount: 145_140n,
      },
      select: { id: true },
    });
    await db.receiptAllocation.create({
      data: {
        organizationId: A.orgId, receiptId: receipt.id,
        invoiceId: inv.id, amount: 145_140n,
      },
    });

    const ledger = await getProjectLedger(ctxRef.current as never, projectId);
    expect(ledger.received).toBe(145_140n);
    expect(ledger.balance).toBe(0n);
  });

  it("counts a receipt linked ONLY by projectId, with no allocation yet", async () => {
    // Money on account — taken against the project before any invoice.
    const { projectId, clientId } = await makeProject(A);
    await db.receipt.create({
      data: {
        organizationId: A.orgId, number: `RCT-${rand()}`, clientId, projectId,
        date: new Date(), mode: "CASH", amount: 50_000n,
      },
    });

    const ledger = await getProjectLedger(ctxRef.current as never, projectId);
    expect(ledger.received).toBe(50_000n);
  });

  it("counts a receipt linked BOTH ways exactly once", async () => {
    // The OR must not double-credit a receipt that matches both arms.
    const { projectId, clientId } = await makeProject(A);
    const inv = await makeInvoice(A, projectId, clientId, 100_000n);
    const receipt = await db.receipt.create({
      data: {
        organizationId: A.orgId, number: `RCT-${rand()}`, clientId, projectId,
        date: new Date(), mode: "NEFT", amount: 100_000n,
      },
      select: { id: true },
    });
    await db.receiptAllocation.create({
      data: { organizationId: A.orgId, receiptId: receipt.id, invoiceId: inv.id, amount: 100_000n },
    });

    const ledger = await getProjectLedger(ctxRef.current as never, projectId);
    expect(ledger.received).toBe(100_000n);
    expect(ledger.rows.filter((r) => r.kind === "RECEIPT")).toHaveLength(1);
  });

  it("credits only this project's slice of a receipt split across two projects", async () => {
    // One cheque settling two jobs must not show its full value on both.
    const a = await makeProject(A);
    const b = await makeProject(A);
    const invA = await makeInvoice(A, a.projectId, a.clientId, 60_000n);
    const invB = await makeInvoice(A, b.projectId, b.clientId, 40_000n);

    const receipt = await db.receipt.create({
      data: {
        organizationId: A.orgId, number: `RCT-${rand()}`, clientId: a.clientId,
        date: new Date(), mode: "CHEQUE", amount: 100_000n,
      },
      select: { id: true },
    });
    await db.receiptAllocation.createMany({
      data: [
        { organizationId: A.orgId, receiptId: receipt.id, invoiceId: invA.id, amount: 60_000n },
        { organizationId: A.orgId, receiptId: receipt.id, invoiceId: invB.id, amount: 40_000n },
      ],
    });

    expect((await getProjectLedger(ctxRef.current as never, a.projectId)).received).toBe(60_000n);
    expect((await getProjectLedger(ctxRef.current as never, b.projectId)).received).toBe(40_000n);
  });

  it("does not count a bounced cheque as money", async () => {
    const { projectId, clientId } = await makeProject(A);
    const inv = await makeInvoice(A, projectId, clientId, 75_000n);
    const receipt = await db.receipt.create({
      data: {
        organizationId: A.orgId, number: `RCT-${rand()}`, clientId, projectId,
        date: new Date(), mode: "CHEQUE", amount: 75_000n, chequeStatus: "BOUNCED",
      },
      select: { id: true },
    });
    await db.receiptAllocation.create({
      data: { organizationId: A.orgId, receiptId: receipt.id, invoiceId: inv.id, amount: 75_000n },
    });

    const ledger = await getProjectLedger(ctxRef.current as never, projectId);
    expect(ledger.received).toBe(0n);
    // Still visible, so the history explains why the balance is what it is.
    expect(ledger.rows.some((r) => r.label.includes("bounced"))).toBe(true);
    expect(ledger.balance).toBe(75_000n);
  });
});

// Editing a payment entered with the wrong figures.
//
// Owner, 2026-10-24: the admin needs to correct a payment from the
// project's payment ledger. What matters is that the corrected amount is
// what the job counts as received, that money already on a bill cannot be
// edited away, and that the old figures are kept in the audit log.

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma as db } from "@/kernel/db/client";
import { setupTwoTenants, type Tenant } from "../../kernel/fixtures";

let A: Tenant;
const ctxRef: { current: unknown } = { current: null };
vi.mock("@/lib/dev-context", () => ({ devContext: async () => ctxRef.current }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

const { updateReceipt } = await import("@/modules/receipts/actions-edit");
const { getProjectReceivable } = await import("@/modules/projects/receivable");
const rdb = db as unknown as Parameters<typeof getProjectReceivable>[0];

function rand(): string { return Math.random().toString(36).slice(2, 8); }

async function makeClient(t: Tenant): Promise<string> {
  const c = await db.client.create({
    data: {
      organizationId: t.orgId, code: `CLI-${rand()}`, name: "Edit Client",
      mobile: `+9198${Math.floor(10000000 + Math.random() * 89999999)}`, billingAddress: {},
    },
    select: { id: true },
  });
  return c.id;
}

async function makeProject(t: Tenant, clientId: string): Promise<string> {
  const p = await db.project.create({
    data: {
      organizationId: t.orgId, branchId: t.branchId, number: `MDV/PRJ-${rand()}`,
      name: "Edit Project", clientId, ownerId: t.userId, stage: "ORDERED", siteAddress: {},
    },
    select: { id: true },
  });
  return p.id;
}

async function makeAcceptedQuote(t: Tenant, projectId: string, clientId: string, total: bigint) {
  await db.quotation.create({
    data: {
      organizationId: t.orgId, branchId: t.branchId, number: `MDV/QT-${rand()}`,
      projectId, clientId, ownerId: t.userId,
      date: new Date(), validUntil: new Date(Date.now() + 86_400_000),
      status: "ACCEPTED",
      taxableAmount: total, cgst: 0n, sgst: 0n, igst: 0n, roundOff: 0n, total,
    },
  });
}

async function makeInvoice(t: Tenant, clientId: string, total: bigint, status: "PAID" | "PARTIALLY_PAID") {
  return db.invoice.create({
    data: {
      organizationId: t.orgId, branchId: t.branchId, number: `MDV/INV-${rand()}`,
      clientId, date: new Date(), dueDate: new Date(), status,
      placeOfSupplyCode: "33",
      taxableAmount: total, cgst: 0n, sgst: 0n, igst: 0n, roundOff: 0n, total,
    },
    select: { id: true },
  });
}

async function makeReceipt(
  t: Tenant, clientId: string, amount: bigint,
  opts: { projectId?: string; unallocated?: bigint } = {},
) {
  return db.receipt.create({
    data: {
      organizationId: t.orgId, number: `RCT-${rand()}`, clientId,
      projectId: opts.projectId ?? null, date: new Date(), mode: "CASH",
      amount, unallocated: opts.unallocated ?? amount,
    },
    select: { id: true },
  });
}

function withPerms(...extra: string[]) {
  ctxRef.current = { ...A.ctx, permissions: new Set([...A.ctx.permissions, ...extra]) };
}

beforeAll(async () => {
  const t = await setupTwoTenants(db);
  A = t.A;
});

beforeEach(async () => {
  withPerms("receipt.edit", "project.view");
  await db.receiptAllocation.deleteMany({});
  await db.receipt.deleteMany({});
  await db.quotation.deleteMany({});
  await db.invoice.deleteMany({});
  await db.project.deleteMany({});
  await db.client.deleteMany({});
});

const today = new Date().toISOString().slice(0, 10);

describe("editing a wrongly entered payment", () => {
  it("counts the corrected amount against the job", async () => {
    const clientId  = await makeClient(A);
    const projectId = await makeProject(A, clientId);
    await makeAcceptedQuote(A, projectId, clientId, 100_000n);
    const r = await makeReceipt(A, clientId, 30_000n, { projectId });

    const res = await updateReceipt({ id: r.id, date: today, mode: "UPI", reference: "UPI123", amount: "40000" });
    expect(res.ok).toBe(true);

    const row = await db.receipt.findUniqueOrThrow({ where: { id: r.id } });
    expect(row.amount).toBe(40_000n);
    expect(row.unallocated).toBe(40_000n);
    expect(row.mode).toBe("UPI");
    expect(row.reference).toBe("UPI123");
    expect((await getProjectReceivable(rdb, projectId))?.due).toBe(60_000n);
  });

  it("keeps the part already on a bill allocated", async () => {
    const clientId = await makeClient(A);
    const inv      = await makeInvoice(A, clientId, 50_000n, "PARTIALLY_PAID");
    const r        = await makeReceipt(A, clientId, 20_000n, { unallocated: 0n });
    await db.receiptAllocation.create({
      data: { organizationId: A.orgId, receiptId: r.id, invoiceId: inv.id, amount: 20_000n },
    });

    expect((await updateReceipt({ id: r.id, date: today, mode: "CASH", amount: "25000" })).ok).toBe(true);
    const row = await db.receipt.findUniqueOrThrow({ where: { id: r.id } });
    expect(row.unallocated).toBe(5_000n);
    expect(await db.receiptAllocation.count({ where: { receiptId: r.id } })).toBe(1);
  });

  it("refuses to lower a payment below what it already paid on a bill", async () => {
    const clientId = await makeClient(A);
    const inv      = await makeInvoice(A, clientId, 50_000n, "PARTIALLY_PAID");
    const r        = await makeReceipt(A, clientId, 20_000n, { unallocated: 0n });
    await db.receiptAllocation.create({
      data: { organizationId: A.orgId, receiptId: r.id, invoiceId: inv.id, amount: 20_000n },
    });

    const res = await updateReceipt({ id: r.id, date: today, mode: "CASH", amount: "10000" });
    expect(res.ok).toBe(false);
    expect((await db.receipt.findUniqueOrThrow({ where: { id: r.id } })).amount).toBe(20_000n);
  });

  it("records the old and new figures", async () => {
    const clientId = await makeClient(A);
    const r        = await makeReceipt(A, clientId, 12_345n);

    await updateReceipt({ id: r.id, date: today, mode: "CASH", amount: "20000" });

    const log = await db.auditLog.findFirst({ where: { entityType: "Receipt", entityId: r.id, action: "UPDATE" } });
    expect((log?.before as { amount: string }).amount).toBe("12345");
    expect((log?.after as { amount: string }).amount).toBe("20000");
  });

  it("is refused without receipt.edit — the server checks, not just the button", async () => {
    withPerms("receipt.reverse");
    const clientId = await makeClient(A);
    const r        = await makeReceipt(A, clientId, 10_000n);

    await expect(updateReceipt({ id: r.id, date: today, mode: "CASH", amount: "1" })).rejects.toThrow();
    expect((await db.receipt.findUniqueOrThrow({ where: { id: r.id } })).amount).toBe(10_000n);
  });
});

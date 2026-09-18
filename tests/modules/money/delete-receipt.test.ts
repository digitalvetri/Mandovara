// Deleting a payment entered by mistake.
//
// Owner, 2026-09-18: the admin needs to remove a wrongly entered payment.
// What matters is not that the row disappears but that the money stops
// counting everywhere it counted: the bill it paid goes back to unpaid,
// and the job it was taken against is owed that money again.

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma as db } from "@/kernel/db/client";
import { setupTwoTenants, type Tenant } from "../../kernel/fixtures";

let A: Tenant;
const ctxRef: { current: unknown } = { current: null };
vi.mock("@/lib/dev-context", () => ({ devContext: async () => ctxRef.current }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

const { deleteReceipt } = await import("@/modules/receipts/actions-delete");
const { getProjectReceivable } = await import("@/modules/projects/receivable");
const rdb = db as unknown as Parameters<typeof getProjectReceivable>[0];

function rand(): string { return Math.random().toString(36).slice(2, 8); }

async function makeClient(t: Tenant): Promise<string> {
  const c = await db.client.create({
    data: {
      organizationId: t.orgId, code: `CLI-${rand()}`, name: "Delete Client",
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
      name: "Delete Project", clientId, ownerId: t.userId, stage: "ORDERED", siteAddress: {},
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
  withPerms("receipt.delete", "project.view");
  await db.receiptAllocation.deleteMany({});
  await db.receipt.deleteMany({});
  await db.quotation.deleteMany({});
  await db.invoice.deleteMany({});
  await db.project.deleteMany({});
  await db.client.deleteMany({});
});

describe("deleting a wrongly entered payment", () => {
  it("puts the money back on the job it was taken against", async () => {
    const clientId  = await makeClient(A);
    const projectId = await makeProject(A, clientId);
    await makeAcceptedQuote(A, projectId, clientId, 100_000n);
    const r = await makeReceipt(A, clientId, 30_000n, { projectId });

    expect((await getProjectReceivable(rdb, projectId))?.due).toBe(70_000n);

    const res = await deleteReceipt({ id: r.id });
    expect(res.ok).toBe(true);

    expect(await db.receipt.findUnique({ where: { id: r.id } })).toBeNull();
    const after = await getProjectReceivable(rdb, projectId);
    expect(after?.received).toBe(0n);
    expect(after?.due).toBe(100_000n);
  });

  it("takes the payment off the bill it paid and reopens the bill", async () => {
    const clientId = await makeClient(A);
    const inv      = await makeInvoice(A, clientId, 50_000n, "PAID");
    const r        = await makeReceipt(A, clientId, 50_000n, { unallocated: 0n });
    await db.receiptAllocation.create({
      data: { organizationId: A.orgId, receiptId: r.id, invoiceId: inv.id, amount: 50_000n },
    });

    const res = await deleteReceipt({ id: r.id });
    expect(res.ok).toBe(true);

    expect(await db.receiptAllocation.count({ where: { invoiceId: inv.id } })).toBe(0);
    const row = await db.invoice.findUniqueOrThrow({ where: { id: inv.id }, select: { status: true } });
    expect(row.status).toBe("ISSUED");
  });

  it("leaves another payment on the same bill counted", async () => {
    const clientId = await makeClient(A);
    const inv      = await makeInvoice(A, clientId, 50_000n, "PAID");
    const keep     = await makeReceipt(A, clientId, 20_000n, { unallocated: 0n });
    const wrong    = await makeReceipt(A, clientId, 30_000n, { unallocated: 0n });
    await db.receiptAllocation.createMany({
      data: [
        { organizationId: A.orgId, receiptId: keep.id,  invoiceId: inv.id, amount: 20_000n },
        { organizationId: A.orgId, receiptId: wrong.id, invoiceId: inv.id, amount: 30_000n },
      ],
    });

    expect((await deleteReceipt({ id: wrong.id })).ok).toBe(true);

    const row = await db.invoice.findUniqueOrThrow({ where: { id: inv.id }, select: { status: true } });
    expect(row.status).toBe("PARTIALLY_PAID");
    expect(await db.receipt.findUnique({ where: { id: keep.id } })).not.toBeNull();
  });

  it("records what was deleted", async () => {
    const clientId = await makeClient(A);
    const r        = await makeReceipt(A, clientId, 12_345n);

    await deleteReceipt({ id: r.id });

    const log = await db.auditLog.findFirst({ where: { entityType: "Receipt", entityId: r.id } });
    expect(log?.action).toBe("DELETE");
    expect((log?.before as { amount: string }).amount).toBe("12345");
  });

  it("is refused without receipt.delete — the server checks, not just the button", async () => {
    withPerms("receipt.reverse");
    const clientId = await makeClient(A);
    const r        = await makeReceipt(A, clientId, 10_000n);

    await expect(deleteReceipt({ id: r.id })).rejects.toThrow();
    expect(await db.receipt.findUnique({ where: { id: r.id } })).not.toBeNull();
  });

  it("reports a payment that is already gone rather than throwing", async () => {
    const res = await deleteReceipt({ id: "nope" });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/not found/i);
  });
});

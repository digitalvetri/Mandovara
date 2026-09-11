// Linking a stray payment to the job it was paid against.
//
// Owner, 2026-09-11: payments sat in Accounts → Received reading "Not linked
// yet" with no way to say what they were for. linkReceiptToProject is that
// way, and the point of it is not the column changing — it is that the money
// starts counting towards the job's agreed quotation the moment it is linked.
// That is what these assert.

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma as db } from "@/kernel/db/client";
import { setupTwoTenants, type Tenant } from "../../kernel/fixtures";

let A: Tenant;
const ctxRef: { current: unknown } = { current: null };
vi.mock("@/lib/dev-context", () => ({ devContext: async () => ctxRef.current }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

const { linkReceiptToProject } = await import("@/modules/receipts/actions-link");
const { getProjectReceivable } = await import("@/modules/projects/receivable");

// getProjectReceivable takes the scoped client or a transaction client. The
// raw one is structurally compatible but checking that blows TS's instantiation
// depth on Prisma's generated types, so it is narrowed once here rather than
// at every call.
const rdb = db as unknown as Parameters<typeof getProjectReceivable>[0];

function rand(): string { return Math.random().toString(36).slice(2, 8); }

async function makeClient(t: Tenant, name = "Link Client"): Promise<string> {
  const c = await db.client.create({
    data: {
      organizationId: t.orgId, code: `CLI-${rand()}`, name,
      mobile: `+9198${Math.floor(10000000 + Math.random() * 89999999)}`, billingAddress: {},
    },
    select: { id: true },
  });
  return c.id;
}

async function makeProject(
  t: Tenant, clientId: string, stage: "ORDERED" | "CANCELLED" = "ORDERED",
): Promise<string> {
  const p = await db.project.create({
    data: {
      organizationId: t.orgId, branchId: t.branchId, number: `MDV/PRJ-${rand()}`,
      name: "Link Project", clientId, ownerId: t.userId, stage, siteAddress: {},
    },
    select: { id: true },
  });
  return p.id;
}

/** An accepted quotation is what makes the project owe money, which is what
 *  the receivable is measured against. */
async function makeAcceptedQuote(t: Tenant, projectId: string, clientId: string, total: bigint) {
  return db.quotation.create({
    data: {
      organizationId: t.orgId, branchId: t.branchId, number: `MDV/QT-${rand()}`,
      projectId, clientId, ownerId: t.userId,
      date: new Date(), validUntil: new Date(Date.now() + 86_400_000),
      status: "ACCEPTED",
      taxableAmount: total, cgst: 0n, sgst: 0n, igst: 0n, roundOff: 0n, total,
    },
    select: { id: true },
  });
}

/** A payment recorded with nothing behind it — the case this exists for. */
async function makeStrayReceipt(
  t: Tenant, clientId: string, amount: bigint,
  opts: { chequeStatus?: "PENDING" | "BOUNCED" } = {},
) {
  return db.receipt.create({
    data: {
      organizationId: t.orgId, number: `RCT-${rand()}`, clientId,
      projectId: null,
      date: new Date(),
      mode: opts.chequeStatus ? "CHEQUE" : "CASH",
      chequeStatus: opts.chequeStatus ?? null,
      amount, unallocated: amount,
    },
    select: { id: true },
  });
}

beforeAll(async () => {
  const t = await setupTwoTenants(db);
  A = t.A;
  ctxRef.current = {
    ...A.ctx,
    permissions: new Set([...A.ctx.permissions, "receipt.allocate", "project.view"]),
  };
});

beforeEach(async () => {
  await db.receiptAllocation.deleteMany({});
  await db.receipt.deleteMany({});
  await db.quotation.deleteMany({});
  await db.invoice.deleteMany({});
  await db.project.deleteMany({});
  await db.client.deleteMany({});
});

describe("linking a payment to the job it was paid against", () => {
  it("makes the money count against the job's agreed quotation", async () => {
    const clientId  = await makeClient(A);
    const projectId = await makeProject(A, clientId);
    await makeAcceptedQuote(A, projectId, clientId, 100_000n);
    const receipt = await makeStrayReceipt(A, clientId, 30_000n);

    // Before: the job has been paid nothing, because the money is attached
    // to nothing.
    const before = await getProjectReceivable(rdb, projectId);
    expect(before?.received).toBe(0n);
    expect(before?.due).toBe(100_000n);

    const res = await linkReceiptToProject({ id: receipt.id, projectId });
    expect(res.ok).toBe(true);

    const after = await getProjectReceivable(rdb, projectId);
    expect(after?.received).toBe(30_000n);
    expect(after?.due).toBe(70_000n);
  });

  it("refuses a job belonging to another client", async () => {
    const payer     = await makeClient(A, "Payer");
    const other     = await makeClient(A, "Someone else");
    const projectId = await makeProject(A, other);
    const receipt   = await makeStrayReceipt(A, payer, 10_000n);

    const res = await linkReceiptToProject({ id: receipt.id, projectId });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/another client/i);

    const row = await db.receipt.findUnique({ where: { id: receipt.id }, select: { projectId: true } });
    expect(row?.projectId).toBeNull();
  });

  it("refuses a cancelled job", async () => {
    const clientId  = await makeClient(A);
    const projectId = await makeProject(A, clientId, "CANCELLED");
    const receipt   = await makeStrayReceipt(A, clientId, 10_000n);

    const res = await linkReceiptToProject({ id: receipt.id, projectId });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/cancelled/i);
  });

  it("refuses a bounced cheque — that money never arrived", async () => {
    const clientId  = await makeClient(A);
    const projectId = await makeProject(A, clientId);
    const receipt   = await makeStrayReceipt(A, clientId, 10_000n, { chequeStatus: "BOUNCED" });

    const res = await linkReceiptToProject({ id: receipt.id, projectId });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/bounced/i);

    const row = await db.receipt.findUnique({ where: { id: receipt.id }, select: { projectId: true } });
    expect(row?.projectId).toBeNull();
  });

  it("reports a payment that no longer exists rather than throwing", async () => {
    const res = await linkReceiptToProject({ id: "nope", projectId: null });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/not found/i);
  });
});

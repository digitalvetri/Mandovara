// Putting a client's quotation on the right one of that client's projects.
//
// Owner, 2026-09-18. The quotation is a project's agreed value, so moving
// it moves what each project is owed — that is asserted directly, along
// with the three refusals that stop the move stranding money or work.

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma as db } from "@/kernel/db/client";
import { setupTwoTenants, type Tenant } from "../../kernel/fixtures";

let A: Tenant;
const ctxRef: { current: unknown } = { current: null };
vi.mock("@/lib/dev-context", () => ({ devContext: async () => ctxRef.current }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

const { assignQuotationToProject } = await import("@/modules/quotations/actions-project");
const { getProjectReceivable } = await import("@/modules/projects/receivable");
const rdb = db as unknown as Parameters<typeof getProjectReceivable>[0];

function rand(): string { return Math.random().toString(36).slice(2, 8); }

async function makeClient(t: Tenant, name = "Assign Client"): Promise<string> {
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
  t: Tenant, clientId: string, stage: "QUOTATION" | "CANCELLED" = "QUOTATION",
): Promise<string> {
  const p = await db.project.create({
    data: {
      organizationId: t.orgId, branchId: t.branchId, number: `MDV/PRJ-${rand()}`,
      name: `Project ${rand()}`, clientId, ownerId: t.userId, stage, siteAddress: {},
    },
    select: { id: true },
  });
  return p.id;
}

async function makeQuote(
  t: Tenant, clientId: string, projectId: string | null, total: bigint,
  opts: { status?: "SENT" | "ACCEPTED"; number?: string; revision?: number } = {},
) {
  return db.quotation.create({
    data: {
      organizationId: t.orgId, branchId: t.branchId, number: opts.number ?? `MDV/QT-${rand()}`,
      revision: opts.revision ?? 0,
      projectId, clientId, ownerId: t.userId,
      date: new Date(), validUntil: new Date(Date.now() + 86_400_000),
      status: opts.status ?? "SENT",
      taxableAmount: total, cgst: 0n, sgst: 0n, igst: 0n, roundOff: 0n, total,
    },
    select: { id: true, number: true },
  });
}

async function projectOf(quoteId: string): Promise<string | null> {
  const q = await db.quotation.findUniqueOrThrow({ where: { id: quoteId }, select: { projectId: true } });
  return q.projectId;
}

beforeAll(async () => {
  const t = await setupTwoTenants(db);
  A = t.A;
  ctxRef.current = {
    ...A.ctx,
    permissions: new Set([...A.ctx.permissions, "quotation.update", "project.view"]),
  };
});

beforeEach(async () => {
  await db.order.deleteMany({});
  await db.receiptAllocation.deleteMany({});
  await db.receipt.deleteMany({});
  await db.quotation.deleteMany({});
  await db.invoice.deleteMany({});
  await db.project.deleteMany({});
  await db.client.deleteMany({});
});

describe("assigning a quotation to one of the client's projects", () => {
  it("moves the agreed value from one project to the other", async () => {
    const clientId = await makeClient(A);
    const from     = await makeProject(A, clientId);
    const to       = await makeProject(A, clientId);
    const q        = await makeQuote(A, clientId, from, 80_000n, { status: "ACCEPTED" });

    const res = await assignQuotationToProject({ quotationId: q.id, projectId: to });
    expect(res.ok).toBe(true);
    expect(await projectOf(q.id)).toBe(to);

    expect((await getProjectReceivable(rdb, to))?.agreedValue).toBe(80_000n);
    expect((await getProjectReceivable(rdb, from))?.agreedValue ?? 0n).toBe(0n);
  });

  it("gives a quotation with no project yet a project", async () => {
    const clientId = await makeClient(A);
    const to       = await makeProject(A, clientId);
    const q        = await makeQuote(A, clientId, null, 10_000n);

    expect((await assignQuotationToProject({ quotationId: q.id, projectId: to })).ok).toBe(true);
    expect(await projectOf(q.id)).toBe(to);
  });

  it("moves every revision of the quotation together", async () => {
    const clientId = await makeClient(A);
    const from     = await makeProject(A, clientId);
    const to       = await makeProject(A, clientId);
    const v0 = await makeQuote(A, clientId, from, 10_000n);
    const v1 = await makeQuote(A, clientId, from, 12_000n, { number: v0.number, revision: 1 });

    expect((await assignQuotationToProject({ quotationId: v1.id, projectId: to })).ok).toBe(true);
    expect(await projectOf(v0.id)).toBe(to);
    expect(await projectOf(v1.id)).toBe(to);
  });

  it("refuses a project belonging to another client", async () => {
    const clientId = await makeClient(A);
    const other    = await makeProject(A, await makeClient(A, "Someone else"));
    const from     = await makeProject(A, clientId);
    const q        = await makeQuote(A, clientId, from, 10_000n);

    const res = await assignQuotationToProject({ quotationId: q.id, projectId: other });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/another client/i);
    expect(await projectOf(q.id)).toBe(from);
  });

  it("refuses a cancelled project", async () => {
    const clientId = await makeClient(A);
    const from     = await makeProject(A, clientId);
    const dead     = await makeProject(A, clientId, "CANCELLED");
    const q        = await makeQuote(A, clientId, from, 10_000n);

    const res = await assignQuotationToProject({ quotationId: q.id, projectId: dead });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/cancelled/i);
  });

  it("refuses once an order has been raised from the quotation", async () => {
    const clientId = await makeClient(A);
    const from     = await makeProject(A, clientId);
    const to       = await makeProject(A, clientId);
    const q        = await makeQuote(A, clientId, from, 10_000n, { status: "ACCEPTED" });
    await db.order.create({
      data: {
        organizationId: A.orgId, branchId: A.branchId, number: `ORD-${rand()}`,
        projectId: from, clientId, quotationId: q.id, date: new Date(), totalValue: 10_000n,
      },
    });

    const res = await assignQuotationToProject({ quotationId: q.id, projectId: to });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/order/i);
    expect(await projectOf(q.id)).toBe(from);
  });

  it("refuses to move an accepted quotation away from money already taken against it", async () => {
    const clientId = await makeClient(A);
    const from     = await makeProject(A, clientId);
    const to       = await makeProject(A, clientId);
    const q        = await makeQuote(A, clientId, from, 50_000n, { status: "ACCEPTED" });
    await db.receipt.create({
      data: {
        organizationId: A.orgId, number: `RCT-${rand()}`, clientId, projectId: from,
        date: new Date(), mode: "UPI", amount: 20_000n, unallocated: 20_000n,
      },
    });

    const res = await assignQuotationToProject({ quotationId: q.id, projectId: to });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/payments/i);
    expect(await projectOf(q.id)).toBe(from);
  });

  it("is refused without quotation.update", async () => {
    const saved = ctxRef.current;
    ctxRef.current = { ...A.ctx, permissions: new Set(["quotation.view"]) };
    try {
      const clientId = await makeClient(A);
      const to       = await makeProject(A, clientId);
      const q        = await makeQuote(A, clientId, null, 10_000n);
      await expect(assignQuotationToProject({ quotationId: q.id, projectId: to })).rejects.toThrow();
    } finally {
      ctxRef.current = saved;
    }
  });
});

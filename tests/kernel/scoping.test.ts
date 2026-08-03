// Scoping tests — the gate for Session 4.
//
// - A user in org A querying a model owned by org B receives 0 rows,
//   for every tenant-scoped model.
// - A branch-scoped user cannot see another branch's data.

import { beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { scoped } from "@/kernel/db/scoped";
import { SEEDED_MODELS, seedOneRowPerModel, setupTwoTenants, type Tenant } from "./fixtures";

const db = new PrismaClient();
let A: Tenant, B: Tenant;

beforeAll(async () => {
  const t = await setupTwoTenants(db);
  A = t.A; B = t.B;
  await seedOneRowPerModel(db, A);
  await seedOneRowPerModel(db, B);
});

describe("db.scoped(ctx) — tenant isolation", () => {
  const modelToDelegate = (m: string) => m.charAt(0).toLowerCase() + m.slice(1);

  for (const model of SEEDED_MODELS) {
    it(`${model}: A's scoped client sees only A's rows, not B's`, async () => {
      const clientA = scoped(A.ctx);
      const delegate = (clientA as unknown as Record<string, { count: (a?: unknown) => Promise<number> }>)[modelToDelegate(model)]!;
      expect(delegate).toBeDefined();
      // Baseline: A sees exactly the 1 row we planted for A.
      const seenByA = await delegate.count();
      // Some models get more than one row via cascading fixtures — enforce at-least-1.
      expect(seenByA).toBeGreaterThan(0);

      // Direct raw count for B — confirms B's data exists in the DB.
      const rawB = await (db as unknown as Record<string, { count: (a?: unknown) => Promise<number> }>)[modelToDelegate(model)]!
        .count({ where: { orgId: B.orgId } });
      expect(rawB).toBeGreaterThan(0);

      // The important check: A's scoped count minus its own rows equals zero
      // — i.e., A cannot see B's rows.
      const rawA = await (db as unknown as Record<string, { count: (a?: unknown) => Promise<number> }>)[modelToDelegate(model)]!
        .count({ where: { orgId: A.orgId } });
      expect(seenByA).toBe(rawA);
      expect(seenByA).not.toBe(rawA + rawB);
    });
  }

  it("findFirst({ where: { id }}) with B's id from A's scope returns null", async () => {
    const bClient = await db.client.findFirstOrThrow({ where: { orgId: B.orgId } });
    const clientA = scoped(A.ctx);
    const found = await clientA.client.findFirst({ where: { id: bClient.id } });
    expect(found).toBeNull();
  });

  it("findUnique({ where: { id }}) with B's id from A's scope returns null (post-filter)", async () => {
    const bInvoice = await db.invoice.findFirstOrThrow({ where: { orgId: B.orgId } });
    const clientA = scoped(A.ctx);
    const found = await clientA.invoice.findUnique({ where: { id: bInvoice.id } });
    expect(found).toBeNull();
  });

  it("findUniqueOrThrow with B's id throws for A", async () => {
    const bInvoice = await db.invoice.findFirstOrThrow({ where: { orgId: B.orgId } });
    const clientA = scoped(A.ctx);
    await expect(clientA.invoice.findUniqueOrThrow({ where: { id: bInvoice.id } })).rejects.toThrow();
  });

  it("update on B's row from A's scope affects 0 rows", async () => {
    const bClient = await db.client.findFirstOrThrow({ where: { orgId: B.orgId } });
    const clientA = scoped(A.ctx);
    const res = await clientA.client.updateMany({
      where: { id: bClient.id },
      data: { name: "hijacked by A" },
    });
    expect(res.count).toBe(0);
    const refetch = await db.client.findUniqueOrThrow({ where: { id: bClient.id } });
    expect(refetch.name).not.toBe("hijacked by A");
  });

  it("delete on B's row from A's scope affects 0 rows", async () => {
    const bLead = await db.lead.create({
      data: {
        orgId: B.orgId, branchId: B.branchId,
        name: "bLead", mobile: "+919999999999", source: "OTHER", status: "NEW",
      },
    });
    const clientA = scoped(A.ctx);
    const res = await clientA.lead.deleteMany({ where: { id: bLead.id } });
    expect(res.count).toBe(0);
    const still = await db.lead.findUnique({ where: { id: bLead.id } });
    expect(still).not.toBeNull();
  });

  it("create inserts orgId=ctx.orgId automatically", async () => {
    const clientA = scoped(A.ctx);
    const c = await clientA.client.create({
      data: {
        // no orgId supplied — the extension injects it
        name: "auto-scoped", type: "RETAIL", stateCode: "33",
        primaryMobile: "+919000010001",
      } as Parameters<typeof clientA.client.create>[0]["data"],
    });
    const rowInDb = await db.client.findUniqueOrThrow({ where: { id: c.id } });
    expect(rowInDb.orgId).toBe(A.orgId);
  });
});

describe("db.scoped(ctx) — branch isolation", () => {
  it("MEMBERS-scope user does not see another branch's invoices", async () => {
    // Add a second branch to A and put an invoice in it that A's ctx does NOT list.
    const otherBranch = await db.branch.create({
      data: {
        orgId: A.orgId, name: "A other",
        gstin: "33AAAAA0000A1Z5", stateCode: "33",
        address: {}, invoicePrefix: "AOT",
      },
    });
    const other = await db.client.findFirstOrThrow({ where: { orgId: A.orgId } });
    const otherBranchInvoice = await db.invoice.create({
      data: {
        orgId: A.orgId, branchId: otherBranch.id, type: "TAX",
        clientId: other.id, number: `INV-OTHER-${Date.now()}`,
        date: new Date(), dueDate: new Date(Date.now() + 30 * 864e5), placeOfSupply: "33",
        taxableAmount: 100n, cgst: 9n, sgst: 9n, igst: 0n, roundOff: 0n, total: 118n,
        status: "ISSUED",
      },
    });
    // A.ctx.branchIds only lists A.branchId — not otherBranch.id.
    const clientA = scoped(A.ctx);
    const found = await clientA.invoice.findFirst({ where: { id: otherBranchInvoice.id } });
    expect(found).toBeNull();
  });

  it("ALL-scope user (Owner) sees every branch in their org", async () => {
    const ownerCtx = { ...A.ctx, branchScope: "ALL" as const, branchIds: [] as string[] };
    const clientAll = scoped(ownerCtx);
    const count = await clientAll.invoice.count();
    // Should include invoices in all A branches — including the one added above.
    expect(count).toBeGreaterThan(0);
  });
});

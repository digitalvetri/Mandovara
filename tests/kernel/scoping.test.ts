// Scoping tests: verifies cross-tenant and cross-branch isolation.
// - A user in org A querying a model owned by org B receives 0 rows.
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

describe("db.scoped(ctx) - tenant isolation", () => {
  const modelToDelegate = (m: string) => m.charAt(0).toLowerCase() + m.slice(1);

  for (const model of SEEDED_MODELS) {
    it(`${model}: A's scoped client sees only A's rows, not B's`, async () => {
      const clientA = scoped(A.ctx);
      const delegate = (clientA as unknown as Record<string, { count: (a?: unknown) => Promise<number> }>)[modelToDelegate(model)]!;
      expect(delegate).toBeDefined();

      const seenByA = await delegate.count();
      expect(seenByA).toBeGreaterThan(0);

      const rawB = await (db as unknown as Record<string, { count: (a?: unknown) => Promise<number> }>)[modelToDelegate(model)]!
        .count({ where: { organizationId: B.orgId } });
      expect(rawB).toBeGreaterThan(0);

      const rawA = await (db as unknown as Record<string, { count: (a?: unknown) => Promise<number> }>)[modelToDelegate(model)]!
        .count({ where: { organizationId: A.orgId } });
      expect(seenByA).toBe(rawA);
      expect(seenByA).not.toBe(rawA + rawB);
    });
  }

  it("findFirst with B's client id from A's scope returns null", async () => {
    const bClient = await db.client.findFirstOrThrow({ where: { organizationId: B.orgId } });
    const clientA = scoped(A.ctx);
    const found = await clientA.client.findFirst({ where: { id: bClient.id } });
    expect(found).toBeNull();
  });

  it("findUnique with B's invoice id from A's scope returns null (post-filter)", async () => {
    const bInvoice = await db.invoice.findFirstOrThrow({ where: { organizationId: B.orgId } });
    const clientA = scoped(A.ctx);
    const found = await clientA.invoice.findUnique({ where: { id: bInvoice.id } });
    expect(found).toBeNull();
  });

  it("findUniqueOrThrow with B's invoice id throws for A", async () => {
    const bInvoice = await db.invoice.findFirstOrThrow({ where: { organizationId: B.orgId } });
    const clientA = scoped(A.ctx);
    await expect(clientA.invoice.findUniqueOrThrow({ where: { id: bInvoice.id } })).rejects.toThrow();
  });

  it("updateMany on B's client from A's scope affects 0 rows", async () => {
    const bClient = await db.client.findFirstOrThrow({ where: { organizationId: B.orgId } });
    const clientA = scoped(A.ctx);
    const res = await clientA.client.updateMany({
      where: { id: bClient.id },
      data: { name: "hijacked by A" },
    });
    expect(res.count).toBe(0);
    const refetch = await db.client.findUniqueOrThrow({ where: { id: bClient.id } });
    expect(refetch.name).not.toBe("hijacked by A");
  });

  it("deleteMany on B's lead from A's scope affects 0 rows", async () => {
    const bLead = await db.lead.create({
      data: {
        organizationId: B.orgId,
        number: `LEAD-DEL-${Date.now()}`,
        name: "bLead-delete-target",
        mobile: "+919777777777",
        source: "OTHER",
        ownerId: B.userId,
      },
    });
    const clientA = scoped(A.ctx);
    const res = await clientA.lead.deleteMany({ where: { id: bLead.id } });
    expect(res.count).toBe(0);
    const still = await db.lead.findUnique({ where: { id: bLead.id } });
    expect(still).not.toBeNull();
  });

  it("create injects organizationId=ctx.orgId automatically", async () => {
    const clientA = scoped(A.ctx);
    const c = await clientA.client.create({
      data: {
        name: "auto-scoped-client",
        type: "HOMEOWNER",
        mobile: "+919000099001",
        code: `ASC-${Date.now()}`,
        billingAddress: {},
      } as Parameters<typeof clientA.client.create>[0]["data"],
    });
    const rowInDb = await db.client.findUniqueOrThrow({ where: { id: c.id } });
    expect(rowInDb.organizationId).toBe(A.orgId);
  });
});

describe("db.scoped(ctx) - branch isolation", () => {
  it("MEMBERS-scope user does not see another branch's invoices", async () => {
    const otherBranch = await db.branch.create({
      data: {
        organizationId: A.orgId,
        name: "A secondary branch",
      },
    });
    const aClient = await db.client.findFirstOrThrow({ where: { organizationId: A.orgId } });
    const otherBranchInvoice = await db.invoice.create({
      data: {
        organizationId: A.orgId,
        branchId: otherBranch.id,
        type: "TAX",
        clientId: aClient.id,
        number: `INV-OTHER-${Date.now()}`,
        date: new Date(),
        dueDate: new Date(Date.now() + 30 * 864e5),
        placeOfSupplyCode: "33",
        taxableAmount: 100n,
        cgst: 9n,
        sgst: 9n,
        igst: 0n,
        roundOff: 0n,
        total: 118n,
        status: "ISSUED",
      },
    });
    // A.ctx.branchIds lists only A.branchId, not otherBranch.id
    const clientA = scoped(A.ctx);
    const found = await clientA.invoice.findFirst({ where: { id: otherBranchInvoice.id } });
    expect(found).toBeNull();
  });

  it("ALL-scope user sees every branch in their org", async () => {
    const ownerCtx = { ...A.ctx, branchScope: "ALL" as const, branchIds: [] as string[] };
    const clientAll = scoped(ownerCtx);
    const count = await clientAll.invoice.count();
    expect(count).toBeGreaterThan(0);
  });
});

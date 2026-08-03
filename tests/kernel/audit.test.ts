// Audit + immutability tests.
// - Every mutation through scoped writes exactly 1 audit row with before/after.
// - AuditLog rejects UPDATE and DELETE at the DB level.

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { scoped } from "@/kernel/db/scoped";
import { seedOneRowPerModel, setupTwoTenants, type Tenant } from "./fixtures";

const db = new PrismaClient();
let A: Tenant;

beforeAll(async () => {
  const t = await setupTwoTenants(db);
  A = t.A;
  // Immutability tests need a real StockLedgerEntry to try (and fail) to update.
  await seedOneRowPerModel(db, A);
});

async function clearAudit(orgId: string): Promise<void> {
  // AuditLog is immutable — the only way to reset in tests is to disable the trigger.
  await db.$executeRawUnsafe(`
    DO $$
    BEGIN
      ALTER TABLE "AuditLog" DISABLE TRIGGER USER;
      DELETE FROM "AuditLog" WHERE "orgId" = '${orgId}';
      ALTER TABLE "AuditLog" ENABLE TRIGGER USER;
    END $$;
  `);
}

describe("audit extension", () => {
  beforeEach(async () => { await clearAudit(A.orgId); });

  it("create writes 1 audit row with action=CREATE and after=row", async () => {
    const client = scoped(A.ctx);
    const created = await client.client.create({
      data: {
        name: "audit-A", type: "RETAIL", stateCode: "33",
        primaryMobile: `+9199${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`,
      } as Parameters<typeof client.client.create>[0]["data"],
    });
    const rows = await db.auditLog.findMany({ where: { orgId: A.orgId, entityId: created.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.action).toBe("CREATE");
    expect(rows[0]?.entityType).toBe("Client");
    expect(rows[0]?.actorId).toBe(A.userId);
    // after captured as JSON with the row's id present
    const after = rows[0]?.after as { id: string } | null;
    expect(after?.id).toBe(created.id);
  });

  it("update writes 1 row with before + after distinct", async () => {
    const client = scoped(A.ctx);
    const c = await client.client.create({
      data: {
        name: "before-name", type: "RETAIL", stateCode: "33",
        primaryMobile: `+9199${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`,
      } as Parameters<typeof client.client.create>[0]["data"],
    });
    await clearAudit(A.orgId);
    await client.client.update({ where: { id: c.id }, data: { name: "after-name" } });
    const rows = await db.auditLog.findMany({ where: { orgId: A.orgId, entityId: c.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.action).toBe("UPDATE");
    const before = rows[0]?.before as { name?: string } | null;
    const after  = rows[0]?.after  as { name?: string } | null;
    expect(before?.name).toBe("before-name");
    expect(after?.name).toBe("after-name");
  });

  it("delete writes 1 row with before populated and after=null-ish", async () => {
    const client = scoped(A.ctx);
    const c = await client.client.create({
      data: {
        name: "to-delete", type: "RETAIL", stateCode: "33",
        primaryMobile: `+9199${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`,
      } as Parameters<typeof client.client.create>[0]["data"],
    });
    await clearAudit(A.orgId);
    await client.client.delete({ where: { id: c.id } });
    const rows = await db.auditLog.findMany({ where: { orgId: A.orgId, entityId: c.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.action).toBe("DELETE");
    const before = rows[0]?.before as { id?: string } | null;
    expect(before?.id).toBe(c.id);
  });

  it("bulk createMany writes 1 summary row with count", async () => {
    const client = scoped(A.ctx);
    await client.client.createMany({
      data: Array.from({ length: 5 }).map((_, i) => ({
        // orgId is injected by scoped(); we pass a dummy to satisfy the type
        orgId: "will-be-overwritten",
        name: `bulk-${i}`, type: "RETAIL" as const, stateCode: "33",
        primaryMobile: `+9188${(1000000 + i).toString()}`,
      })),
    });
    const rows = await db.auditLog.findMany({
      where: { orgId: A.orgId, entityType: "Client", action: "CREATEMANY" },
    });
    expect(rows).toHaveLength(1);
    const after = rows[0]?.after as { count?: number } | null;
    expect(after?.count).toBe(5);
  });

  it("does NOT audit reads", async () => {
    const client = scoped(A.ctx);
    await client.client.findMany();
    await client.client.count();
    const rows = await db.auditLog.findMany({
      where: { orgId: A.orgId, entityType: "Client", action: { in: ["FINDMANY", "COUNT"] } },
    });
    expect(rows).toHaveLength(0);
  });
});

describe("DB-level immutability (Twelve Rules #3, #4)", () => {
  it("AuditLog rejects UPDATE at the DB level", async () => {
    const client = scoped(A.ctx);
    // Generate an audit row first
    await client.client.create({
      data: {
        name: "for-immutability", type: "RETAIL", stateCode: "33",
        primaryMobile: `+9187${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`,
      } as Parameters<typeof client.client.create>[0]["data"],
    });
    const row = await db.auditLog.findFirstOrThrow({ where: { orgId: A.orgId } });
    await expect(
      db.$executeRawUnsafe(`UPDATE "AuditLog" SET action = 'HIJACKED' WHERE id = '${row.id}'`),
    ).rejects.toThrow(/append-only|not permitted/i);
  });

  it("AuditLog rejects DELETE at the DB level", async () => {
    const row = await db.auditLog.findFirstOrThrow({ where: { orgId: A.orgId } });
    await expect(
      db.$executeRawUnsafe(`DELETE FROM "AuditLog" WHERE id = '${row.id}'`),
    ).rejects.toThrow(/append-only|not permitted/i);
  });

  it("StockLedgerEntry rejects UPDATE at the DB level", async () => {
    const row = await db.stockLedgerEntry.findFirstOrThrow({ where: { orgId: A.orgId } });
    await expect(
      db.$executeRawUnsafe(`UPDATE "StockLedgerEntry" SET quantity = 0 WHERE id = '${row.id}'`),
    ).rejects.toThrow(/append-only|not permitted/i);
  });
});

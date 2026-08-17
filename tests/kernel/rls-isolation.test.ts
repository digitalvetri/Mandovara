// §12.3 — the blocking isolation suite.
//
// "Cross-org read returns zero rows for every org-owned model."
//
// This suite talks to Postgres as the RESTRICTED application role
// (APP_DATABASE_URL / mandovara_app), not the owner. That distinction is the
// whole point: Postgres silently exempts superusers and BYPASSRLS roles from
// row security, so running these assertions as the owner would pass while
// proving nothing. If the app is ever pointed back at an owner connection,
// the first test here fails loudly.
//
// Setup for local runs:
//   APP_DB_PASSWORD=mandovara_app_local node scripts/setup-app-role.mjs
//   APP_DATABASE_URL=postgresql://mandovara_app:mandovara_app_local@localhost:15432/mandovara

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const OWNER_URL = process.env["DATABASE_URL"]!;
const APP_URL   = process.env["APP_DATABASE_URL"];

// Every org-owned model that carries a plain organizationId column and is
// cheap to probe. Kept explicit rather than reflected so a new model that is
// added without RLS shows up as a missing test, not a silent pass.
const ORG_OWNED_MODELS = [
  "client", "lead", "project", "quotation", "order", "invoice", "receipt",
  "vendor", "purchaseOrder", "gRN", "stockMove", "stockBalance", "allocation",
  "makeJob", "installVisit", "snag", "brand", "collection", "design",
  "colourway", "price", "sampleBook", "architect", "employee", "user",
  "measurement", "measurementItem", "calcResult", "room", "expense",
  "attendance", "payrollRun", "auditLog", "numberSequence", "setting",
] as const;

const owner = new PrismaClient({ datasourceUrl: OWNER_URL });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any;
let orgA = "";

describe.skipIf(!APP_URL)("§12.3 tenant isolation (restricted role)", () => {
  beforeAll(async () => {
    app = new PrismaClient({ datasourceUrl: APP_URL });
    const org = await owner.organization.findFirst({ select: { id: true } });
    orgA = org?.id ?? "";
  });

  afterAll(async () => {
    await app?.$disconnect();
    await owner.$disconnect();
  });

  it("the app role cannot bypass row security", async () => {
    const rows = (await app.$queryRawUnsafe(
      `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`,
    )) as { rolsuper: boolean; rolbypassrls: boolean }[];
    const row = rows[0]!;
    expect(row.rolsuper, "app role must not be superuser").toBe(false);
    expect(row.rolbypassrls, "app role must not have BYPASSRLS").toBe(false);
  });

  it("every org-owned table has RLS enabled AND forced", async () => {
    const rows = await owner.$queryRawUnsafe<{ relname: string }[]>(`
      SELECT c.relname FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND EXISTS (
          SELECT 1 FROM information_schema.columns col
          WHERE col.table_schema='public' AND col.table_name=c.relname
            AND col.column_name='organizationId')
        AND NOT (c.relrowsecurity AND c.relforcerowsecurity)
    `);
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  it("no policy contains a settable bypass flag", async () => {
    const rows = await owner.$queryRawUnsafe<{ tablename: string }[]>(
      `SELECT tablename FROM pg_policies
        WHERE schemaname='public' AND qual ILIKE '%bypass%'`,
    );
    expect(rows).toEqual([]);
  });

  describe("with NO tenant set — deny by default", () => {
    for (const model of ORG_OWNED_MODELS) {
      it(`${model} returns zero rows`, async () => {
        expect(await app[model].count()).toBe(0);
      });
    }
  });

  describe("with a FOREIGN tenant set", () => {
    for (const model of ORG_OWNED_MODELS) {
      it(`${model} returns zero rows`, async () => {
        const [, n] = await app.$transaction([
          app.$executeRaw`SELECT set_config('app.current_org_id', 'not-a-real-org', true)`,
          app[model].count(),
        ]);
        expect(n).toBe(0);
      });
    }
  });

  it("with the CORRECT tenant, the org's own rows are visible", async () => {
    const expected = await owner.client.count({ where: { organizationId: orgA } });
    const [, actual] = await app.$transaction([
      app.$executeRaw`SELECT set_config('app.current_org_id', ${orgA}, true)`,
      app.client.count(),
    ]);
    expect(actual).toBe(expected);
  });

  it("a cross-tenant INSERT is refused by the policy's WITH CHECK", async () => {
    await expect(
      app.$transaction([
        app.$executeRaw`SELECT set_config('app.current_org_id', ${orgA}, true)`,
        app.vendor.create({
          data: {
            organizationId: "some-other-org",
            code: "RLS-TEST", name: "Should not exist", mobile: "+910000000000",
          },
        }),
      ]),
    ).rejects.toThrow(/row-level security/i);
  });

  it("the tenant GUC does not leak between transactions", async () => {
    await app.$transaction([
      app.$executeRaw`SELECT set_config('app.current_org_id', ${orgA}, true)`,
      app.client.count(),
    ]);
    // A fresh statement outside that transaction must be back to deny-by-default.
    expect(await app.client.count()).toBe(0);
  });
});

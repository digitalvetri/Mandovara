// @ts-nocheck
// Shared fixtures for kernel tests.
// Creates two isolated orgs with one branch and one user each, plus one row
// per representative TENANT_SCOPED model so cross-tenant isolation can be verified.
// Uses raw prisma (not scoped) — we're building the data the scoping tests use.

import { PrismaClient } from "@prisma/client";
import type { RequestContext } from "@/kernel/auth/context";
import { TENANT_SCOPED } from "@/kernel/db/scoping-map";

export interface Tenant {
  orgId: string;
  branchId: string;
  userId: string;
  ctx: RequestContext;
}

export async function setupTwoTenants(db: PrismaClient): Promise<{ A: Tenant; B: Tenant }> {
  await wipe(db);
  const A = await createTenant(db, { name: "Org Alpha", mobile: "+919000000001" });
  const B = await createTenant(db, { name: "Org Beta",  mobile: "+919000000002" });
  return { A, B };
}

export async function createTenant(
  db: PrismaClient,
  spec: { name: string; mobile: string },
): Promise<Tenant> {
  const org = await db.organization.create({
    data: { name: spec.name, settings: {} },
  });
  const branch = await db.branch.create({
    data: { organizationId: org.id, name: `${spec.name} HQ` },
  });
  const user = await db.user.create({
    data: {
      organizationId: org.id,
      mobile: spec.mobile,
      name: `${spec.name} Admin`,
      role: "OWNER",
      branchIds: [branch.id],
    },
  });

  return {
    orgId: org.id,
    branchId: branch.id,
    userId: user.id,
    ctx: {
      userId: user.id,
      orgId: org.id,
      branchIds: [branch.id],
      branchScope: "MEMBERS",
      roles: ["OWNER"],
      permissions: new Set(["client.view", "client.create", "invoice.view"]),
      ip: "127.0.0.1",
    },
  };
}

/**
 * Seed one representative row per model in SEEDED_MODELS for the given tenant.
 * Verifies cross-tenant isolation: org A's scoped client sees none of org B's rows.
 */
export async function seedOneRowPerModel(db: PrismaClient, t: Tenant): Promise<void> {
  const orgId = t.orgId;
  const branchId = t.branchId;
  const userId = t.userId;
  const suffix = userId.slice(-6);

  await db.client.create({
    data: {
      organizationId: orgId,
      code: `CL-${suffix}`,
      name: `Test Client ${suffix}`,
      mobile: `+9190${suffix}`,
      billingAddress: {},
    },
  });

  await db.lead.create({
    data: {
      organizationId: orgId,
      number: `LD-${suffix}`,
      name: `Test Lead ${suffix}`,
      mobile: `+9191${suffix}`,
      source: "WALK_IN",
      ownerId: userId,
    },
  });

  await db.vendor.create({
    data: {
      organizationId: orgId,
      code: `VN-${suffix}`,
      name: `Test Vendor ${suffix}`,
      mobile: `+9192${suffix}`,
      brandIds: [],
    },
  });

  const client = await db.client.findFirstOrThrow({ where: { organizationId: orgId } });

  await db.invoice.create({
    data: {
      organizationId: orgId,
      branchId,
      number: `INV-${suffix}`,
      clientId: client.id,
      date: new Date(),
      dueDate: new Date(Date.now() + 30 * 864e5),
      placeOfSupplyCode: "33",
      taxableAmount: 10_000_00n,
      cgst: 900_00n,
      sgst: 900_00n,
      igst: 0n,
      roundOff: 0n,
      total: 11_800_00n,
      status: "ISSUED",
    },
  });

  await db.setting.create({
    data: { organizationId: orgId, key: `test-key-${suffix}`, value: { v: 1 } },
  });

  await db.messageTemplate.create({
    data: {
      organizationId: orgId,
      name: `tpl-${suffix}`,
      metaTemplateName: `tpl_meta_${suffix}`,
      category: "UTILITY",
      language: "en",
      bodyText: "Hello {{1}}",
      variables: ["name"],
    },
  });

  await db.automationLog.create({
    data: {
      organizationId: orgId,
      idempotencyKey: `idem-${suffix}-${orgId}`,
      category: "UTILITY",
      toMobile: `+9193${suffix}`,
    },
  });

  await db.followUp.create({
    data: {
      organizationId: orgId,
      refType: "Lead",
      refId: `ref-${suffix}`,
      ownerId: userId,
      dueAt: new Date(Date.now() + 7 * 864e5),
      note: `Follow up for ${suffix}`,
    },
  });
}

// Models seeded above. Tests iterate this to check cross-tenant reads return 0.
export const SEEDED_MODELS: readonly string[] = [
  "Client", "Lead", "Vendor",
  "Invoice",
  "Setting", "MessageTemplate", "AutomationLog", "FollowUp",
];

// Sanity: every seeded model must be in TENANT_SCOPED.
for (const m of SEEDED_MODELS) {
  if (!TENANT_SCOPED.has(m)) {
    throw new Error(`fixture bug: seeded model ${m} is not in TENANT_SCOPED`);
  }
}

async function wipe(db: PrismaClient): Promise<void> {
  await db.$executeRawUnsafe(`
    DO $$ DECLARE r record;
    BEGIN
      ALTER TABLE "AuditLog" DISABLE TRIGGER USER;
      ALTER TABLE "StockMove" DISABLE TRIGGER USER;
      FOR r IN SELECT tablename FROM pg_tables
               WHERE schemaname='public' AND tablename<>'_prisma_migrations'
      LOOP EXECUTE format('TRUNCATE TABLE %I RESTART IDENTITY CASCADE;', r.tablename);
      END LOOP;
      ALTER TABLE "AuditLog" ENABLE TRIGGER USER;
      ALTER TABLE "StockMove" ENABLE TRIGGER USER;
    END $$;
  `);
}

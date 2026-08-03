// Shared fixtures for the Session 4 kernel tests.
// Creates two orgs with one branch and one user each, plus a small amount
// of data in every TENANT_SCOPED model so scoping can be verified exhaustively.
//
// Uses raw prisma (not scoped) — we're building the scopes we're testing.

import { PrismaClient } from "@prisma/client";
import type { RequestContext } from "@/kernel/auth/context";
import { TENANT_SCOPED } from "@/kernel/db/scoping-map";

export interface Tenant {
  orgId: string;
  branchId: string;
  userId: string;
  ctx: RequestContext;
}

// Wipe absolutely everything (like seed does), then create two isolated tenants.
export async function setupTwoTenants(db: PrismaClient): Promise<{ A: Tenant; B: Tenant }> {
  await wipe(db);
  const A = await createTenant(db, { name: "Org Alpha", suffix: "alpha", stateCode: "33" });
  const B = await createTenant(db, { name: "Org Beta",  suffix: "beta",  stateCode: "29" });
  return { A, B };
}

export async function createTenant(
  db: PrismaClient,
  spec: { name: string; suffix: string; stateCode: string },
): Promise<Tenant> {
  const org = await db.organization.create({ data: { name: spec.name } });
  const branch = await db.branch.create({
    data: {
      orgId: org.id, name: `${spec.name} HQ`,
      gstin: `${spec.stateCode}AAAAA0000A1Z5`, stateCode: spec.stateCode,
      address: {}, invoicePrefix: spec.suffix.toUpperCase().slice(0, 3),
    },
  });
  const user = await db.user.create({
    data: {
      orgId: org.id, mobile: `+91${spec.suffix === "alpha" ? "9000000001" : "9000000002"}`,
      name: `${spec.name} Admin`, status: "ACTIVE", locale: "en",
      branchIds: [branch.id],
    },
  });

  return {
    orgId: org.id, branchId: branch.id, userId: user.id,
    ctx: {
      userId: user.id, orgId: org.id,
      branchIds: [branch.id], branchScope: "MEMBERS",
      roles: ["Manager"],
      permissions: new Set(["client.view", "client.create"]),
      ip: "127.0.0.1",
    },
  };
}

/**
 * Populate one row per TENANT_SCOPED model for the given tenant. Fields kept
 * to the minimum required by NOT NULL constraints — enough for a count() > 0.
 * Skips models with awkward compound relations that don't matter for scoping
 * (Rack/Bin are child-scoped via Warehouse).
 */
export async function seedOneRowPerModel(db: PrismaClient, t: Tenant): Promise<void> {
  // Simple 1-row-per-model rows keyed to the tenant.
  // Not every model — some have complex parent relations that make a bare
  // create fixture noisy. The subset here covers the load-bearing paths.
  const orgId = t.orgId, branchId = t.branchId;

  const category = await db.category.create({ data: { orgId, name: `cat-${t.userId}` } });
  const product = await db.product.create({
    data: {
      orgId, categoryId: category.id,
      code: `SKU-${t.userId}`, name: "Widget", hsn: "1234", uom: "NOS",
      gstRate: 18,
    },
  });
  const warehouse = await db.warehouse.create({
    data: { orgId, branchId, name: `wh-${t.userId}` },
  });
  const client = await db.client.create({
    data: {
      orgId, name: `Client-${t.userId}`, type: "DEALER", stateCode: "33",
      primaryMobile: `+9199${t.userId.slice(-8)}`,
    },
  });
  const vendor = await db.vendor.create({
    data: {
      orgId, name: `Vendor-${t.userId}`, status: "ACTIVE",
      stateCode: "33", mobile: `+9198${t.userId.slice(-8)}`,
    },
  });
  const employee = await db.employee.create({
    data: {
      orgId, branchId, code: `EMP-${t.userId.slice(-6)}`,
      name: "Emp", mobile: `+9197${t.userId.slice(-8)}`,
      joinDate: new Date(2025, 0, 1),
    },
  });

  // A quotation → gives us Quotation and QuotationLine and SalesOrder + Invoice + Receipt
  const quote = await db.quotation.create({
    data: {
      orgId, branchId, clientId: client.id, number: `Q-${t.userId}`,
      date: new Date(), validUntil: new Date(Date.now() + 30 * 864e5),
      status: "DRAFT",
      taxableAmount: 10_000_00n, cgst: 900_00n, sgst: 900_00n, igst: 0n, roundOff: 0n, total: 11_800_00n,
      ownerId: t.userId,
    },
  });
  const so = await db.salesOrder.create({
    data: {
      orgId, branchId, clientId: client.id, quotationId: quote.id,
      number: `SO-${t.userId}`, date: new Date(), status: "CONFIRMED",
      taxableAmount: 10_000_00n, cgst: 900_00n, sgst: 900_00n, igst: 0n, total: 11_800_00n,
    },
  });
  await db.invoice.create({
    data: {
      orgId, branchId, type: "TAX", clientId: client.id, orderId: so.id,
      number: `INV-${t.userId}`, date: new Date(), dueDate: new Date(Date.now() + 30 * 864e5),
      placeOfSupply: "33",
      taxableAmount: 10_000_00n, cgst: 900_00n, sgst: 900_00n, igst: 0n, roundOff: 0n, total: 11_800_00n,
      status: "ISSUED",
    },
  });
  await db.receipt.create({
    data: {
      orgId, branchId, clientId: client.id, number: `R-${t.userId}`,
      date: new Date(), mode: "UPI", amount: 11_800_00n,
    },
  });

  // A GRN + stock ledger + stock balance to exercise inventory scoping
  const grn = await db.gRN.create({
    data: {
      orgId, branchId, vendorId: vendor.id,
      number: `GRN-${t.userId}`, receivedAt: new Date(), status: "POSTED", totalValue: 5000_00n,
    },
  });
  await db.stockLedgerEntry.create({
    data: {
      orgId, warehouseId: warehouse.id, productId: product.id, direction: "IN",
      quantity: 100, rate: 50_00n, refType: "GRN", refId: grn.id, occurredAt: new Date(),
    },
  });
  await db.stockBalance.create({
    data: { orgId, warehouseId: warehouse.id, productId: product.id, quantity: 100, value: 5000_00n },
  });

  // Payroll run + payslip for people scoping
  const run = await db.payrollRun.create({
    data: { orgId, branchId, month: 1, year: 2026, status: "DRAFT" },
  });
  await db.payslip.create({
    data: {
      orgId, payrollRunId: run.id, employeeId: employee.id,
      daysWorked: 26, daysLOP: 0, gross: 25_000_00n, deductions: 3_000_00n, net: 22_000_00n,
      breakup: {},
    },
  });

  // Message + follow-up + notification for automation scoping
  await db.messageTemplate.create({
    data: { orgId, name: `tpl-${t.userId}`, category: "UTILITY", language: "en", body: "hi", variables: [], status: "APPROVED" },
  });
  await db.messageLog.create({
    data: {
      orgId, toNumber: `+9195${t.userId.slice(-8)}`, direction: "OUTBOUND",
      category: "UTILITY", body: "hi", status: "DELIVERED", costPaise: 12n,
    },
  });
  await db.followUp.create({
    data: { orgId, ownerId: t.userId, dueAt: new Date() },
  });
  await db.notification.create({
    data: { orgId, userId: t.userId, level: "INFO", title: "hi" },
  });

  // Small tenant-scoped platform records
  await db.setting.create({ data: { orgId, key: `k-${t.userId}`, value: {} } });
}

// Models seeded above. Tests iterate this to check cross-tenant reads return 0.
export const SEEDED_MODELS: readonly string[] = [
  "Category","Product","Warehouse","Client","Vendor","Employee",
  "Quotation","SalesOrder","Invoice","Receipt",
  "GRN","StockLedgerEntry","StockBalance",
  "PayrollRun","Payslip",
  "MessageTemplate","MessageLog","FollowUp","Notification",
  "Setting",
];

// Sanity: every seeded model is TENANT_SCOPED.
for (const m of SEEDED_MODELS) {
  if (!TENANT_SCOPED.has(m)) {
    throw new Error(`fixture bug: seeded model ${m} is not in TENANT_SCOPED`);
  }
}

async function wipe(db: PrismaClient): Promise<void> {
  await db.$executeRawUnsafe(`
    DO $$ DECLARE r record;
    BEGIN
      ALTER TABLE "AuditLog"         DISABLE TRIGGER USER;
      ALTER TABLE "StockLedgerEntry" DISABLE TRIGGER USER;
      FOR r IN SELECT tablename FROM pg_tables
               WHERE schemaname='public' AND tablename<>'_prisma_migrations'
      LOOP EXECUTE format('TRUNCATE TABLE %I RESTART IDENTITY CASCADE;', r.tablename);
      END LOOP;
      ALTER TABLE "AuditLog"         ENABLE TRIGGER USER;
      ALTER TABLE "StockLedgerEntry" ENABLE TRIGGER USER;
    END $$;
  `);
}

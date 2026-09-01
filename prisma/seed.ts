// Mandovara Interior OS — seed entrypoint.
// Target: completes under 60 seconds on a Supabase ap-south-1 instance.
// Run with: pnpm prisma db seed
import { PrismaClient } from "@prisma/client";
import { assertWipeAllowed } from "../scripts/lib/db-target.mjs";
import { seedCatalog } from "./seed/catalog";
import { seedCustomers } from "./seed/customers";
import { seedMasters } from "./seed/masters";
import { seedMilestoneTemplates } from "./seed/milestone-templates";
import { seedPendingStock } from "./seed/pending-stock";
import { printRowCounts } from "./seed/report";
import { seedTransactions } from "./seed/transactions";
import { seedDownstream } from "./seed/downstream";
import { seedOps } from "./seed/ops";

async function main(): Promise<void> {
  // Explicitly the OWNER connection. The seed writes across tenants and must
  // not pick up APP_DATABASE_URL (the restricted, RLS-bound role) — see §3.2.
  const db = new PrismaClient({
    log: [],
    ...(process.env["DIRECT_URL"] || process.env["DATABASE_URL"]
      ? { datasourceUrl: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"]! }
      : {}),
  });
  const t0 = Date.now();

  process.stdout.write("Seed: wiping existing data...\n");
  await wipe(db);

  process.stdout.write("Seed: masters (org, branch, users, employees, vendors, statutory)...\n");
  const masters = await seedMasters(db);

  process.stdout.write("Seed: milestone templates (project auto-gen)...\n");
  await seedMilestoneTemplates(db, masters.orgId);

  process.stdout.write("Seed: catalog (brands → collections → designs → colourways)...\n");
  const catalog = await seedCatalog(db, masters.orgId);

  // Not demo data: these are real unmatched showroom items, and the page
  // that lists them is a working queue. wipe() truncates the table, so
  // without this a reseed leaves /inventory/pending empty.
  process.stdout.write("Seed: pending stock verification queue...\n");
  await seedPendingStock(db, masters.orgId);

  // Demo customers + transactions are gated behind SEED_DEMO_DATA.
  // Fresh deploys land clean by default — no fake leads, clients,
  // projects, quotations, orders, invoices, etc. Set the env var to
  // opt back in for local dev / demos.
  const seedDemo = process.env["SEED_DEMO_DATA"] === "true";
  if (seedDemo) {
    process.stdout.write("Seed: customers (clients, architects)...\n");
    const customers = await seedCustomers(db, masters.orgId);

    process.stdout.write("Seed: transactions (projects, rooms, measurements, quotes, orders)...\n");
    await seedTransactions(db, {
      orgId: masters.orgId,
      branchId: masters.branchId,
      userByRole: masters.userByRole,
      employeeIds: masters.employeeIds,
      vendorIds: masters.vendorIds,
      colourwayIds: catalog.colourwayIds,
      colourwayMeta: catalog.colourwayMeta,
      sampleBookIds: catalog.sampleBookIds,
      clientIds: customers.clientIds,
      architectIds: customers.architectIds,
    });

    const downstreamInput = {
      orgId: masters.orgId,
      branchId: masters.branchId,
      userByRole: masters.userByRole,
      employeeIds: masters.employeeIds,
      vendorIds: masters.vendorIds,
      colourwayIds: catalog.colourwayIds,
      colourwayMeta: catalog.colourwayMeta,
      sampleBookIds: catalog.sampleBookIds,
      clientIds: customers.clientIds,
      architectIds: customers.architectIds,
    };

    process.stdout.write("Seed: procurement, dye-lot stock, make, install, money...\n");
    await seedDownstream(db, downstreamInput);

    process.stdout.write("Seed: HR, WhatsApp, overheads, edge cases...\n");
    await seedOps(db, downstreamInput);
  } else {
    process.stdout.write("Seed: SKIPPING demo customers + transactions (SEED_DEMO_DATA not set).\n");
  }

  process.stdout.write("Seed: bumping NumberSequence past inserted rows...\n");
  await bumpNumberSequences(db, masters.orgId);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
  process.stdout.write(`\nSeed completed in ${elapsed}s\n`);
  await printRowCounts(db);
  await db.$disconnect();
}

// The seed inserts rows with hardcoded MDV/{SERIES}-{YYMM}-NNNN numbers
// but never touches NumberSequence. When a real user action later calls
// allocateNumber(), the atomic upsert starts at counter=1 and collides
// with the seeded rows on the unique (organizationId, number) index.
// This post-seed pass scans every series and seeds the counter to the
// max used, so the very next allocation returns the following number.
async function bumpNumberSequences(db: PrismaClient, orgId: string): Promise<void> {
  // Every series in src/modules/**/actions.ts that calls allocateNumber().
  // MUST stay in sync with new modules — a missing entry silently causes
  // "Unique constraint failed on (organizationId, number)" the first
  // time a user creates a record of that type via the UI.
  //
  // `numberField` names the column in the target table that holds the
  // MDV/<SERIES>-YYMM-NNNN string. Most tables use `number`; Client
  // stores it in `code`.
  const cfg: { series: string; table: string; numberField: string; prefix: string }[] = [
    { series: "PRJ",  table: "Project",         numberField: "number", prefix: "MDV" },
    { series: "MEA",  table: "Measurement",     numberField: "number", prefix: "MDV" },
    { series: "QT",   table: "Quotation",       numberField: "number", prefix: "MDV" },
    { series: "SO",   table: "Order",           numberField: "number", prefix: "MDV" },
    { series: "INV",  table: "Invoice",         numberField: "number", prefix: "MDV" },
    { series: "RCT",  table: "Receipt",         numberField: "number", prefix: "MDV" },
    { series: "PO",   table: "PurchaseOrder",   numberField: "number", prefix: "MDV" },
    { series: "GRN",  table: "GRN",             numberField: "number", prefix: "MDV" },
    { series: "MJ",   table: "MakeJob",         numberField: "number", prefix: "MDV" },
    { series: "ENQ",  table: "Lead",            numberField: "number", prefix: "MDV" },
    { series: "CLI",  table: "Client",          numberField: "code",   prefix: "MDV" },
    { series: "SV",   table: "SiteVisit",       numberField: "number", prefix: "MDV" },
    { series: "REQ",  table: "PurchaseRequest", numberField: "number", prefix: "MDV" },
    { series: "TASK", table: "Task",            numberField: "number", prefix: "MDV" },
  ];
  for (const c of cfg) {
    const rows = await db.$queryRawUnsafe<{ yymm: string; max: number }[]>(`
      SELECT SPLIT_PART("${c.numberField}", '-', 2) AS yymm,
             MAX(CAST(SPLIT_PART("${c.numberField}", '-', 3) AS INT)) AS max
      FROM "${c.table}"
      WHERE "organizationId" = $1
        AND "${c.numberField}" ~ '^${c.prefix}/${c.series}-[0-9]+-[0-9]+$'
      GROUP BY 1
    `, orgId);
    for (const r of rows) {
      await db.numberSequence.upsert({
        where:  { organizationId_series_yymm: { organizationId: orgId, series: c.series, yymm: r.yymm } },
        update: { counter: r.max },
        create: { organizationId: orgId, series: c.series, yymm: r.yymm, counter: r.max },
      });
    }
  }
}

// Wipe all tables. Bypasses append-only triggers for TRUNCATE.
//
// main() calls this unconditionally, so it is the last thing standing
// between `tsx prisma/seed.ts` and an empty studio. The old guard asked
// whether NEXT_PUBLIC_APP_URL contained "mandovara.com" — the marketing
// site, not the app, which runs on mandovara.sbs — so it never fired
// where it mattered. See scripts/lib/db-target.mjs.
//
// An EMPTY remote database is still allowed through: that is a fresh
// deployment seeding itself on first boot, and there is nothing there to
// lose. A remote database with organizations in it is refused unless a
// human set CONFIRM_WIPE=I_UNDERSTAND.
async function wipe(db: PrismaClient): Promise<void> {
  await assertWipeAllowed(() => db.organization.count(), "wipe()");
  await db.$executeRawUnsafe(`
    DO $$
    DECLARE r record;
    BEGIN
      ALTER TABLE "AuditLog"  DISABLE TRIGGER USER;
      ALTER TABLE "StockMove" DISABLE TRIGGER USER;
      FOR r IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename NOT LIKE '\\_%%' ESCAPE '\\'
          AND tablename <> '_prisma_migrations'
      LOOP
        EXECUTE format('TRUNCATE TABLE %I RESTART IDENTITY CASCADE;', r.tablename);
      END LOOP;
      ALTER TABLE "AuditLog"  ENABLE TRIGGER USER;
      ALTER TABLE "StockMove" ENABLE TRIGGER USER;
    END $$;
  `);
}

main().catch((err: unknown) => {
  process.stderr.write(`Seed FAILED: ${String(err)}\n`);
  process.exit(1);
});

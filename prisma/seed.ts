// Mandovara Interior OS — seed entrypoint.
// Target: completes under 60 seconds on a Supabase ap-south-1 instance.
// Run with: pnpm prisma db seed
import { PrismaClient } from "@prisma/client";
import { seedCatalog } from "./seed/catalog";
import { seedCustomers } from "./seed/customers";
import { seedMasters } from "./seed/masters";
import { printRowCounts } from "./seed/report";
import { seedTransactions } from "./seed/transactions";

async function main(): Promise<void> {
  const db = new PrismaClient({ log: [] });
  const t0 = Date.now();

  process.stdout.write("Seed: wiping existing data...\n");
  await wipe(db);

  process.stdout.write("Seed: masters (org, branch, users, employees, vendors, statutory)...\n");
  const masters = await seedMasters(db);

  process.stdout.write("Seed: catalog (brands → collections → designs → colourways)...\n");
  const catalog = await seedCatalog(db, masters.orgId);

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
  const cfg: { series: string; table: string; prefix: string }[] = [
    { series: "PRJ", table: "Project",     prefix: "MDV" },
    { series: "MEA", table: "Measurement", prefix: "MDV" },
    { series: "QT",  table: "Quotation",   prefix: "MDV" },
    { series: "SO",  table: "Order",       prefix: "MDV" },
    { series: "INV", table: "Invoice",     prefix: "MDV" },
    { series: "RCT", table: "Receipt",     prefix: "MDV" },
    { series: "PO",  table: "PurchaseOrder", prefix: "MDV" },
    { series: "GRN", table: "GRN",         prefix: "MDV" },
    { series: "INS", table: "InstallVisit", prefix: "MDV" },
    { series: "MJ",  table: "MakeJob",     prefix: "MDV" },
  ];
  for (const c of cfg) {
    const rows = await db.$queryRawUnsafe<{ yymm: string; max: number }[]>(`
      SELECT SPLIT_PART(number, '-', 2) AS yymm,
             MAX(CAST(SPLIT_PART(number, '-', 3) AS INT)) AS max
      FROM "${c.table}"
      WHERE "organizationId" = $1
        AND number ~ '^${c.prefix}/${c.series}-[0-9]+-[0-9]+$'
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

// Wipe all tables — dev only. Bypasses append-only triggers for TRUNCATE.
// Never call in production: throws if NEXT_PUBLIC_APP_URL contains "mandovara.com".
async function wipe(db: PrismaClient): Promise<void> {
  if (process.env["NEXT_PUBLIC_APP_URL"]?.includes("mandovara.com")) {
    throw new Error("wipe() refused: production URL detected");
  }
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

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

  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
  process.stdout.write(`\nSeed completed in ${elapsed}s\n`);
  await printRowCounts(db);
  await db.$disconnect();
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

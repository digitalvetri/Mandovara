// Session 3 seed entrypoint. Full dataset per docs/BUILD-SPEC.md §15.
// Target: complete in under 60 seconds.
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

  process.stdout.write("Seed: masters (org, branches, users, warehouses, vendors, employees, statutory)...\n");
  const ids = await seedMasters(db);

  process.stdout.write("Seed: catalog (1,200 SKUs across 8 categories)...\n");
  const cat = await seedCatalog(db, ids.orgId);

  process.stdout.write("Seed: customers (800 clients across TN/KL/KA)...\n");
  const cust = await seedCustomers(db, ids.orgId);

  // Build product meta map used by transactions
  const prices = await db.productPrice.findMany({ select: { productId: true, tier: true, amount: true } });
  const productMeta = new Map<string, { gstRate: number; costPaise: bigint; mrpPaise: bigint }>();
  const products = await db.product.findMany({ where: { orgId: ids.orgId }, select: { id: true, gstRate: true } });
  for (const p of products) {
    const cost = prices.find((x) => x.productId === p.id && x.tier === "COST")?.amount ?? 100_00n;
    const mrp  = prices.find((x) => x.productId === p.id && x.tier === "MRP")?.amount  ?? 150_00n;
    productMeta.set(p.id, { gstRate: Number(p.gstRate), costPaise: cost, mrpPaise: mrp });
  }

  process.stdout.write("Seed: transactions (12 months history + edge cases)...\n");
  await seedTransactions(db, {
    ids,
    clients: cust.clients,
    productIds: cat.productIds,
    productMeta,
  });

  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
  process.stdout.write(`\nSeed completed in ${elapsed}s\n`);
  await printRowCounts(db);
  await db.$disconnect();
}

// Wipe (dev-only). Truncates the tables the seed populates so re-runs are clean.
// Uses raw SQL via TRUNCATE ... CASCADE — the only place in the codebase that
// bypasses the append-only rule on StockLedgerEntry/AuditLog, allowed here
// because these are seeded fixtures.
async function wipe(db: PrismaClient): Promise<void> {
  await db.$executeRawUnsafe(`
    DO $$
    DECLARE
      r record;
    BEGIN
      -- disable the immutability triggers just for TRUNCATE
      ALTER TABLE "AuditLog"         DISABLE TRIGGER USER;
      ALTER TABLE "StockLedgerEntry" DISABLE TRIGGER USER;
      FOR r IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename NOT LIKE '\\_%%' ESCAPE '\\'
          AND tablename <> '_prisma_migrations'
      LOOP
        EXECUTE format('TRUNCATE TABLE %I RESTART IDENTITY CASCADE;', r.tablename);
      END LOOP;
      ALTER TABLE "AuditLog"         ENABLE TRIGGER USER;
      ALTER TABLE "StockLedgerEntry" ENABLE TRIGGER USER;
    END $$;
  `);
}

main().catch((err: unknown) => {
  process.stderr.write(`Seed FAILED: ${String(err)}\n`);
  process.exit(1);
});

#!/usr/bin/env node
// One-shot cleanup: remove any FAILED (unfinished) _prisma_migrations rows
// that would block `prisma migrate deploy` from retrying them.
//
// WHY: when a migration is attempted but its SQL fails (e.g. CREATE UNIQUE
// INDEX failing on duplicate data), Prisma writes a row to _prisma_migrations
// with finished_at = NULL. On the next deploy, if the migration FILE was
// subsequently edited to fix the SQL, `migrate deploy` sees a checksum
// mismatch against the failed record and refuses to rerun, leaving the
// container stuck in a crash loop.
//
// This script deletes such rows BEFORE `migrate deploy` runs so the fixed
// SQL can be applied cleanly. It is a strict no-op when:
//   • the migration was never attempted (no row) — delete 0 rows
//   • the migration was successfully applied (finished_at IS NOT NULL) — WHERE
//     clause excludes it; the applied row is preserved
//
// Safe to run on every boot: `prisma migrate deploy` is idempotent once the
// row is clean and the fixed migration applies successfully.

import { PrismaClient } from "@prisma/client";

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.log("→ pre-migrate: DATABASE_URL not set, skipping");
  process.exit(0);
}

const db = new PrismaClient({ datasourceUrl: url });

try {
  // List the migration names that were edited after a failed run on production.
  // Only remove rows where finished_at IS NULL (migration did not succeed).
  // Add new entries here whenever you fix a migration file that was already
  // attempted on production in its broken form.
  const fixedMigrations = [
    "20260822120000_invoice_order_active_unique",
  ];

  for (const name of fixedMigrations) {
    const result = await db.$executeRawUnsafe(
      `DELETE FROM "_prisma_migrations"
       WHERE migration_name = $1
         AND finished_at IS NULL`,
      name,
    );
    if (result > 0) {
      console.log(`→ pre-migrate: removed failed migration record "${name}" (will be reapplied)`);
    }
  }
  console.log("→ pre-migrate: done");
} catch (err) {
  // Non-fatal: if we can't connect or the table doesn't exist yet, just log
  // and let `prisma migrate deploy` handle it (it will create the table on
  // a fresh database, or fail meaningfully if the DB is truly unreachable).
  console.log("→ pre-migrate: skipped —", err.message);
} finally {
  await db.$disconnect();
}

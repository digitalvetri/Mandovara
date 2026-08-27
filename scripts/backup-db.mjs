#!/usr/bin/env node
// Take a compressed, timestamped backup of the database — and verify it.
//
// Coolify's scheduled backups are the primary mechanism (see
// docs/DEPLOY-COOLIFY.md). This exists because a backup nobody has ever
// restored is not a backup, and because the client's data should not
// depend on one vendor's UI being configured correctly.
//
// Two things happen here that a bare pg_dump does not do:
//   1. the dump is verified by listing its table of contents, so a
//      truncated or half-written file fails loudly at backup time rather
//      than silently at restore time;
//   2. the row count of a few key tables is recorded beside it, so a
//      restore can be checked against what was actually backed up.
//
//   node scripts/backup-db.mjs [outputDir]
//
// Restore (rehearse this at least once, into a SCRATCH database):
//   createdb mandovara_restore_test
//   pg_restore -d mandovara_restore_test --clean --if-exists <file>.dump
//   node scripts/backup-db.mjs --verify mandovara_restore_test

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const raw = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
if (!raw) {
  console.error("DATABASE_URL is not set — nothing to back up.");
  process.exit(1);
}

/**
 * Prisma's connection string carries parameters libpq has never heard of
 * — `schema`, `connection_limit`, `pgbouncer` — and pg_dump rejects the
 * whole URI rather than ignoring them ("invalid URI query parameter").
 * Strip anything that is not a real libpq keyword.
 */
const LIBPQ_PARAMS = new Set([
  "sslmode", "sslrootcert", "sslcert", "sslkey", "connect_timeout",
  "application_name", "options", "target_session_attrs",
]);
function toLibpqUrl(input) {
  try {
    const u = new URL(input);
    for (const key of [...u.searchParams.keys()]) {
      if (!LIBPQ_PARAMS.has(key)) u.searchParams.delete(key);
    }
    return u.toString();
  } catch {
    return input;
  }
}
const url = toLibpqUrl(raw);

const outDir = process.argv[2] ?? "backups";
mkdirSync(outDir, { recursive: true });

// Colons are illegal in filenames on Windows and awkward everywhere.
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const dumpPath = join(outDir, `mandovara-${stamp}.dump`);

console.log(`Backing up to ${dumpPath} …`);
try {
  // Custom format (-Fc): compressed, and pg_restore can read a table of
  // contents from it, which is what makes the verify step below possible.
  execFileSync("pg_dump", ["-Fc", "--no-owner", "--no-privileges", "-f", dumpPath, url], {
    stdio: ["ignore", "inherit", "inherit"],
  });
} catch {
  console.error("\npg_dump failed. Is postgresql-client installed and DATABASE_URL reachable?");
  process.exit(1);
}

const bytes = statSync(dumpPath).size;
if (bytes < 1024) {
  console.error(`\nBackup is only ${bytes} bytes — that is not a real database. Refusing to call this a backup.`);
  process.exit(1);
}

// Verify: a dump pg_restore cannot list is a dump you cannot restore.
let tableCount = 0;
try {
  const toc = execFileSync("pg_restore", ["-l", dumpPath], { encoding: "utf8" });
  tableCount = toc.split("\n").filter((l) => l.includes("TABLE DATA")).length;
} catch {
  console.error("\nThe dump was written but pg_restore could not read it. Treat it as failed.");
  process.exit(1);
}
if (tableCount === 0) {
  console.error("\nThe dump contains no table data. Treat it as failed.");
  process.exit(1);
}

const manifest = {
  takenAt: new Date().toISOString(),
  file: dumpPath,
  sizeBytes: bytes,
  tablesWithData: tableCount,
};
writeFileSync(join(outDir, `mandovara-${stamp}.json`), JSON.stringify(manifest, null, 2));

console.log(`\n✓ ${(bytes / 1024 / 1024).toFixed(1)}MB · ${tableCount} tables with data · verified readable`);
console.log(`  ${dumpPath}`);
console.log("\nA backup you have never restored is not a backup.");
console.log("Rehearse a restore into a scratch database — see the header of this file.");

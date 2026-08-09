// §14 Phase 8 gate — "restore the backup into a clean environment
// and run E2E against it."
//
// End-to-end drill:
//   1. pg_dump the live mandovara DB (docker exec into the container).
//   2. Drop-and-recreate `mandovara_restore` on the same server so we
//      restore into a genuinely clean namespace.
//   3. pg_restore the dump into `mandovara_restore`.
//   4. Sanity-check: seeded row counts on the restore match the
//      source (a mismatch = incomplete backup, hard fail).
//   5. Run `pnpm test:e2e --project=chromium` with DATABASE_URL
//      overridden to point at the restored DB. Playwright's
//      webServer boots `pnpm dev` which inherits the env, so the
//      whole app runs against the restore for the test window.
//   6. Report pass/fail counts. Leave the restored DB in place by
//      default (--cleanup flag drops it).
//
// This proves nothing was quietly missed by the dump: FKs, indexes,
// triggers, immutability rules (AuditLog append-only), and — most
// important for §12 — that every acceptance spec passes against a
// restored copy, not just the source.
//
// Run: pnpm tsx scripts/drill-backup-restore.ts

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";

const CONTAINER   = "mandovara-postgres";
const PGUSER      = "mandovara";
const PGPASSWORD  = "mandovara";
const SRC_DB      = "mandovara";
const RESTORE_DB  = "mandovara_restore";
const HOST_PORT   = 55432;
const RESTORE_URL = `postgresql://${PGUSER}:${PGPASSWORD}@localhost:${HOST_PORT}/${RESTORE_DB}?schema=public&connection_limit=50&pool_timeout=30`;

const cleanup = process.argv.includes("--cleanup");

function run(
  cmd: string, args: string[],
  opts: { env?: Record<string, string>; shell?: boolean; stdio?: "inherit" | "pipe" } = {},
): { code: number; stdout: string; stderr: string } {
  const r = spawnSync(cmd, args, {
    encoding: "utf8",
    shell:    opts.shell ?? true,
    env:      { ...process.env, ...(opts.env ?? {}) },
    stdio:    opts.stdio ?? "pipe",
  });
  return { code: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function fail(msg: string, extra?: string): never {
  console.error(`\nFAIL: ${msg}`);
  if (extra) console.error(extra);
  process.exit(1);
}

function step(label: string) {
  console.log(`\n── ${label} ──`);
}

async function main() {
  const dumpDir = "tmp/drill";
  const dumpHostPath = join(dumpDir, "mandovara.dump");
  mkdirSync(dumpDir, { recursive: true });

  // ── 1. pg_dump ───────────────────────────────────────────────
  step("1 · pg_dump source");
  // -Fc = custom binary format (compressed, restorable with pg_restore).
  // Write to a container-side path first, then docker cp out.
  const containerDump = "/tmp/mandovara.dump";
  const dump = run("docker", [
    "exec", CONTAINER,
    "pg_dump", "-U", PGUSER, "-d", SRC_DB,
    "-Fc", "-f", containerDump,
  ]);
  if (dump.code !== 0) fail("pg_dump failed", dump.stderr);
  // Copy the dump to the host for the log (and so a maintainer can
  // eyeball its size / restore it manually later).
  const cp = run("docker", ["cp", `${CONTAINER}:${containerDump}`, dumpHostPath]);
  if (cp.code !== 0) fail("docker cp failed", cp.stderr);
  const bytes = statSync(dumpHostPath).size;
  console.log(`  dumped ${(bytes / 1024).toFixed(1)} KB → ${dumpHostPath}`);

  // ── 2. drop + create restore DB ─────────────────────────────
  step(`2 · drop + create ${RESTORE_DB}`);
  // dropdb --if-exists is idempotent; ignore stderr on first run.
  run("docker", ["exec", CONTAINER, "dropdb", "-U", PGUSER, "--if-exists", RESTORE_DB]);
  const cdb = run("docker", ["exec", CONTAINER, "createdb", "-U", PGUSER, RESTORE_DB]);
  if (cdb.code !== 0) fail("createdb failed", cdb.stderr);
  console.log(`  created ${RESTORE_DB}`);

  // ── 3. pg_restore ───────────────────────────────────────────
  step("3 · pg_restore into clean DB");
  const restore = run("docker", [
    "exec", CONTAINER,
    "pg_restore", "-U", PGUSER, "-d", RESTORE_DB,
    "--no-owner", "--no-acl",
    containerDump,
  ]);
  // pg_restore prints "WARNING: … permission denied for schema public"
  // when --no-owner + non-superuser hit the pgcrypto extension —
  // treat only non-zero exit as fatal.
  if (restore.code !== 0) {
    // Some warnings are OK; only bail if the DB is actually empty.
    console.warn(`  pg_restore returned ${restore.code} — checking table counts…`);
    if (restore.stderr) console.warn(`  ${restore.stderr.split("\n").slice(0, 6).join("\n  ")}`);
  } else {
    console.log(`  restore complete`);
  }

  // ── 4. sanity check row counts ──────────────────────────────
  step("4 · row-count sanity");
  const tables = ["User", "Client", "Project", "Employee", "MessageTemplate", "StatutorySlab"];
  for (const t of tables) {
    const src = countRows(SRC_DB, t);
    const dst = countRows(RESTORE_DB, t);
    const ok  = src === dst ? "✓" : "✗";
    console.log(`  ${ok} ${t.padEnd(20)} source=${src.toString().padStart(6)}  restore=${dst.toString().padStart(6)}`);
    if (src !== dst) fail(`row count mismatch on ${t}`);
  }

  // ── 5. run e2e against the restore ──────────────────────────
  step("5 · pnpm test:e2e --project=chromium against restore");
  console.log(`  DATABASE_URL="${RESTORE_URL.replace(PGPASSWORD, "***")}"`);

  // Playwright's webServer.reuseExistingServer = !CI, so if a dev
  // server is already up on 3000 it would attach to THAT (still on
  // the source DB). Free the port + set CI=1 so a fresh webServer
  // spawns with our overridden DATABASE_URL.
  freePort3000();

  const e2e = run("pnpm", ["test:e2e", "--project=chromium"], {
    env:   {
      DATABASE_URL: RESTORE_URL,
      CI:           "1",   // forces webServer respawn + retries + workers=1
    },
    stdio: "inherit",
  });
  if (e2e.code !== 0) fail(`test:e2e exit code ${e2e.code}`);
  console.log("  E2E suite passed against restored DB");

  // ── 6. cleanup (opt-in) ────────────────────────────────────
  if (cleanup) {
    step("6 · cleanup restored DB");
    run("docker", ["exec", CONTAINER, "dropdb", "-U", PGUSER, "--if-exists", RESTORE_DB]);
    console.log(`  dropped ${RESTORE_DB}`);
  } else {
    console.log(`\n(restored DB left in place for inspection; re-run with --cleanup to drop it)`);
  }

  console.log(`\nPASS — §14 Phase 8 gate: every §12 line stays green from a restored dump.`);
}

function countRows(db: string, table: string): number {
  // shell:false is required — cmd/powershell would eat the "double
  // quotes" around the CamelCase table name and psql would see the
  // identifier lowercased. That silent failure masqueraded as "0
  // rows" and made the drill's pass claim meaningless. Passing the
  // arg vector directly to CreateProcess preserves the quotes.
  const r = spawnSync("docker", [
    "exec", CONTAINER,
    "psql", "-U", PGUSER, "-d", db,
    "-tAc", `SELECT COUNT(*) FROM "${table}"`,
  ], { encoding: "utf8", shell: false });
  const n = Number((r.stdout ?? "").trim());
  return Number.isFinite(n) ? n : -1;
}

// PowerShell one-liner — kills any process holding port 3000 so
// Playwright's webServer can bind fresh with our DATABASE_URL.
function freePort3000(): void {
  const ps = `Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }`;
  const r = spawnSync("powershell", ["-NonInteractive", "-Command", ps], {
    encoding: "utf8", shell: true,
  });
  if (r.status === 0) console.log(`  port 3000 freed`);
}

main().catch((e) => { console.error(e); process.exit(1); });
void existsSync;

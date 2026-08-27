#!/usr/bin/env node
// Is this deployment actually ready to carry a real business?
//
// Written because "production ready" was being answered from memory. Each
// check below is something that has either bitten this project or would
// be discovered by the client rather than by us.
//
//   node scripts/preflight.mjs
//
// Exit code 1 if anything CRITICAL fails, so it can gate a deploy.
// Warnings never fail the run — they are judgement calls, not defects.

import { execFileSync } from "node:child_process";

const critical = [];
const warnings = [];
const passes   = [];

const ok    = (m) => passes.push(m);
const warn  = (m, why) => warnings.push({ m, why });
const fail  = (m, why) => critical.push({ m, why });

const env = process.env;
const isProd = env.NODE_ENV === "production";

// ── Secrets and identity ─────────────────────────────────────────────
if (!env.DATABASE_URL) fail("DATABASE_URL is not set", "The app cannot start.");
else ok("DATABASE_URL is set");

if (!env.SESSION_SECRET) {
  fail("SESSION_SECRET is not set", "Sessions cannot be signed; every login fails.");
} else if (env.SESSION_SECRET.length < 32) {
  fail("SESSION_SECRET is shorter than 32 characters", "Rejected at startup by lib/session.ts.");
} else ok("SESSION_SECRET is set and long enough");

if (!env.APP_DATABASE_URL) {
  warn("APP_DATABASE_URL is not set",
       "The app connects as the owner role, which BYPASSES row-level security. Tenant isolation is not enforced.");
} else ok("APP_DATABASE_URL is set — the app runs under row-level security");

// ── Operations ───────────────────────────────────────────────────────
if (!env.SENTRY_DSN) {
  warn("SENTRY_DSN is not set",
       "Sentry is wired but dark. The first report of a production failure will be a phone call.");
} else ok("Error monitoring is configured");

if (isProd && env.COOKIE_SECURE === "false") {
  warn("COOKIE_SECURE is false in production",
       "Session cookies will be sent over plain HTTP. Only correct on a trusted LAN.");
}

// ── The database itself ──────────────────────────────────────────────
function psql(sql) {
  const raw = env.DATABASE_URL ?? "";
  let url = raw;
  try {
    const u = new URL(raw);
    for (const k of [...u.searchParams.keys()]) {
      if (!["sslmode", "connect_timeout", "application_name"].includes(k)) u.searchParams.delete(k);
    }
    url = u.toString();
  } catch { /* leave as-is; psql will report it */ }
  return execFileSync("psql", [url, "-tAc", sql], { encoding: "utf8" }).trim();
}

try {
  const pending = psql(
    `SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL`,
  );
  if (Number(pending) > 0) fail(`${pending} migration(s) unapplied or rolled back`, "Run: pnpm prisma migrate deploy");
  else ok("All migrations applied cleanly");

  // The gap that makes a beautiful dashboard read as broken software.
  const clients  = Number(psql(`SELECT count(*) FROM "Client"`));
  const projects = Number(psql(`SELECT count(*) FROM "Project"`));
  if (clients === 0 && projects === 0) {
    fail("The database has no clients and no projects",
         "A dashboard showing zero reads as broken software. Import the client's books at /clients/import before handover.");
  } else {
    ok(`Real data present — ${clients.toLocaleString("en-IN")} clients, ${projects.toLocaleString("en-IN")} projects`);
  }

  // Every login needs a staff record, or they cannot check in or be paid.
  const orphanUsers = Number(psql(
    `SELECT count(*) FROM "User" u WHERE u.status = 'ACTIVE'
       AND NOT EXISTS (SELECT 1 FROM "Employee" e WHERE e."userId" = u.id)`,
  ));
  if (orphanUsers > 0) {
    warn(`${orphanUsers} active user(s) have no staff record`,
         "They cannot check in or appear in payroll. Fix: Admin → People & history → Link staff records.");
  } else ok("Every active user has a staff record");

  // A geofence is what makes attendance mean anything.
  const fenced = Number(psql(
    `SELECT count(*) FROM "Branch" WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND "attendanceRadiusM" IS NOT NULL`,
  ));
  if (fenced === 0) {
    warn("No branch has an attendance geofence configured",
         "Every check-in will be recorded as off-site. Set it in Admin → Branch geofence.");
  } else ok(`${fenced} branch(es) have an attendance geofence`);

  const orgs = Number(psql(`SELECT count(*) FROM "Organization"`));
  if (orgs === 0) fail("No organisation exists", "Run the seed, or bootstrap via /api/admin/bootstrap.");
  else ok("Organisation is configured");
} catch (e) {
  fail("Could not query the database", String(e?.message ?? e).split("\n")[0]);
}

// ── Backups ──────────────────────────────────────────────────────────
warn("Backups are not verifiable from here",
     "Confirm Coolify's scheduled backup is enabled AND that you have restored one into a scratch database. See docs/DEPLOY-COOLIFY.md and scripts/backup-db.mjs.");

// ── Report ───────────────────────────────────────────────────────────
const line = "─".repeat(66);
console.log(`\n${line}\n  MANDOVARA — PRODUCTION PREFLIGHT\n${line}\n`);
for (const p of passes) console.log(`  ✓  ${p}`);
if (warnings.length) {
  console.log("\n  WARNINGS — will not stop a deploy, but someone should decide\n");
  for (const w of warnings) console.log(`  !  ${w.m}\n     ${w.why}\n`);
}
if (critical.length) {
  console.log("\n  CRITICAL — do not hand this over\n");
  for (const c of critical) console.log(`  ✗  ${c.m}\n     ${c.why}\n`);
}
console.log(line);
console.log(`  ${passes.length} passed · ${warnings.length} warning(s) · ${critical.length} critical`);
console.log(`${line}\n`);

process.exit(critical.length > 0 ? 1 : 0);

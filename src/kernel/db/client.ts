// Prisma singleton. The ONE place that instantiates PrismaClient.
// Everything else in the codebase reaches the DB through db.scoped(ctx),
// which extends this singleton with tenant + branch scoping + audit.

import { PrismaClient } from "@prisma/client";
// Side-effect import: registers every domain-event listener (milestone
// auto-completion, etc.) on first module load. Every request path hits
// this file, so listeners are guaranteed to be wired before any query.
import "@/kernel/events/register";

declare global {

  var __prisma__: PrismaClient | undefined;
  var __authPrisma__: PrismaClient | undefined;
}

// §3.2 — the request path connects as APP_DATABASE_URL when it is set: a
// restricted role that is NOT superuser and does NOT have BYPASSRLS, so the
// Row-Level Security policies actually apply. Migrations, the seed and the
// test harness keep using DATABASE_URL (the owner), which legitimately needs
// to reach across tenants.
//
// Without this split the RLS migration is decorative: Postgres silently skips
// row security for superusers, and the default docker-compose owner is one.
const runtimeDatasourceUrl =
  process.env["APP_DATABASE_URL"] || process.env["DATABASE_URL"];

/** Reuse the same client across HMR reloads in development. */
export const prisma: PrismaClient =
  globalThis.__prisma__ ??
  new PrismaClient({
    log: ["error", "warn"],
    ...(runtimeDatasourceUrl ? { datasourceUrl: runtimeDatasourceUrl } : {}),
  });

if (process.env["NODE_ENV"] !== "production") {
  globalThis.__prisma__ = prisma;
}

export type {
  AppRole, InstallStatus, MakeJobStatus, HeadingType, RequestStatus,
} from "@prisma/client";

// ── Auth bootstrap ──────────────────────────────────────────────────────────
// Chicken-and-egg: RLS needs a tenant, but the tenant is only knowable once
// the user has been found. Resolving a login credential or a session cookie to
// a User row therefore has to happen outside row security.
//
// This client connects with the OWNER credentials (DATABASE_URL) and is
// exempt from RLS. It is deliberately the only such client in the request
// path, and it must be used ONLY to look a user up by id / email / mobile.
// Everything downstream of that lookup goes through scoped(ctx) or orgPrisma().
//
// If you are reaching for this for anything other than authentication, you
// want orgPrisma(ctx.orgId) instead.
export const authBootstrapPrisma: PrismaClient =
  globalThis.__authPrisma__ ??
  new PrismaClient({
    log: ["error", "warn"],
    ...(process.env["DATABASE_URL"] ? { datasourceUrl: process.env["DATABASE_URL"] } : {}),
  });

if (process.env["NODE_ENV"] !== "production") {
  globalThis.__authPrisma__ = authBootstrapPrisma;
}

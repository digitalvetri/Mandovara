#!/usr/bin/env node
// §3.2 — create the restricted role the application runs as.
//
// WHY THIS EXISTS: enabling RLS is not enough. Postgres always bypasses row
// security for superusers and for roles with BYPASSRLS, and the default
// docker-compose / Supabase owner is exactly that. Connecting the app as the
// owner makes every policy decorative. This script creates a role that is
// neither superuser nor BYPASSRLS, so the policies actually bite.
//
// Roles are cluster-scoped, not schema objects, so this is deliberately NOT a
// Prisma migration — migration history should describe the schema only.
//
// Idempotent: safe to run on every deploy. Run it AFTER `prisma migrate deploy`
// so that newly created tables get grants.
//
//   DIRECT_URL=postgresql://owner:...  APP_DB_PASSWORD=...  node scripts/setup-app-role.mjs

import { PrismaClient } from "@prisma/client";

const OWNER_URL   = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const APP_ROLE    = process.env.APP_DB_ROLE     ?? "mandovara_app";
const APP_PASSWORD = process.env.APP_DB_PASSWORD;

if (!OWNER_URL) {
  console.error("DIRECT_URL (or DATABASE_URL) must be set to an owner/superuser connection.");
  process.exit(1);
}
if (!APP_PASSWORD) {
  console.error(
    "APP_DB_PASSWORD must be set — it is the password for the restricted app role.\n" +
    "  Generate one: openssl rand -hex 24",
  );
  process.exit(1);
}
if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(APP_ROLE)) {
  console.error(`APP_DB_ROLE "${APP_ROLE}" is not a plain SQL identifier.`);
  process.exit(1);
}

const db = new PrismaClient({ datasourceUrl: OWNER_URL });

// Passwords cannot be bound as parameters inside CREATE/ALTER ROLE, so quote
// it as a literal. APP_ROLE is identifier-validated above.
const pwLiteral = `'${APP_PASSWORD.replace(/'/g, "''")}'`;

try {
  await db.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${APP_ROLE}') THEN
        CREATE ROLE ${APP_ROLE} LOGIN PASSWORD ${pwLiteral};
      ELSE
        ALTER ROLE ${APP_ROLE} LOGIN PASSWORD ${pwLiteral};
      END IF;
    END $$;
  `);

  // Belt and braces: strip anything that would defeat row security.
  await db.$executeRawUnsafe(`ALTER ROLE ${APP_ROLE} NOSUPERUSER NOBYPASSRLS`);

  const dbName = (OWNER_URL.split("/").pop() ?? "").split("?")[0];
  if (dbName) {
    await db.$executeRawUnsafe(`GRANT CONNECT ON DATABASE "${dbName}" TO ${APP_ROLE}`);
  }
  await db.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${APP_ROLE}`);
  await db.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_ROLE}`);
  await db.$executeRawUnsafe(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${APP_ROLE}`);
  await db.$executeRawUnsafe(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${APP_ROLE}`);

  // Future tables created by later migrations inherit the same grants.
  await db.$executeRawUnsafe(`
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${APP_ROLE}
  `);
  await db.$executeRawUnsafe(`
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO ${APP_ROLE}
  `);

  const [{ rolsuper, rolbypassrls }] = await db.$queryRawUnsafe(
    `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = '${APP_ROLE}'`,
  );
  if (rolsuper || rolbypassrls) {
    console.error(`FATAL: ${APP_ROLE} can still bypass RLS (super=${rolsuper} bypass=${rolbypassrls}).`);
    process.exit(1);
  }

  console.log(`Role ${APP_ROLE} ready — NOSUPERUSER, NOBYPASSRLS, granted on public.`);
  console.log(`Point APP_DATABASE_URL at it so the app runs under row security.`);
} finally {
  await db.$disconnect();
}

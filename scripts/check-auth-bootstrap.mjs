#!/usr/bin/env node
// Boot guard: can the auth bootstrap actually read the User table?
//
// §3.2 puts FORCE ROW LEVEL SECURITY on every org-owned table, including User.
// Resolving a login credential to a User row has to happen BEFORE the tenant is
// known, so authBootstrapPrisma (DATABASE_URL) deliberately sets no
// app.current_org_id. That only works because the owner role bypasses RLS —
// which is true for a superuser, and NOT true for a plain table owner.
//
// If DATABASE_URL's role can neither bypass RLS nor is superuser, every login
// silently returns "Invalid email/mobile or password" and NOBODY can get in.
// That is a total lockout with no error in the logs, so we refuse to boot and
// say exactly how to fix it.

import { PrismaClient } from "@prisma/client";

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("✗ DATABASE_URL is not set.");
  process.exit(1);
}

const db = new PrismaClient({ datasourceUrl: url });
try {
  const [role] = await db.$queryRawUnsafe(
    `SELECT current_user AS name, rolsuper, rolbypassrls
       FROM pg_roles WHERE rolname = current_user`,
  );
  const [userTable] = await db.$queryRawUnsafe(
    `SELECT coalesce(bool_or(relforcerowsecurity), false) AS forced
       FROM pg_class WHERE relname = 'User'`,
  );

  const canBypass = role?.rolsuper || role?.rolbypassrls;

  if (userTable?.forced && !canBypass) {
    console.error(
      `✗ FATAL: auth would be impossible.\n` +
      `  DATABASE_URL connects as "${role?.name}", which is neither SUPERUSER nor\n` +
      `  BYPASSRLS, and the User table has FORCE ROW LEVEL SECURITY.\n` +
      `  The login lookup runs before any tenant is known, so it would read zero\n` +
      `  rows and every sign-in would fail with "Invalid email/mobile or password".\n\n` +
      `  Fix ONE of these:\n` +
      `    a) point DATABASE_URL at the database owner/superuser (recommended —\n` +
      `       it is also the role migrations and the seed need), and point\n` +
      `       APP_DATABASE_URL at the restricted mandovara_app role; or\n` +
      `    b) grant bypass to this role:  ALTER ROLE "${role?.name}" BYPASSRLS;\n`,
    );
    process.exit(1);
  }

  if (!process.env.APP_DATABASE_URL) {
    console.warn(
      `⚠  APP_DATABASE_URL is not set — the application will connect as\n` +
      `   "${role?.name}", which bypasses Row-Level Security. §3.2 isolation is\n` +
      `   NOT enforced. See docs/DECISIONS.md.`,
    );
  }

  console.log(`✓ auth bootstrap can read User (role "${role?.name}", bypass=${!!canBypass}).`);
} finally {
  await db.$disconnect();
}

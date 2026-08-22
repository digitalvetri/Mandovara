#!/bin/sh
# Deliberately no `set -e`: a seed failure must not tank the container
# and trigger a restart loop. Migrations DO fail loud (checked explicitly).

PRISMA=/opt/prisma-cli/node_modules/.bin/prisma

echo "→ Regenerating Prisma client..."
cd /app && "$PRISMA" generate --schema=/app/prisma/schema.prisma
if [ $? -ne 0 ]; then
  echo "✗ prisma generate failed — aborting"; exit 1
fi

echo "→ Cleaning up any failed migration records (checksum-safe re-apply)..."
node /app/scripts/pre-migrate.mjs

echo "→ Applying pending migrations..."
"$PRISMA" migrate deploy --schema=/app/prisma/schema.prisma
if [ $? -ne 0 ]; then
  echo "✗ prisma migrate deploy failed — aborting"; exit 1
fi

# §3.2 — the restricted role the app runs under. Must come AFTER migrate
# deploy so newly created tables are covered by the grants. Idempotent.
#
# This DOES fail loud: if APP_DATABASE_URL is configured but the role does not
# exist, the app cannot connect at all. And if we silently skipped it while
# APP_DATABASE_URL was unset, the app would fall back to the owner connection
# and Row-Level Security would be silently unenforced — the worst outcome,
# because everything would appear to work.
if [ -n "${APP_DB_PASSWORD:-}" ]; then
  echo "→ Ensuring restricted app role (RLS)..."
  node /app/scripts/setup-app-role.mjs
  if [ $? -ne 0 ]; then
    echo "✗ setup-app-role failed — aborting (RLS would not be enforced)"; exit 1
  fi
elif [ -n "${APP_DATABASE_URL:-}" ]; then
  echo "✗ APP_DATABASE_URL is set but APP_DB_PASSWORD is not — cannot create or"
  echo "  rotate the restricted role. Set APP_DB_PASSWORD to the same password"
  echo "  used in APP_DATABASE_URL. Aborting."
  exit 1
else
  echo "⚠  APP_DB_PASSWORD / APP_DATABASE_URL unset — the app will connect as the"
  echo "   database OWNER and §3.2 Row-Level Security will NOT be enforced."
  echo "   See docs/DEPLOY-COOLIFY.md before putting real client data in."
fi

# One-shot wipe of demo/transactional data. Set WIPE_DEMO_DATA=true in
# Coolify env, redeploy, wipe runs, then remove the env var to prevent
# re-wipe on next container restart. Non-fatal on error (server should
# still start).
if [ "${WIPE_DEMO_DATA:-false}" = "true" ]; then
  echo "→ WIPE_DEMO_DATA=true — running scripts/wipe-demo-data.mjs"
  node /app/scripts/wipe-demo-data.mjs || echo "→ wipe failed, continuing anyway"
fi

# Boot guard: with FORCE RLS on User, an owner role that cannot bypass RLS makes
# the pre-tenant login lookup return zero rows — every sign-in fails and nobody
# can get in, with nothing in the logs. Refuse to serve rather than lock the
# studio out silently.
echo "→ Verifying auth bootstrap can read User under RLS..."
node /app/scripts/check-auth-bootstrap.mjs
if [ $? -ne 0 ]; then
  echo "✗ auth bootstrap check failed — aborting before serving traffic"; exit 1
fi

echo "→ Checking DB state..."
CHECK=$(node /app/check-empty.mjs 2>&1)
CHECK_EXIT=$?
echo "→ check-empty exit=$CHECK_EXIT output=[$CHECK]"

if [ "$CHECK_EXIT" -eq 0 ] && [ "$CHECK" = "0" ]; then
  echo "→ DB is empty — installing seed-only deps + running seed..."
  cd /app && npm install --no-save --omit=optional --no-audit --no-fund bcryptjs 2>&1 | tail -3
  tsx /app/prisma/seed.ts
  if [ $? -eq 0 ]; then
    echo "✓ Seed complete"
  else
    echo "✗ Seed failed — server will start empty. Investigate then rerun:"
    echo "    cd /app && tsx /app/prisma/seed.ts"
  fi
elif [ "$CHECK_EXIT" -eq 0 ]; then
  echo "→ DB already has $CHECK organization(s) — skipping seed"
else
  echo "→ DB state check failed — skipping seed. To seed manually:"
  echo "    cd /app && tsx /app/prisma/seed.ts"
fi

echo "→ Starting Next server..."
exec node server.js

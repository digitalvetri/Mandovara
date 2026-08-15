#!/bin/sh
# Deliberately no `set -e`: a seed failure must not tank the container
# and trigger a restart loop. Migrations DO fail loud (checked explicitly).

PRISMA=/opt/prisma-cli/node_modules/.bin/prisma

echo "→ Regenerating Prisma client..."
cd /app && "$PRISMA" generate --schema=/app/prisma/schema.prisma
if [ $? -ne 0 ]; then
  echo "✗ prisma generate failed — aborting"; exit 1
fi

echo "→ Applying pending migrations..."
"$PRISMA" migrate deploy --schema=/app/prisma/schema.prisma
if [ $? -ne 0 ]; then
  echo "✗ prisma migrate deploy failed — aborting"; exit 1
fi

# One-shot wipe of demo/transactional data. Set WIPE_DEMO_DATA=true in
# Coolify env, redeploy, wipe runs, then remove the env var to prevent
# re-wipe on next container restart. Non-fatal on error (server should
# still start).
if [ "${WIPE_DEMO_DATA:-false}" = "true" ]; then
  echo "→ WIPE_DEMO_DATA=true — running scripts/wipe-demo-data.mjs"
  node /app/scripts/wipe-demo-data.mjs || echo "→ wipe failed, continuing anyway"
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

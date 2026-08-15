#!/bin/sh
set -e

PRISMA=/opt/prisma-cli/node_modules/.bin/prisma

# Next's tracer misses .prisma/client on pnpm layouts, so any
# require('@prisma/client') crashes with "Cannot find module
# '.prisma/client/default'". Regenerate at container start —
# ~2 seconds, idempotent, guaranteed to sit next to @prisma/client
# wherever pnpm actually put it.
echo "→ Regenerating Prisma client (fills in .prisma/client/*)..."
cd /app && "$PRISMA" generate --schema=/app/prisma/schema.prisma

echo "→ Applying pending migrations..."
"$PRISMA" migrate deploy --schema=/app/prisma/schema.prisma

cd /app

echo "→ Checking DB state..."
set +e
CHECK=$(node /app/check-empty.mjs 2>&1)
CHECK_EXIT=$?
set -e
echo "→ check-empty exit=$CHECK_EXIT output=[$CHECK]"

if [ "$CHECK_EXIT" -eq 0 ] && [ "$CHECK" = "0" ]; then
  echo "→ DB is empty — running one-time seed..."
  tsx /app/prisma/seed.ts
elif [ "$CHECK_EXIT" -eq 0 ]; then
  echo "→ DB already has $CHECK organization(s) — skipping seed"
else
  echo "→ Check failed — skipping seed. To seed manually:"
  echo "    tsx /app/prisma/seed.ts"
fi

echo "→ Starting Next server..."
exec node server.js

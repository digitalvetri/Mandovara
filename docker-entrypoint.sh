#!/bin/sh
set -e

PRISMA=/opt/prisma-cli/node_modules/.bin/prisma

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

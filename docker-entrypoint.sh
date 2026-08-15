#!/bin/sh
set -e

PRISMA=/opt/prisma-cli/node_modules/.bin/prisma

echo "→ Applying pending migrations..."
"$PRISMA" migrate deploy --schema=/app/prisma/schema.prisma

cd /app

echo "→ Checking DB state..."
CHECK=$(node /app/check-empty.mjs 2>&1) || CHECK="CHECK_FAILED"
echo "→ check-empty output: [$CHECK]"

case "$CHECK" in
  "0")
    echo "→ DB is empty — running one-time seed..."
    tsx /app/prisma/seed.ts
    ;;
  ""|*[!0-9]*)
    echo "→ Unable to verify DB state — skipping seed for safety."
    echo "  If this is a fresh deploy, run seed manually via Coolify terminal:"
    echo "    tsx /app/prisma/seed.ts"
    ;;
  *)
    echo "→ DB already has $CHECK organization(s) — skipping seed"
    ;;
esac

echo "→ Starting Next server..."
exec node server.js

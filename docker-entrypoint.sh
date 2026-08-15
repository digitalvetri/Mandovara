#!/bin/sh
set -e

PRISMA=/opt/prisma-cli/node_modules/.bin/prisma

echo "→ Applying pending migrations..."
"$PRISMA" migrate deploy --schema=/app/prisma/schema.prisma

ORG_COUNT=$(node -e "import('@prisma/client').then(async m=>{const p=new m.PrismaClient();try{process.stdout.write(String(await p.organization.count()))}catch(e){process.stdout.write('-1')}finally{await p.\$disconnect()}})" 2>/dev/null || echo "-1")

if [ "$ORG_COUNT" = "0" ]; then
  echo "→ DB is empty — running one-time seed..."
  tsx /app/prisma/seed.ts
elif [ "$ORG_COUNT" = "-1" ]; then
  echo "→ Could not read Organization count — skipping seed (server will start and error if truly broken)"
else
  echo "→ DB already has $ORG_COUNT organization(s) — skipping seed"
fi

echo "→ Starting Next server..."
exec node server.js

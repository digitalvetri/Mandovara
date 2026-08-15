// Post-`git pull` setup: apply migrations, regenerate Prisma client,
// optionally restore data if data-sync/ has files.
//
// Run:  pnpm dev:setup
//
// Idempotent. Safe to re-run after every pull.

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";

function step(label: string, cmd: string): void {
  console.log(`\n▶ ${label}`);
  execSync(cmd, { stdio: "inherit", shell: "/bin/bash" });
}

step("Docker Postgres up (mandovara-postgres)", `docker compose up -d postgres`);

step("Wait for Postgres to accept connections", `until docker exec mandovara-postgres pg_isready -U mandovara >/dev/null 2>&1; do sleep 1; done`);

step("Apply schema migrations", `pnpm prisma migrate deploy`);

step("Regenerate Prisma client", `pnpm prisma generate`);

// Optional data restore
const sqlDump = resolve(process.cwd(), "data-sync", "mandovara-data.sql");
if (existsSync(sqlDump)) {
  console.log(`\n▶ Found data-sync/mandovara-data.sql — restoring`);
  execSync(`pnpm data:pull`, { stdio: "inherit", shell: "/bin/bash" });
} else {
  console.log(`\n· No data-sync/ dump found. Ask a teammate to run \`pnpm data:dump\` and share the folder if you need a populated catalog.`);
}

console.log("\n" + "─".repeat(60));
console.log(`  ✓ Setup complete. Run \`pnpm dev\` to start the app.`);
console.log("─".repeat(60));

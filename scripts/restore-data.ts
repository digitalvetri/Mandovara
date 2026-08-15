// One-command data import — inverse of dump-data.ts.
//
// Reads ./data-sync/mandovara-data.sql + mandovara-images.zip and:
//   1. Truncates the data tables (keeps schema/migrations intact).
//   2. Loads the SQL dump into the local Postgres.
//   3. Unzips images into public/catalog/.
//
// If a table has rows you added locally that aren't in the dump,
// they get wiped — this is a "sync from teammate" operation, not
// a merge. Ask if in doubt; git it first if you care.
//
// Run:  pnpm data:pull
//       DUMP_DIR=/some/other/path pnpm data:pull

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const DUMP_DIR = process.env["DUMP_DIR"] ?? resolve(process.cwd(), "data-sync");
const SQL_IN   = join(DUMP_DIR, "mandovara-data.sql");
const ZIP_IN   = join(DUMP_DIR, "mandovara-images.zip");
const CATALOG_DIR = resolve(process.cwd(), "public", "catalog");

// Tables to wipe before restore. MUST match dump-data.ts's list —
// and MUST be in FK-safe order (child before parent). Postgres
// TRUNCATE ... CASCADE handles cycles so this list only needs to
// include the top-level ones.
const CASCADE_TABLES = [
  "QuotationLine", "Quotation",
  "CalcResult", "MeasurementItem", "Measurement", "Room",
  "ArchitectCommission", "Project",
  "Architect", "ContactPerson", "Lead", "Client",
  "Price", "SampleBook", "Colourway", "Design", "Collection", "Brand",
  "Employee",
  "NumberSequence",
];

if (!existsSync(SQL_IN)) {
  console.error(`Not found: ${SQL_IN}`);
  console.error(`Ask your teammate to run \`pnpm data:dump\` and share ${DUMP_DIR}/`);
  process.exit(1);
}
console.log(`SQL dump: ${SQL_IN} (${(statSync(SQL_IN).size / 1024).toFixed(0)} KB)`);
if (existsSync(ZIP_IN)) {
  console.log(`Images:   ${ZIP_IN} (${(statSync(ZIP_IN).size / 1024 / 1024).toFixed(1)} MB)`);
} else {
  console.log(`Images:   (no zip present — skipping image restore)`);
}

// Step 1 — TRUNCATE existing rows (schema stays)
const truncateList = CASCADE_TABLES.map((t) => `"${t}"`).join(",");
console.log(`\nTruncating existing data (${CASCADE_TABLES.length} tables + cascades)…`);
execSync(
  `docker exec mandovara-postgres psql -U mandovara -d mandovara -c 'TRUNCATE TABLE ${truncateList} CASCADE;'`,
  { stdio: "inherit", shell: "/bin/bash" },
);

// Step 2 — Restore SQL dump
console.log(`\nRestoring SQL dump…`);
execSync(
  `docker exec -i mandovara-postgres psql -U mandovara -d mandovara < "${SQL_IN}"`,
  { stdio: "inherit", shell: "/bin/bash" },
);

// Step 3 — Unzip images (if present)
if (existsSync(ZIP_IN)) {
  console.log(`\nUnzipping images → ${CATALOG_DIR}…`);
  mkdirSync(CATALOG_DIR, { recursive: true });
  execSync(
    `powershell.exe -NoProfile -Command "Expand-Archive -Path '${ZIP_IN}' -DestinationPath '${CATALOG_DIR}' -Force"`,
    { stdio: "inherit" },
  );
}

console.log("\n" + "─".repeat(60));
console.log(`  ✓ Data restored. Refresh /products to see the catalog.`);
console.log("─".repeat(60));

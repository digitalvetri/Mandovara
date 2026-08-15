// One-command data export for the two-person team.
//
// Writes two artefacts into ./data-sync/ (gitignored):
//   1. mandovara-data.sql — pg_dump of every data-carrying table
//      (catalog + CRM + config, keeping migrations out).
//   2. mandovara-images.zip — archive of public/catalog/ so the
//      Rugway page renders + PDF flip-throughs travel with the SQL.
//
// The teammate runs `pnpm data:pull` on her machine against the
// same folder — one command each side, no manual dump-and-restore
// dance.
//
// Run:  pnpm data:dump
//       DUMP_DIR=/some/other/path pnpm data:dump

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, statSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const DUMP_DIR = process.env["DUMP_DIR"] ?? resolve(process.cwd(), "data-sync");
const SQL_OUT  = join(DUMP_DIR, "mandovara-data.sql");
const ZIP_OUT  = join(DUMP_DIR, "mandovara-images.zip");
const CATALOG_DIR = resolve(process.cwd(), "public", "catalog");

mkdirSync(DUMP_DIR, { recursive: true });

// Every table we want the teammate to see. Migrations table is
// intentionally excluded — she'll run `prisma migrate deploy` to
// materialise her schema, then the SQL below fills it.
const TABLES = [
  "Organization", "Branch", "User", "Employee",
  "Brand", "Collection", "Design", "Colourway", "Price", "SampleBook",
  "Client", "ContactPerson", "Lead", "Architect", "ArchitectCommission",
  "Project", "Room", "Measurement", "MeasurementItem", "CalcResult",
  "Quotation", "QuotationLine",
  "NumberSequence",
];

const tableArgs = TABLES.map((t) => `--table='"${t}"'`).join(" ");

console.log(`Writing SQL dump → ${SQL_OUT}`);
execSync(
  `docker exec mandovara-postgres pg_dump -U mandovara -d mandovara --data-only --column-inserts ${tableArgs} > "${SQL_OUT}"`,
  { stdio: "inherit", shell: "/bin/bash" },
);
const sqlSize = statSync(SQL_OUT).size;
console.log(`  ✓ ${(sqlSize / 1024).toFixed(0)} KB`);

// Zip public/catalog/ (images + full-catalogue PDFs). Uses
// PowerShell's Compress-Archive so no external zip tool is needed.
console.log(`\nZipping ${CATALOG_DIR} → ${ZIP_OUT}`);
if (existsSync(CATALOG_DIR) && readdirSync(CATALOG_DIR).length > 0) {
  // Compress-Archive can't overwrite silently — remove first.
  execSync(`powershell.exe -NoProfile -Command "if (Test-Path '${ZIP_OUT}') { Remove-Item '${ZIP_OUT}' -Force }; Compress-Archive -Path '${CATALOG_DIR}\\*' -DestinationPath '${ZIP_OUT}' -CompressionLevel Optimal"`,
    { stdio: "inherit" });
  const zipSize = statSync(ZIP_OUT).size;
  console.log(`  ✓ ${(zipSize / 1024 / 1024).toFixed(1)} MB`);
} else {
  console.log("  · public/catalog/ is empty, skipping zip");
}

console.log("\n" + "─".repeat(60));
console.log(`  Send these two files to your teammate:`);
console.log(`    ${SQL_OUT}`);
console.log(`    ${ZIP_OUT}`);
console.log(`  She drops them in her own data-sync/ and runs:`);
console.log(`    pnpm data:pull`);
console.log("─".repeat(60));

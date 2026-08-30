// One-off extractor: read CATALOGUE LIST.xlsx from the repo root and
// bake the deduped, cleaned catalogue names into
// src/modules/catalog/catalogues-seed-data.ts.
//
// Regenerate whenever the source Excel changes:
//   node scripts/extract-catalogues-seed.mjs
//
// The Excel itself is NOT committed — it's a working copy on the
// operator's machine. The .ts file this script produces IS committed
// and is what /catalogues' "Load starter list" button reads at runtime.

import XLSX from "xlsx";
import fs from "node:fs";

const SRC = "./CATALOGUE-LIST.xlsx";
const OUT = "src/modules/catalog/catalogues-seed-data.ts";

const SHEET_TO_FAMILY = {
  "WALLPAPER":            "WALLPAPER",
  "CUSTOMISED WP":        "MURAL",
  "CURTAIN MAIN":         "CURTAIN_FABRIC",
  "CURTAIN SHEER":        "SHEER",
  "CURTAIN MAIN & SHEER": "CURTAIN_FABRIC",
  "FABRIC":               "UPHOLSTERY_FABRIC",
  "WOODEN FLOORING":      "FLOORING",
  "CARPETS":              "CARPET_ROLL",
  "PAMPLETS":             "CARPET_ROLL",
  "BLINDS":               "BLIND",
};

const HEADER_STRINGS = new Set([
  "CATALOGUE NAMES", "CATALOGUE NAME", "CATALOGE NAME",
  "BLINDS IN PAMPLETS",
]);

function norm(s) {
  return String(s ?? "").trim().replace(/\s+/g, " ");
}

const wb = XLSX.readFile(SRC);
// family → Map(normalizedUpperKey → displayName)
const byFamily = new Map();
let rawRowsSeen = 0;

for (const sheet of wb.SheetNames) {
  const family = SHEET_TO_FAMILY[sheet];
  if (!family) {
    console.warn("  · SKIP unknown sheet:", sheet);
    continue;
  }
  const ws = wb.Sheets[sheet];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const bucket = byFamily.get(family) ?? new Map();

  for (const row of data) {
    const a = row[0];
    const b = norm(row[1]);
    if (!b) continue;
    const bUpper = b.toUpperCase();
    if (HEADER_STRINGS.has(bUpper)) continue;
    if (bUpper.startsWith("SUN SCREEN FABRIC")) continue;
    // BLINDS sub-items (rows without a numeric S.NO) are structured as
    // "1.WONDERFUL BLACKOUT" etc. inside col B while col A is empty.
    // The parent NL BLIND row already covers the group, so skip these.
    if (typeof a !== "number") continue;
    const key = bUpper;
    if (bucket.has(key)) continue;
    bucket.set(key, b);
    rawRowsSeen++;
  }
  byFamily.set(family, bucket);
}

// Emit summary
let total = 0;
console.log("=== Extraction summary ===");
for (const [family, bucket] of byFamily.entries()) {
  console.log("  " + family.padEnd(20) + " " + bucket.size + " unique names");
  total += bucket.size;
}
console.log("Total unique: " + total + "  (from " + rawRowsSeen + " raw rows)");

// Emit TS
const lines = [];
lines.push("/* eslint-disable max-lines */");
lines.push("// AUTO-GENERATED from CATALOGUE LIST.xlsx. Do not edit by hand.");
lines.push("// Regenerate: node scripts/extract-catalogues-seed.mjs");
lines.push("");
lines.push('import type { ProductFamily } from "@prisma/client";');
lines.push("");
lines.push("export const CATALOGUE_SEED: ReadonlyArray<{ family: ProductFamily; names: readonly string[] }> = [");
for (const [family, bucket] of byFamily.entries()) {
  const names = Array.from(bucket.values()).sort();
  lines.push("  {");
  lines.push('    family: "' + family + '",');
  lines.push("    names: [");
  for (const n of names) {
    const esc = n.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    lines.push('      "' + esc + '",');
  }
  lines.push("    ],");
  lines.push("  },");
}
lines.push("];");
lines.push("");

fs.writeFileSync(OUT, lines.join("\n"));
console.log("Wrote " + OUT);

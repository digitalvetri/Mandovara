// Parse the ten catalog-only sheets from WALLAPPER STOCK LIST into a
// hand-checkable TS constant we can commit + ship to prod.
//
// The workbook itself doesn't get committed. Only the extracted rows
// land in src/modules/catalog-import/data.ts. Mirrors the pattern
// scripts/extract-stock.ts uses for the four stock sheets.
//
// The four STOCK sheets (MANDOVARA STOCK, BRAHMOS, FLOOR TILE, TRACK
// STOCK) are handled by extract-stock.ts and imported through the
// stock path. This file handles the catalog sheets — brand/collection
// entries with catalogue names but no quantities.

import * as XLSX from "xlsx";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = "c:/Users/Administrator/Downloads/product catalog/WALLAPPER STOCK LIST (2) (2) (4).xlsx";

interface CatalogRow {
  brand:          string;
  collection:     string;
  family:         string;
  sellUnit:       "ROLL" | "METRE" | "SQFT" | "BOX";
  hsn:            string;
  gstRatePct:     number;
  ratePaise:      number;
  hex:            string;
  designCode:     string;
  designName:     string;
  colourwayCode:  string;
}

interface FamilyDefaults {
  collectionName: string;
  family:         string;
  sellUnit:       CatalogRow["sellUnit"];
  hsn:            string;
  gstRatePct:     number;
  ratePaise:      number;
  hex:            string;
}

// Sheet → collection + family defaults. Mirrors the mapping in
// scripts/import-wallpaper-stock.ts so the two importers agree on
// what a given sheet represents.
const SHEET_TO_FAMILY: Record<string, FamilyDefaults> = {
  "WALLPAPER":            { collectionName: "Wallpaper",            family: "WALLPAPER",         sellUnit: "ROLL",  hsn: "4814", gstRatePct: 12, ratePaise: 250000, hex: "#D9C9B4" },
  "CUSTOMISED WALLPAPER": { collectionName: "Customised Wallpaper", family: "WALLPAPER",         sellUnit: "ROLL",  hsn: "4814", gstRatePct: 12, ratePaise: 450000, hex: "#B7A891" },
  "CURTAIN MAIN":         { collectionName: "Curtain Main",         family: "CURTAIN_FABRIC",    sellUnit: "METRE", hsn: "5407", gstRatePct: 12, ratePaise: 120000, hex: "#C8B79A" },
  "CURTAIN SHEER":        { collectionName: "Curtain Sheer",        family: "SHEER",             sellUnit: "METRE", hsn: "5407", gstRatePct: 12, ratePaise:  60000, hex: "#EFE9DC" },
  "CURTAIN MAIN SHEER":   { collectionName: "Curtain Main + Sheer", family: "CURTAIN_FABRIC",    sellUnit: "METRE", hsn: "5407", gstRatePct: 12, ratePaise:  90000, hex: "#DED2BA" },
  "FABRIC":               { collectionName: "Upholstery Fabric",    family: "UPHOLSTERY_FABRIC", sellUnit: "METRE", hsn: "5407", gstRatePct: 12, ratePaise:  80000, hex: "#A78568" },
  "WOODEN FLOORINGS":     { collectionName: "Wooden Flooring",      family: "FLOORING",          sellUnit: "BOX",   hsn: "4409", gstRatePct: 12, ratePaise: 720000, hex: "#8B6845" },
  "CARPETS":              { collectionName: "Carpets",              family: "CARPET_ROLL",       sellUnit: "SQFT",  hsn: "5703", gstRatePct: 12, ratePaise:  20000, hex: "#6E4C34" },
  "BLINDS":               { collectionName: "Blinds",               family: "BLIND",             sellUnit: "SQFT",  hsn: "6303", gstRatePct: 12, ratePaise:  30000, hex: "#B8B0A2" },
};

// Stock sheets + PAMPLETS (mixes families, parked until owner tags each row).
const SKIP_SHEETS = new Set([
  "MANDOVARA STOCK",
  "BRAHMOS 4.8.26",
  "FLOOR TILE 4.8.26",
  "TRACK STOCK",
  "PAMPLETS",
]);

const BRAND_NAME = "Mandovara Studio";

function cleanName(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s.length === 0) return null;
  if (s === "-") return null;
  if (/^no code no$/i.test(s)) return null;
  if (/^\d+$/.test(s)) return null;
  if (/^blinds in pamplets$/i.test(s)) return null;
  if (/^s\.?\s*no\.?$/i.test(s)) return null;
  if (/^catal[a-z]*\s+names?$/i.test(s)) return null;
  return s.replace(/\s+/g, " ");
}

function pickNameColumn(sample: Record<string, unknown> | undefined): string | null {
  if (!sample) return null;
  return Object.keys(sample).find((k) =>
    /^CATAL[A-Z]*\s+NAMES?$/i.test(k.trim()),
  ) ?? null;
}

function slugCode(name: string, i: number): string {
  const s = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 14);
  return `${s}-${String(i + 1).padStart(3, "0")}`;
}

const wb = XLSX.readFile(SRC);
const out: CatalogRow[] = [];

for (const sheetName of wb.SheetNames) {
  if (SKIP_SHEETS.has(sheetName)) continue;
  const cfg = SHEET_TO_FAMILY[sheetName];
  if (!cfg) continue;

  const ws   = wb.Sheets[sheetName]!;
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null, raw: false });
  const nameKey = pickNameColumn(rows[0]);
  if (!nameKey) continue;

  const seenNames = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]![nameKey];
    const name = cleanName(raw);
    if (!name) continue;
    const dedupeKey = name.toUpperCase();
    if (seenNames.has(dedupeKey)) continue;
    seenNames.add(dedupeKey);

    const code = slugCode(name, i);
    out.push({
      brand:         BRAND_NAME,
      collection:    cfg.collectionName,
      family:        cfg.family,
      sellUnit:      cfg.sellUnit,
      hsn:           cfg.hsn,
      gstRatePct:    cfg.gstRatePct,
      ratePaise:     cfg.ratePaise,
      hex:           cfg.hex,
      designCode:    code,
      designName:    name,
      colourwayCode: `${code}-STD`,
    });
  }
}

const target = path.join(process.cwd(), "src", "modules", "catalog-import", "data.ts");
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(
  target,
  `/* eslint-disable max-lines */
// AUTO-GENERATED by scripts/extract-catalog.ts on ${new Date().toISOString()}
// Do not hand-edit. Re-run the script to regenerate.

export interface CatalogImportRow {
  readonly brand:         string;
  readonly collection:    string;
  readonly family:        string;
  readonly sellUnit:      "ROLL" | "METRE" | "SQFT" | "BOX";
  readonly hsn:           string;
  readonly gstRatePct:    number;
  readonly ratePaise:     number;
  readonly hex:           string;
  readonly designCode:    string;
  readonly designName:    string;
  readonly colourwayCode: string;
}

export const CATALOG_IMPORT_ROWS: readonly CatalogImportRow[] = ${JSON.stringify(out, null, 2)} as const;
`,
);

const byCollection: Record<string, number> = {};
for (const r of out) byCollection[r.collection] = (byCollection[r.collection] ?? 0) + 1;
console.log(`wrote ${out.length} rows → ${target}`);
console.log(`by collection:`);
for (const [k, v] of Object.entries(byCollection).sort()) console.log(`  ${k.padEnd(24)} ${v}`);

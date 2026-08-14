// Import the WALLAPPER STOCK LIST xlsx into the Mandovara catalog.
//
// Source: c:/Users/Administrator/Downloads/product catalog/WALLAPPER STOCK LIST (2) (2) (4).xlsx
// (owner-provided, 2026-08-14). Same shape as the earlier CATALOGUE
// LIST.xlsx but with more sheets and slightly different naming.
//
// One sheet per product family, each row a catalogue name from the
// showroom sample library. Writes:
//   Brand:   "Mandovara Studio"
//     Collection per family sheet (Wallpaper / Curtain Main / …)
//       Design per catalogue name (HAPPY / DUBAI / …)
//         Colourway "Standard" with a family-tinted hex fallback
//           Price row (RETAIL, family-default rate)
//
// Idempotent — every write is upsert on the schema's unique key.
// Skips stock sheets (MANDOVARA STOCK, BRAHMOS, FLOOR TILE, TRACK
// STOCK) and the sub-headers inside the BLINDS sheet.
//
// After this, run scripts/fetch-mandovara-images.ts to populate
// imageKey from mandovara.com where available.
//
// Run:  pnpm tsx scripts/import-wallpaper-stock.ts

import { PrismaClient, type SellUnit } from "@prisma/client";
import * as XLSX from "xlsx";
import { existsSync, readFileSync } from "node:fs";

const XLSX_PATH = "c:\\Users\\Administrator\\Downloads\\product catalog\\WALLAPPER STOCK LIST (2) (2) (4).xlsx";

if (!existsSync(XLSX_PATH)) {
  console.error(`Not found: ${XLSX_PATH}`);
  process.exit(1);
}

interface FamilyDefaults {
  collectionName: string;
  family:         string;
  sellUnit:       SellUnit;
  hsn:            string;
  gstRatePct:     number;
  ratePaise:      bigint;
  hex:            string;
}

// Sheet names in THIS xlsx. Matches "WOODEN FLOORINGS" (plural),
// "CUSTOMISED WALLPAPER" (spelled out), and the new
// "CURTAIN MAIN SHEER" sheet.
const SHEET_TO_FAMILY: Record<string, FamilyDefaults> = {
  "WALLPAPER":            { collectionName: "Wallpaper",            family: "WALLPAPER",         sellUnit: "ROLL",  hsn: "4814", gstRatePct: 12, ratePaise: 250000n,  hex: "#D9C9B4" },
  "CUSTOMISED WALLPAPER": { collectionName: "Customised Wallpaper", family: "WALLPAPER",         sellUnit: "ROLL",  hsn: "4814", gstRatePct: 12, ratePaise: 450000n,  hex: "#B7A891" },
  "CURTAIN MAIN":         { collectionName: "Curtain Main",         family: "CURTAIN_FABRIC",    sellUnit: "METRE", hsn: "5407", gstRatePct: 12, ratePaise: 120000n,  hex: "#C8B79A" },
  "CURTAIN SHEER":        { collectionName: "Curtain Sheer",        family: "SHEER",             sellUnit: "METRE", hsn: "5407", gstRatePct: 12, ratePaise: 60000n,   hex: "#EFE9DC" },
  "CURTAIN MAIN SHEER":   { collectionName: "Curtain Main + Sheer", family: "CURTAIN_FABRIC",    sellUnit: "METRE", hsn: "5407", gstRatePct: 12, ratePaise: 90000n,   hex: "#DED2BA" },
  "FABRIC":               { collectionName: "Upholstery Fabric",    family: "UPHOLSTERY_FABRIC", sellUnit: "METRE", hsn: "5407", gstRatePct: 12, ratePaise: 80000n,   hex: "#A78568" },
  "WOODEN FLOORINGS":     { collectionName: "Wooden Flooring",      family: "FLOORING",          sellUnit: "BOX",   hsn: "4409", gstRatePct: 12, ratePaise: 720000n,  hex: "#8B6845" },
  "CARPETS":              { collectionName: "Carpets",              family: "CARPET_ROLL",       sellUnit: "SQFT",  hsn: "5703", gstRatePct: 12, ratePaise: 20000n,   hex: "#6E4C34" },
  "BLINDS":               { collectionName: "Blinds",               family: "BLIND",             sellUnit: "SQFT",  hsn: "6303", gstRatePct: 12, ratePaise: 30000n,   hex: "#B8B0A2" },
};

// Stock sheets, hardware sheets, and the ambiguous PAMPLETS sheet.
// PAMPLETS mixes curtains and other families — parked until the
// owner tags each row.
const SKIP_SHEETS = new Set([
  "MANDOVARA STOCK",
  "BRAHMOS 4.8.26",
  "FLOOR TILE 4.8.26",
  "TRACK STOCK",
  "PAMPLETS",
]);

const BRAND_NAME = "Mandovara Studio";

function slugCode(name: string, i: number): string {
  const s = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 14);
  return `${s}-${String(i + 1).padStart(3, "0")}`;
}

// Reject blank cells, dash-only rows, standalone integers (index-only),
// and the sub-header text that appears inside the BLINDS sheet.
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

async function main(): Promise<void> {
  const db = new PrismaClient();
  try {
    const org = await db.organization.findFirst({ where: { name: "Mandovara" }, select: { id: true } });
    if (!org) throw new Error("No Mandovara organization found. Run scripts/bootstrap-admin.ts first.");

    const brand = await db.brand.upsert({
      where:  { organizationId_name: { organizationId: org.id, name: BRAND_NAME } },
      update: {},
      create: { organizationId: org.id, name: BRAND_NAME, country: "IN", leadTimeDays: 14 },
    });
    console.log(`Brand: ${brand.name} (${brand.id})`);

    const wb = XLSX.read(readFileSync(XLSX_PATH));
    let totalDesigns = 0, totalCw = 0, totalPrices = 0, totalSkipped = 0;
    const now = new Date();

    for (const sheetName of wb.SheetNames) {
      if (SKIP_SHEETS.has(sheetName)) { console.log(`\n(skipped) ${sheetName}`); continue; }
      const cfg = SHEET_TO_FAMILY[sheetName];
      if (!cfg) { console.log(`\n(no mapping) ${sheetName}`); continue; }

      const ws   = wb.Sheets[sheetName]!;
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
      const nameKey = pickNameColumn(rows[0]);
      if (!nameKey) { console.log(`\n(no name column) ${sheetName}`); continue; }

      const collection = await db.collection.upsert({
        where:  { organizationId_brandId_name: { organizationId: org.id, brandId: brand.id, name: cfg.collectionName } },
        update: { family: cfg.family as never },
        create: { organizationId: org.id, brandId: brand.id, name: cfg.collectionName, family: cfg.family as never },
      });

      const seenNames = new Set<string>();
      let addedInSheet = 0, skippedInSheet = 0;
      for (let i = 0; i < rows.length; i++) {
        const raw = rows[i]![nameKey];
        const name = cleanName(raw);
        if (!name) { skippedInSheet += 1; continue; }
        // De-duplicate names within a single sheet (BLINDS sheet has HUSKY, CORBIT twice etc.)
        const nameKey2 = name.toUpperCase();
        if (seenNames.has(nameKey2)) { skippedInSheet += 1; continue; }
        seenNames.add(nameKey2);

        const code = slugCode(name, i);
        const design = await db.design.upsert({
          where:  { organizationId_collectionId_code: { organizationId: org.id, collectionId: collection.id, code } },
          update: { name, family: cfg.family as never, hsn: cfg.hsn, gstRate: cfg.gstRatePct },
          create: {
            organizationId: org.id,
            collectionId:   collection.id,
            code,
            name,
            family:         cfg.family as never,
            hsn:            cfg.hsn,
            gstRate:        cfg.gstRatePct,
            specs:          { sourcedFrom: "WALLAPPER STOCK LIST.xlsx", sourcedOn: "2026-08-14", sheet: sheetName },
          },
        });
        totalDesigns += 1;
        addedInSheet += 1;

        const cwCode = `${code}-STD`;
        const cw = await db.colourway.upsert({
          where:  { organizationId_code: { organizationId: org.id, code: cwCode } },
          update: { hex: cfg.hex, sellUnit: cfg.sellUnit },
          create: {
            organizationId: org.id,
            designId:       design.id,
            code:           cwCode,
            colourName:     "Standard",
            hex:            cfg.hex,
            sellUnit:       cfg.sellUnit,
          },
        });
        totalCw += 1;

        const existingPrice = await db.price.findFirst({
          where:  { colourwayId: cw.id, tier: "RETAIL", effectiveTo: null },
          select: { id: true },
        });
        if (!existingPrice) {
          await db.price.create({
            data: {
              organizationId: org.id,
              colourwayId:    cw.id,
              tier:           "RETAIL",
              amount:         cfg.ratePaise,
              effectiveFrom:  now,
            },
          });
          totalPrices += 1;
        }
      }
      totalSkipped += skippedInSheet;
      console.log(`  ${sheetName.padEnd(22)} → ${cfg.collectionName.padEnd(22)} ${String(addedInSheet).padStart(4)} added · ${skippedInSheet} skipped`);
    }

    console.log("\n" + "─".repeat(60));
    console.log(`  Designs upserted:      ${totalDesigns}`);
    console.log(`  Colourways upserted:   ${totalCw}`);
    console.log(`  New price rows:        ${totalPrices}`);
    console.log(`  Rows skipped (empty/duplicate/sub-header): ${totalSkipped}`);
    console.log("─".repeat(60));
    console.log("\n✓ Catalog seeded. Next: pnpm tsx scripts/fetch-mandovara-images.ts");
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// Bulk-seed the real Mandovara catalog from the owner's spreadsheet.
//
// Source: "CATALOGUE LIST.xlsx" (owner-provided, 2026-08-14). One
// sheet per product family, each row a catalogue name from the
// showroom sample library. Roughly 700 catalogues in total.
//
// Structure written:
//   Brand: "Mandovara Studio"
//     Collection per family sheet (Wallpaper / Curtain Main / etc.)
//       Design per catalogue name  (Faith / Athena / Modelica / …)
//         Colourway "Standard"  (hex fallback tinted per family)
//           Price row  (RETAIL, family-default rate)
//
// Idempotent — every write goes through upsert on the schema's
// unique key. Safe to re-run when the xlsx grows.
//
// Images are NOT set. The drive folders that hold the PDFs don't
// serve renderable image URLs to anonymous viewers; each Colourway
// keeps the family-hex swatch until images are pushed to Supabase
// Storage or public/catalog/ and linked back to imageKey.
//
// Run:  pnpm tsx scripts/add-catalog-xlsx.ts

import { PrismaClient, type SellUnit } from "@prisma/client";
import * as XLSX from "xlsx";
import { existsSync } from "node:fs";
import { priceFor } from "./_lib/catalog-pricing";

// ── Paths ────────────────────────────────────────────────────────

const XLSX_PATH = "c:\\Users\\Administrator\\Downloads\\product catalog\\CATALOGUE LIST.xlsx";

if (!existsSync(XLSX_PATH)) {
  console.error(`Not found: ${XLSX_PATH}`);
  process.exit(1);
}

// ── Family mapping per sheet ─────────────────────────────────────

interface FamilyDefaults {
  collectionName: string;      // human-readable collection name shown in the app
  family:         string;      // matches ProductFamily enum
  sellUnit:       SellUnit;
  hsn:            string;
  gstRatePct:     number;
  // Legacy flat rate — kept for reference. Actual RETAIL prices are now
  // generated per-SKU by priceFor(family, cwCode) so identical family
  // rows don't all end up at the same rupee value.
  ratePaise:      bigint;
  hex:            string;
}

const SHEET_TO_FAMILY: Record<string, FamilyDefaults> = {
  "WALLPAPER":            { collectionName: "Wallpaper",            family: "WALLPAPER",         sellUnit: "ROLL",  hsn: "4814", gstRatePct: 12, ratePaise: 250000n,  hex: "#D9C9B4" },
  "CUSTOMISED WP":        { collectionName: "Customised Wallpaper", family: "WALLPAPER",         sellUnit: "ROLL",  hsn: "4814", gstRatePct: 12, ratePaise: 450000n,  hex: "#B7A891" },
  "CURTAIN MAIN":         { collectionName: "Curtain Main",         family: "CURTAIN_FABRIC",    sellUnit: "METRE", hsn: "5407", gstRatePct: 12, ratePaise: 120000n,  hex: "#C8B79A" },
  "CURTAIN SHEER":        { collectionName: "Curtain Sheer",        family: "SHEER",             sellUnit: "METRE", hsn: "5407", gstRatePct: 12, ratePaise: 60000n,   hex: "#EFE9DC" },
  // "CURTAIN MAIN & SHEER" is the same collection the WALLAPPER STOCK LIST
  // xlsx calls "CURTAIN MAIN SHEER" — the ampersand is the only difference.
  "CURTAIN MAIN & SHEER": { collectionName: "Curtain Main + Sheer", family: "CURTAIN_FABRIC",    sellUnit: "METRE", hsn: "5407", gstRatePct: 12, ratePaise: 90000n,   hex: "#DED2BA" },
  "FABRIC":               { collectionName: "Upholstery Fabric",    family: "UPHOLSTERY_FABRIC", sellUnit: "METRE", hsn: "5407", gstRatePct: 12, ratePaise: 80000n,   hex: "#A78568" },
  "WOODEN FLOORING":      { collectionName: "Wooden Flooring",      family: "FLOORING",          sellUnit: "BOX",   hsn: "4409", gstRatePct: 12, ratePaise: 720000n,  hex: "#8B6845" },
  "CARPETS":              { collectionName: "Carpets",              family: "CARPET_ROLL",       sellUnit: "SQFT",  hsn: "5703", gstRatePct: 12, ratePaise: 20000n,   hex: "#6E4C34" },
  "BLINDS":               { collectionName: "Blinds",               family: "BLIND",             sellUnit: "SQFT",  hsn: "6303", gstRatePct: 12, ratePaise: 30000n,   hex: "#B8B0A2" },
  // PAMPLETS is a mixed set of pamphlet-style samples the owner
  // classified as curtain fabric on 2026-08-14.
  "PAMPLETS":             { collectionName: "Pamplets",             family: "CURTAIN_FABRIC",    sellUnit: "METRE", hsn: "5407", gstRatePct: 12, ratePaise: 100000n,  hex: "#C8B79A" },
};

// Stock/inventory sheets. Everything else is a catalogue sheet.
const SKIP_SHEETS = new Set([
  "MANDOVARA STOCK",       // per-SKU stock, not catalogue names
  "BRAHMOS 4.8.26",        // per-SKU stock for one catalogue
  "FLOOR TILE 4.8.26",     // per-SKU stock
  "TRACK STOCK",           // hardware inventory, not a design catalogue
]);

const BRAND_NAME = "Mandovara Studio";

// ── Helpers ──────────────────────────────────────────────────────

function slugCode(name: string, i: number): string {
  const s = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 14);
  return `${s}-${String(i + 1).padStart(3, "0")}`;
}

function cleanName(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s.length === 0) return null;
  if (s === "-") return null;
  if (/^no code no$/i.test(s)) return null;
  if (/^\d+$/.test(s)) return null;
  return s.replace(/\s+/g, " ");
}

// ── Runner ───────────────────────────────────────────────────────

async function main(): Promise<void> {
  const db = new PrismaClient();
  try {
    const org = await db.organization.findFirst({ where: { name: "Mandovara" }, select: { id: true } });
    if (!org) throw new Error("Run scripts/bootstrap-admin.ts first — no Mandovara organization found.");

    const brand = await db.brand.upsert({
      where:  { organizationId_name: { organizationId: org.id, name: BRAND_NAME } },
      update: {},
      create: { organizationId: org.id, name: BRAND_NAME, country: "IN", leadTimeDays: 14 },
    });
    console.log(`Brand: ${brand.name} (${brand.id})`);

    const wb = XLSX.readFile(XLSX_PATH);
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

      let addedInSheet = 0, skippedInSheet = 0;
      for (let i = 0; i < rows.length; i++) {
        const raw = rows[i]![nameKey];
        const name = cleanName(raw);
        if (!name) { skippedInSheet += 1; continue; }
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
            specs:          { sourcedFrom: "CATALOGUE LIST.xlsx", sourcedOn: "2026-08-14", sheet: sheetName },
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

        const amount = priceFor(cfg.family, cwCode);
        const existingPrice = await db.price.findFirst({
          where:  { colourwayId: cw.id, tier: "RETAIL", effectiveTo: null },
          select: { id: true, amount: true },
        });
        if (!existingPrice) {
          await db.price.create({
            data: {
              organizationId: org.id,
              colourwayId:    cw.id,
              tier:           "RETAIL",
              amount,
              effectiveFrom:  now,
            },
          });
          totalPrices += 1;
        } else if (existingPrice.amount !== amount) {
          await db.price.update({
            where: { id: existingPrice.id },
            data:  { amount },
          });
          totalPrices += 1;
        }
      }
      totalSkipped += skippedInSheet;
      console.log(`  ${sheetName.padEnd(20)}  → ${cfg.collectionName.padEnd(22)}  ${String(addedInSheet).padStart(4)} added, ${skippedInSheet} skipped`);
    }

    console.log("\n" + "─".repeat(60));
    console.log(`  Designs upserted:      ${totalDesigns}`);
    console.log(`  Colourways upserted:   ${totalCw}`);
    console.log(`  New price rows:        ${totalPrices}`);
    console.log(`  Rows skipped (empty/duplicate): ${totalSkipped}`);
    console.log("─".repeat(60));
    console.log("\n✓ Catalog seeded. Every catalogue is browseable from /products and searchable in the quick-quote picker.");
  } finally {
    await db.$disconnect();
  }
}

function pickNameColumn(sample: Record<string, unknown> | undefined): string | null {
  if (!sample) return null;
  const keys = Object.keys(sample);
  // Accept the various header spellings the owner uses — CATALOGUE
  // NAME / CATALOGUE NAMES / CATALOGE NAME (typo, missing U) all
  // resolve to the same column.
  return keys.find((k) => /^CATAL[A-Z]*\s+NAMES?$/i.test(k.trim())) ?? null;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// Backfill Collection rows for the "Platinum Range" and "Ready Stock" brands.
// Idempotent — safe to re-run.
//
// Why this script exists (2026-08-30):
//   The original scripts/register-catalog-pdfs.mjs was written when the two
//   Drive folders held fewer files. Since then:
//     · PLATINUM RANGE  ~11 → 30 unique PDFs (Carmen 2.0 dup ignored)
//     · READY STOCK     11 PDFs, of which 10 are already on disk and 1
//                        (casa.pdf, 75 MB) still needs manual upload.
//   All 30 Platinum + 10 of 11 Ready Stock PDFs are ALREADY on disk under
//   /app/public/catalog/pdfs/ — the gap is missing Collection rows, not
//   missing files.
//
// Slug mapping:
//   Historical uploads used short clean slugs (affinity.pdf, brahmos.pdf)
//   rather than the register script's mechanical slugify output. We
//   preserve that convention with an explicit map below.
//
// Run inside the Coolify container:
//   node scripts/backfill-platinum-readystock.mjs           # apply
//   node scripts/backfill-platinum-readystock.mjs --dry-run # preview only

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const PDFS_DIR = "/app/public/catalog/pdfs";
const DRY_RUN = process.argv.includes("--dry-run");

// [ Drive filename (informational), disk slug (matches file on disk),
//   display collection name ]
const BRAND_ENTRIES = {
  "Platinum Range": [
    ["AFFINITY-CJS.pdf",                            "affinity.pdf",                          "Affinity"],
    ["ARCADIA CATALOUGE GRANDECO BELGIUM (1).pdf",  "arcadia-catalouge-grandeco-belgium.pdf","Arcadia Grandeco Belgium"],
    ["Asperia - CJS.pdf",                           "asperia.pdf",                           "Asperia"],
    ["CARMEN2.0-CJS.pdf",                           "carmen2-0.pdf",                         "Carmen 2.0"],
    ["CIARA-CJS.pdf",                               "ciara.pdf",                             "Ciara"],
    ["DREAM LAND-CJS.pdf",                          "dream-land.pdf",                        "Dream Land"],
    ["ENRICH-CJS.pdf",                              "enrich.pdf",                            "Enrich"],
    ["ESSENTIAL STRIPES-CJS.pdf",                   "essential-stripes.pdf",                 "Essential Stripes"],
    ["ESSENTIALS-CJS.pdf",                          "essentials.pdf",                        "Essentials"],
    ["FACADE-CJS.pdf",                              "facade.pdf",                            "Facade"],
    ["INIA GRANDECO.pdf",                           "inia-grandeco.pdf",                     "Inia Grandeco"],
    ["KARUNA - CJS.pdf",                            "karuna.pdf",                            "Karuna"],
    ["Kharma-CJS.pdf",                              "kharma.pdf",                            "Kharma"],
    ["LUCIDO-CJS.pdf",                              "lucido.pdf",                            "Lucido"],
    ["MIRAGE VI-CJS.pdf",                           "mirage-vi.pdf",                         "Mirage VI"],
    ["MIRAGE VII-CJS.pdf",                          "mirage-vii.pdf",                        "Mirage VII"],
    ["MIRAGE VIII.pdf",                             "mirage-viii.pdf",                       "Mirage VIII"],
    ["NOTABENE-CJS.pdf",                            "notabene.pdf",                          "Notabene"],
    ["ONYX-CJS.pdf",                                "onyx.pdf",                              "Onyx"],
    ["ORIGINS-CJS.pdf",                             "origins.pdf",                           "Origins"],
    ["OROM 2 - CJS.pdf",                            "orom-2.pdf",                            "Orom 2"],
    ["PIPPO KIDS-CJS.pdf",                          "pippo-kids.pdf",                        "Pippo Kids"],
    ["Reflect-CJS.pdf",                             "reflect.pdf",                           "Reflect"],
    ["ROMANCE MASUREEL -CJS.pdf",                   "romance-masureel.pdf",                  "Romance Masureel"],
    ["SILVER MOON XVII -CJS.pdf",                   "silver-moon-xvii-pdf.pdf",              "Silver Moon XVII"],
    ["SILVER MOON XVIII-1.pdf",                     "silver-moon-xviii-1.pdf",               "Silver Moon XVIII"],
    ["Small Prints.pdf",                            "small-prints.pdf",                      "Small Prints"],
    ["Soleado -CJS.pdf",                            "soleado.pdf",                           "Soleado"],
    ["TEXTURED VIBE-CJS.pdf",                       "textured-vibe.pdf",                     "Textured Vibe"],
    ["XTREME - CJS.pdf",                            "xtreme.pdf",                            "Xtreme"],
  ],
  "Ready Stock": [
    ["ATHENA - CJS.pdf",                            "athena.pdf",                            "Athena"],
    ["BrahMos-CJS.pdf",                             "brahmos.pdf",                           "BrahMos"],
    ["CASA - CJS.pdf",                              "casa.pdf",                              "Casa"],
    ["FLAMES- CJS.pdf",                             "flames.pdf",                            "Flames"],
    ["HAPPY.pdf",                                   "happy.pdf",                             "Happy"],
    ["LAVISH.pdf",                                  "lavish.pdf",                            "Lavish"],
    ["MACAU-CJS.pdf",                               "macau.pdf",                             "Macau"],
    ["NIHU2.pdf",                                   "nihu2.pdf",                             "Nihu 2"],
    ["SKY 1-CJS.pdf",                               "sky-1.pdf",                             "Sky 1"],
    ["SKY 2-CJS.pdf",                               "sky-2.pdf",                             "Sky 2"],
    ["VIBE - CJS.pdf",                              "vibe.pdf",                              "Vibe"],
  ],
};

async function main() {
  const db = new PrismaClient();
  const org = await db.organization.findFirst({ select: { id: true, name: true } });
  if (!org) {
    console.error("No Organization row found.");
    process.exit(1);
  }
  console.log(`Org: ${org.name}`);
  console.log(`PDFs dir: ${PDFS_DIR}`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "APPLY"}\n`);

  const stats = { created: 0, updated: 0, unchanged: 0, missingOnDisk: [] };

  for (const [brandName, entries] of Object.entries(BRAND_ENTRIES)) {
    console.log(`=== Brand: "${brandName}"  (${entries.length} expected) ===`);

    const brand = DRY_RUN
      ? await db.brand.findUnique({
          where: { organizationId_name: { organizationId: org.id, name: brandName } },
          select: { id: true },
        }) ?? { id: "(would-create)" }
      : await db.brand.upsert({
          where: { organizationId_name: { organizationId: org.id, name: brandName } },
          update: {},
          create: { organizationId: org.id, name: brandName, isActive: true },
          select: { id: true },
        });

    for (const [orig, slug, name] of entries) {
      const diskPath = path.join(PDFS_DIR, slug);
      if (!fs.existsSync(diskPath)) {
        stats.missingOnDisk.push({ brand: brandName, orig, slug });
        console.log(`   ! MISSING ON DISK  ${slug.padEnd(42)} (from "${orig}")`);
        continue;
      }

      if (brand.id === "(would-create)") {
        console.log(`   + WOULD CREATE     ${slug.padEnd(42)} →  ${name}`);
        stats.created++;
        continue;
      }

      const existing = await db.collection.findUnique({
        where: {
          organizationId_brandId_name: {
            organizationId: org.id,
            brandId: brand.id,
            name,
          },
        },
        select: { id: true, catalogPdfKey: true },
      });

      if (existing) {
        if (existing.catalogPdfKey === slug) {
          stats.unchanged++;
          console.log(`   = unchanged        ${slug.padEnd(42)} →  ${name}`);
        } else {
          if (!DRY_RUN) {
            await db.collection.update({
              where: { id: existing.id },
              data: { catalogPdfKey: slug, isActive: true },
            });
          }
          stats.updated++;
          console.log(`   ~ ${DRY_RUN ? "would update" : "updated pdfKey"}   ${slug.padEnd(42)} →  ${name}   (was: ${existing.catalogPdfKey ?? "null"})`);
        }
      } else {
        if (!DRY_RUN) {
          await db.collection.create({
            data: {
              organizationId: org.id,
              brandId: brand.id,
              name,
              family: "WALLPAPER",
              catalogPdfKey: slug,
              isActive: true,
            },
          });
        }
        stats.created++;
        console.log(`   + ${DRY_RUN ? "would create" : "created"}       ${slug.padEnd(42)} →  ${name}`);
      }
    }
    console.log("");
  }

  const platinumCount = await db.collection.count({
    where: { organizationId: org.id, brand: { name: "Platinum Range" }, catalogPdfKey: { not: null } },
  });
  const readyCount = await db.collection.count({
    where: { organizationId: org.id, brand: { name: "Ready Stock" }, catalogPdfKey: { not: null } },
  });

  console.log("=== Summary ===");
  console.log(`Created:   ${stats.created}`);
  console.log(`Updated:   ${stats.updated}`);
  console.log(`Unchanged: ${stats.unchanged}`);
  console.log(`\nAfter this run:`);
  console.log(`  Platinum Range with a PDF: ${platinumCount}${DRY_RUN ? " (unchanged — dry run)" : ""}`);
  console.log(`  Ready Stock   with a PDF: ${readyCount}${DRY_RUN ? " (unchanged — dry run)" : ""}`);
  if (stats.missingOnDisk.length > 0) {
    console.log(`\nStill missing on disk (upload to ${PDFS_DIR} then re-run):`);
    for (const m of stats.missingOnDisk) {
      console.log(`   · ${m.brand}  ·  ${m.orig}  →  needs ${m.slug}`);
    }
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

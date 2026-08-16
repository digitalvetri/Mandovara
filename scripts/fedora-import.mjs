// Bulk-import the Fedora (GNI KOREA) wallpaper artbook — Vol. 2.
//
// Source PDF: C:/Users/Administrator/Downloads/ARTBOOK VOL. 2_Fedora_GNI KOREA.pdf
//   ├── Brand "GNI KOREA" (upsert)
//   ├── Collection "Fedora" under GNI KOREA, family WALLPAPER (upsert)
//   ├── 26 Designs — one per code (57xxx).
//   │     rollWidthMm 530 · rollLengthM 10.05 (Korean wallpaper defaults)
//   └── ~100 Colourways — one per {code}-N label found on the detail page.
//         Per-colourway swatch is extracted by fedora-extract-swatches.py
//         from the PDF's embedded raster tiles, copied into
//           public/catalog/uploads/{colourwayId}.{jpg|png}
//         and the file used as imageKey. Colourways without a matched
//         swatch keep imageKey null (SwatchFallback renders in the UI).
//         Price row created as MRP=0 placeholder, matching Rugway pattern.
//
// Map of design → { detailPage, colourways[] } is derived from the PDF's
// embedded text (see scripts/fedora-scan-codes.py) with one manual patch
// for 57225 whose labels are baked as vector outlines and don't extract.
//
// Run: pnpm tsx scripts/fedora-import.mjs

import { PrismaClient } from "@prisma/client";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

const ORG_ID = "cmsvazyn20000f8dsbe8v8fhc"; // Mandovara org (from seed)
const BRAND_NAME = "GNI KOREA";
const COLLECTION_NAME = "Fedora";
const FAMILY = "WALLPAPER";
const HSN = "4814";
const GST_RATE = 12;
const SELL_UNIT = "ROLL";
const PLACEHOLDER_MRP_PAISE = 0n;

// Korean wallpaper physical defaults (per §4 in CLAUDE.md).
const ROLL_WIDTH_MM = 530;
const ROLL_LENGTH_M = 10.05;

const SWATCH_DIR = path.resolve("scripts", "fedora-swatches");
const UPLOAD_DIR = path.resolve("public", "catalog", "uploads");
const PUBLIC_ROUTE = "/catalog/uploads";
const SOURCE_TAG = "ARTBOOK VOL. 2 — Fedora GNI KOREA";

// Design → colourway suffixes + first detail page (from fedora-scan-codes.py).
// 57225 patched manually — its labels are vector outlines and don't extract.
const DESIGNS = [
  { code: "57233", detailPage: 10, colourways: [1, 2, 3, 4, 5, 6, 7] },
  { code: "57232", detailPage: 12, colourways: [1, 2, 3, 4, 5, 6] },
  { code: "57231", detailPage: 14, colourways: [1, 2, 4, 6, 7] },
  { code: "57230", detailPage: 16, colourways: [1, 3, 4, 5, 6] },
  { code: "57229", detailPage: 18, colourways: [1, 2, 3, 4, 5, 6] },
  { code: "57228", detailPage: 20, colourways: [1, 2, 3, 4, 5] },
  { code: "57226", detailPage: 22, colourways: [1, 3, 4, 5, 6] },
  { code: "57225", detailPage: 24, colourways: [3, 4] }, // manual — vector-outline labels
  { code: "57224", detailPage: 25, colourways: [2, 3, 4, 5] },
  { code: "57223", detailPage: 26, colourways: [2, 3, 4] },
  { code: "57222", detailPage: 27, colourways: [1] },
  { code: "57220", detailPage: 28, colourways: [3, 4, 5] },
  { code: "57219", detailPage: 29, colourways: [1, 4, 5, 6, 7] },
  { code: "57215", detailPage: 30, colourways: [1, 2, 3, 4] },
  { code: "57210", detailPage: 31, colourways: [1, 3, 5, 6, 7, 8, 9, 10] },
  { code: "57208", detailPage: 34, colourways: [1, 2, 4] },
  { code: "57206", detailPage: 35, colourways: [1, 2, 3, 4, 7] },
  { code: "57205", detailPage: 36, colourways: [1, 2, 3] },
  { code: "57204", detailPage: 37, colourways: [1] },
  { code: "57202", detailPage: 37, colourways: [1] },
  { code: "57198", detailPage: 38, colourways: [1, 2, 3] },
  { code: "57196", detailPage: 39, colourways: [1, 6, 9, 12] },
  { code: "57190", detailPage: 40, colourways: [1, 2] },
  { code: "57189", detailPage: 41, colourways: [1, 6] },
  { code: "57160", detailPage: 42, colourways: [1, 28, 30, 35, 38, 39, 40, 41] },
  { code: "57149", detailPage: 43, colourways: [1, 2] },
];

function swatchPath(designCode, n) {
  for (const ext of ["jpg", "png"]) {
    const p = path.join(SWATCH_DIR, `${designCode}-${n}.${ext}`);
    if (existsSync(p)) return { path: p, ext };
  }
  return null;
}

async function main() {
  await mkdir(UPLOAD_DIR, { recursive: true });

  const brand = await prisma.brand.upsert({
    where:  { organizationId_name: { organizationId: ORG_ID, name: BRAND_NAME } },
    create: { organizationId: ORG_ID, name: BRAND_NAME, country: "Korea" },
    update: {},
    select: { id: true },
  });

  const collection = await prisma.collection.upsert({
    where:  { organizationId_brandId_name: { organizationId: ORG_ID, brandId: brand.id, name: COLLECTION_NAME } },
    create: { organizationId: ORG_ID, brandId: brand.id, name: COLLECTION_NAME, family: FAMILY },
    update: {},
    select: { id: true },
  });

  console.log(`Brand ${brand.id}  Collection ${collection.id}`);

  const now = new Date();
  let designsMade = 0;
  let colourwaysMade = 0;

  let swatchesWithoutMatch = 0;
  let sharedPagesCleared = 0;

  for (const spec of DESIGNS) {
    const design = await prisma.design.upsert({
      where: {
        organizationId_collectionId_code: {
          organizationId: ORG_ID,
          collectionId:   collection.id,
          code:           spec.code,
        },
      },
      create: {
        organizationId: ORG_ID,
        collectionId:   collection.id,
        code:           spec.code,
        name:           `Fedora ${spec.code}`,
        family:         FAMILY,
        rollWidthMm:    ROLL_WIDTH_MM,
        rollLengthM:    ROLL_LENGTH_M,
        hsn:            HSN,
        gstRate:        GST_RATE,
        specs: {
          sourcedFrom: SOURCE_TAG,
          detailPage:  spec.detailPage,
        },
      },
      update: {},
      select: { id: true },
    });
    designsMade += 1;

    // Remove the shared detail-page render from the previous import
    // pass — every colourway gets its own swatch now.
    const stalePagePath = path.join(UPLOAD_DIR, `${design.id}.png`);
    if (existsSync(stalePagePath)) {
      await rm(stalePagePath, { force: true });
      sharedPagesCleared += 1;
    }

    for (const n of spec.colourways) {
      const cwCode = `${spec.code}-${n}`;
      const cw = await prisma.colourway.upsert({
        where:  { organizationId_code: { organizationId: ORG_ID, code: cwCode } },
        create: {
          organizationId: ORG_ID,
          designId:       design.id,
          code:           cwCode,
          colourName:     `Colour ${n}`,
          sellUnit:       SELL_UNIT,
        },
        update: {},
        select: { id: true },
      });
      colourwaysMade += 1;

      const swatch = swatchPath(spec.code, n);
      if (swatch) {
        const buf = await readFile(swatch.path);
        const dst = path.join(UPLOAD_DIR, `${cw.id}.${swatch.ext}`);
        await writeFile(dst, buf);
        await prisma.colourway.update({
          where: { id: cw.id },
          data:  { imageKey: `${PUBLIC_ROUTE}/${cw.id}.${swatch.ext}?v=${Date.now()}` },
        });
      } else {
        swatchesWithoutMatch += 1;
        await prisma.colourway.update({
          where: { id: cw.id },
          data:  { imageKey: null },
        });
      }

      const priceExists = await prisma.price.findFirst({
        where: { colourwayId: cw.id, tier: "MRP" },
        select: { id: true },
      });
      if (!priceExists) {
        await prisma.price.create({
          data: {
            organizationId: ORG_ID,
            colourwayId:    cw.id,
            tier:           "MRP",
            amount:         PLACEHOLDER_MRP_PAISE,
            effectiveFrom:  now,
          },
        });
      }
    }
  }

  console.log(`\ndesigns processed:     ${designsMade}`);
  console.log(`colourways processed:  ${colourwaysMade}`);
  console.log(`shared pages cleared:  ${sharedPagesCleared}`);
  console.log(`colourways w/o swatch: ${swatchesWithoutMatch}`);
}

main()
  .catch((e) => { console.error("FAIL:", e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

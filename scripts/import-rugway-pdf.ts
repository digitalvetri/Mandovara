// Import the Rugway Rugs PDF into the Mandovara catalog.
//
// Source: c:/Users/Administrator/Downloads/product catalog/Rugway Rugs-.pdf
//   26 pages: cover · index · 22 product pages · back.
//   Each product page shows two rugs from the same series with
//   design codes and a size × price grid.
//
// The PDF is fully rasterized (Pdftools SDK output — pdfjs
// text-extraction returns empty on every page). We can't parse
// individual design codes without OCR, so this seed imports at
// PAGE granularity: one Design per PDF product-page, with the
// rendered page image as its cover. The owner can split each
// page into its two constituent rugs later via the product edit
// screen.
//
// Structure written:
//   Brand:     "Rug Way"
//     Collection: "Rugway — Turkish Delight" (CARPET_ROLL) — pages 4–9
//     Collection: "Rugway — Soft Velvet"    (CARPET_ROLL) — pages 10–14
//     Collection: "Rugway — New Era"         (CARPET_ROLL) — pages 15–25
//       Design per page (RW-TD-04, RW-SV-10, RW-NE-15, …)
//         Colourway "Standard" with imageKey = /catalog/rugway-p{NN}.jpg
//           Price row RETAIL — placeholder ₹8,000 per SQFT (revise later)
//
// Also renders /public/catalog/rugway-p{NN}.jpg for every product
// page (idempotent — skips existing unless FORCE=1).
//
// Run:  pnpm tsx scripts/import-rugway-pdf.ts

import { PrismaClient, type SellUnit } from "@prisma/client";
import { pdf } from "pdf-to-img";
import { readFileSync } from "node:fs";
import { mkdir, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const PDF_PATH   = "c:\\Users\\Administrator\\Downloads\\product catalog\\Rugway Rugs-.pdf";
const OUT_DIR    = resolve(process.cwd(), "public", "catalog");
const IMAGE_ROUTE = "/catalog";
const FORCE      = process.env["FORCE"] === "1";

const BRAND_NAME = "Rug Way";
const HSN        = "5703";
const GST_PCT    = 12;
const SELL_UNIT: SellUnit = "SQFT";
const RATE_PAISE = 800000n; // ₹8,000 per sqft placeholder

interface SeriesConfig {
  code:           string;      // 2-letter series code used in SKU (TD, SV, NE)
  collectionName: string;
  hex:            string;
  fromPage:       number;
  toPage:         number;
}

const SERIES: readonly SeriesConfig[] = [
  { code: "TD", collectionName: "Rugway — Turkish Delight", hex: "#C7B79A", fromPage: 4,  toPage: 9  },
  { code: "SV", collectionName: "Rugway — Soft Velvet",     hex: "#9E8B77", fromPage: 10, toPage: 14 },
  { code: "NE", collectionName: "Rugway — New Era",         hex: "#7C5A44", fromPage: 15, toPage: 25 },
];

function seriesFor(pageNo: number): SeriesConfig {
  const s = SERIES.find((x) => pageNo >= x.fromPage && pageNo <= x.toPage);
  if (!s) throw new Error(`No series mapped for page ${pageNo}`);
  return s;
}

async function renderAllPages(): Promise<Map<number, string>> {
  await mkdir(OUT_DIR, { recursive: true });
  const document = await pdf(readFileSync(PDF_PATH), { scale: 1.5 });
  console.log(`PDF has ${document.length} pages, rendering product pages 4-25 at 1.5×`);
  const pageToPath = new Map<number, string>();
  let n = 0;
  for await (const jpg of document) {
    n += 1;
    if (n < 4 || n > 25) continue;
    const slug = `rugway-p${String(n).padStart(2, "0")}`;
    const out  = join(OUT_DIR, `${slug}.jpg`);
    if (FORCE || !existsSync(out)) {
      await writeFile(out, jpg);
      console.log(`  ✓ ${slug}.jpg  ${((jpg.length / 1024) | 0)} KB`);
    } else {
      const s = await stat(out);
      console.log(`  · ${slug}.jpg  ${((s.size / 1024) | 0)} KB (exists — skipped)`);
    }
    pageToPath.set(n, `${IMAGE_ROUTE}/${slug}.jpg`);
  }
  return pageToPath;
}

async function main(): Promise<void> {
  if (!existsSync(PDF_PATH)) throw new Error(`Not found: ${PDF_PATH}`);

  const pageToImage = await renderAllPages();

  const db = new PrismaClient();
  try {
    const org = await db.organization.findFirst({ where: { name: "Mandovara" }, select: { id: true } });
    if (!org) throw new Error("Run scripts/bootstrap-admin.ts first.");

    const brand = await db.brand.upsert({
      where:  { organizationId_name: { organizationId: org.id, name: BRAND_NAME } },
      update: {},
      create: { organizationId: org.id, name: BRAND_NAME, country: "IN", leadTimeDays: 21 },
    });
    console.log(`\nBrand: ${brand.name} (${brand.id})`);

    // Upsert one Collection per series
    const collectionByCode = new Map<string, string>();
    for (const s of SERIES) {
      const col = await db.collection.upsert({
        where:  { organizationId_brandId_name: { organizationId: org.id, brandId: brand.id, name: s.collectionName } },
        update: { family: "RUG" as never },
        create: { organizationId: org.id, brandId: brand.id, name: s.collectionName, family: "RUG" as never },
      });
      collectionByCode.set(s.code, col.id);
    }

    let designs = 0, colourways = 0, prices = 0;
    const now = new Date();

    for (const [pageNo, imageUrl] of [...pageToImage.entries()].sort((a, b) => a[0] - b[0])) {
      const s = seriesFor(pageNo);
      const code = `RW-${s.code}-${String(pageNo).padStart(2, "0")}`;
      const name = `${s.collectionName.replace(/^Rugway — /, "")} — Sheet ${pageNo}`;

      const design = await db.design.upsert({
        where:  { organizationId_collectionId_code: { organizationId: org.id, collectionId: collectionByCode.get(s.code)!, code } },
        update: { name, family: "RUG" as never, hsn: HSN, gstRate: GST_PCT },
        create: {
          organizationId: org.id,
          collectionId:   collectionByCode.get(s.code)!,
          code,
          name,
          family:         "RUG" as never,
          hsn:            HSN,
          gstRate:        GST_PCT,
          specs:          { sourcedFrom: "Rugway Rugs-.pdf", sourcedOn: "2026-08-14", page: pageNo, series: s.collectionName },
        },
      });
      designs += 1;

      const cwCode = `${code}-STD`;
      const cw = await db.colourway.upsert({
        where:  { organizationId_code: { organizationId: org.id, code: cwCode } },
        update: { hex: s.hex, sellUnit: SELL_UNIT, imageKey: imageUrl },
        create: {
          organizationId: org.id,
          designId:       design.id,
          code:           cwCode,
          colourName:     "Standard",
          hex:            s.hex,
          sellUnit:       SELL_UNIT,
          imageKey:       imageUrl,
        },
      });
      colourways += 1;

      const existing = await db.price.findFirst({
        where:  { colourwayId: cw.id, tier: "RETAIL", effectiveTo: null },
        select: { id: true },
      });
      if (!existing) {
        await db.price.create({
          data: {
            organizationId: org.id,
            colourwayId:    cw.id,
            tier:           "RETAIL",
            amount:         RATE_PAISE,
            effectiveFrom:  now,
          },
        });
        prices += 1;
      }
    }

    console.log("\n" + "─".repeat(60));
    console.log(`  Designs upserted:    ${designs}`);
    console.log(`  Colourways upserted: ${colourways} (all with imageKey)`);
    console.log(`  New price rows:      ${prices}`);
    console.log("─".repeat(60));
    console.log("\n✓ Rugway Rugs imported. Browse: /products?categoryId=CARPET_ROLL");
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

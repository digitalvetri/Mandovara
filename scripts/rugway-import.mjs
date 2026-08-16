// Bulk-import the 44 cropped Rugway rugs.
//
// Each rug becomes one Colourway (the SKU). Brand "Rugway" and the
// "Rugs" collection under it are upserted once. Family = RUG.
// Code / price / name are left as safe placeholders (user said add
// later); code is RUG-001..044 in page order.
//
// Image file is copied from scripts/rugway-crops/rug-p{page}{slot}.jpg
// into public/catalog/uploads/{colourwayId}.jpg and imageKey pointed
// at /catalog/uploads/{colourwayId}.jpg?v={epoch}.
//
// Run: pnpm tsx scripts/rugway-import.mjs

import { PrismaClient } from "@prisma/client";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

const ORG_ID = "cmsvazyn20000f8dsbe8v8fhc"; // Mandovara org (from seed)
const BRAND_NAME = "Rugway";
const FAMILY = "RUG";
const HSN = "5703";
const GST_RATE = 12;
const SELL_UNIT = "PIECE";
const PLACEHOLDER_MRP_PAISE = 0n;

const CROPS_DIR = path.resolve("scripts", "rugway-crops");
const UPLOAD_DIR = path.resolve("public", "catalog", "uploads");
const PUBLIC_ROUTE = "/catalog/uploads";

// Deterministic list — top slot ("a") then bottom slot ("b") per page.
const jobs = [];
for (let page = 4; page <= 25; page++) {
  for (const slot of ["a", "b"]) {
    jobs.push({ page, slot, src: path.join(CROPS_DIR, `rug-p${String(page).padStart(2, "0")}${slot}.jpg`) });
  }
}

async function main() {
  await mkdir(UPLOAD_DIR, { recursive: true });

  // 1. Brand (upsert)
  const brand = await prisma.brand.upsert({
    where:  { organizationId_name: { organizationId: ORG_ID, name: BRAND_NAME } },
    create: { organizationId: ORG_ID, name: BRAND_NAME },
    update: {},
    select: { id: true },
  });

  // 2. Collection ("Rugs" under Rugway) — matches the action's naming
  //    scheme (family label as collection name).
  const collection = await prisma.collection.upsert({
    where:  { organizationId_brandId_name: { organizationId: ORG_ID, brandId: brand.id, name: "Rugs" } },
    create: { organizationId: ORG_ID, brandId: brand.id, name: "Rugs", family: FAMILY },
    update: {},
    select: { id: true },
  });

  console.log(`Brand: ${brand.id}  Collection: ${collection.id}`);

  const now = new Date();
  const created = [];

  let seq = 0;
  for (const job of jobs) {
    seq += 1;
    const code = `RUG-${String(seq).padStart(3, "0")}`;
    const name = `Rugway ${code}`;

    if (!existsSync(job.src)) {
      console.warn(`skip ${code}: crop missing at ${job.src}`);
      continue;
    }

    const design = await prisma.design.create({
      data: {
        organizationId: ORG_ID,
        collectionId:   collection.id,
        code,
        name,
        family:         FAMILY,
        hsn:            HSN,
        gstRate:        GST_RATE,
        specs:          { sourcedFrom: `Rugway Rugs- PDF`, page: job.page, slot: job.slot },
      },
      select: { id: true },
    });

    const cw = await prisma.colourway.create({
      data: {
        organizationId: ORG_ID,
        designId:       design.id,
        code,
        colourName:     "Standard",
        sellUnit:       SELL_UNIT,
      },
      select: { id: true },
    });

    await prisma.price.create({
      data: {
        organizationId: ORG_ID,
        colourwayId:    cw.id,
        tier:           "MRP",
        amount:         PLACEHOLDER_MRP_PAISE,
        effectiveFrom:  now,
      },
    });

    // Copy the crop into public/ and point imageKey at it.
    const buf = await readFile(job.src);
    const dst = path.join(UPLOAD_DIR, `${cw.id}.jpg`);
    await writeFile(dst, buf);
    const imageKey = `${PUBLIC_ROUTE}/${cw.id}.jpg?v=${Date.now()}`;
    await prisma.colourway.update({
      where: { id: cw.id },
      data:  { imageKey },
    });

    created.push({ code, cwId: cw.id, imageKey });
  }

  console.log(`\ninserted ${created.length} rugs`);
  console.log("first 3:", created.slice(0, 3));
  console.log("last 3:",  created.slice(-3));
}

main()
  .catch((e) => { console.error("FAIL:", e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

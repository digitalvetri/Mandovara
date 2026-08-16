// scripts/prod-reset-catalog.mjs
//
// Destructive one-shot: WIPE the current catalog (Brand + Collection +
// Design + Colourway + everything that FKs to Colourway) and REPLACE it
// with Rugway (44 rugs) + Fedora (26 designs, ~100 colourways). Copies
// every swatch image into the mounted volume so cards render real
// wallpaper/rug textures immediately.
//
// Baked into the Docker image at /app/scripts/prod-reset-catalog.mjs.
// Run inside the app container (Coolify → app service → Terminal):
//
//   CONFIRM_WIPE=I_UNDERSTAND node /app/scripts/prod-reset-catalog.mjs
//
// Refuses to run without CONFIRM_WIPE=I_UNDERSTAND so an accidental
// invocation is a no-op. Same guard style as wipe-demo-data.mjs.
//
// Assumes single-tenant Mandovara: looks up the Organization by name
// so it never targets a wrong org even if cuids differ between envs.
// Assumes the app has a default Branch — needed by Design foreign keys
// on rugway rows (Design.collection.brand is per-org, no branch fanout).

import { PrismaClient } from "@prisma/client";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

if (process.env.CONFIRM_WIPE !== "I_UNDERSTAND") {
  console.error("Refusing to run — set CONFIRM_WIPE=I_UNDERSTAND to proceed.");
  process.exit(1);
}

const ORG_NAME = "Mandovara";

// Source-image roots. Baked into the runtime image via Dockerfile COPY.
// Local dev runs from repo root; production runs from /app.
const SCRIPTS_ROOT = existsSync("/app/scripts/fedora-swatches")
  ? "/app/scripts"
  : path.resolve("scripts");
const FEDORA_SWATCHES = path.join(SCRIPTS_ROOT, "fedora-swatches");
const RUGWAY_CROPS    = path.join(SCRIPTS_ROOT, "rugway-crops");

// The upload target is the volume-mounted /app/public/catalog/uploads
// inside the container. Locally it's the same relative path from cwd.
const UPLOAD_DIR = existsSync("/app/public/catalog")
  ? "/app/public/catalog/uploads"
  : path.resolve("public", "catalog", "uploads");
const PUBLIC_ROUTE = "/catalog/uploads";

// Fedora catalogue map (from scripts/fedora-scan-codes.py + one manual
// override for 57225 whose labels are vector outlines).
const FEDORA_DESIGNS = [
  { code: "57233", detailPage: 10, colourways: [1, 2, 3, 4, 5, 6, 7] },
  { code: "57232", detailPage: 12, colourways: [1, 2, 3, 4, 5, 6] },
  { code: "57231", detailPage: 14, colourways: [1, 2, 4, 6, 7] },
  { code: "57230", detailPage: 16, colourways: [1, 3, 4, 5, 6] },
  { code: "57229", detailPage: 18, colourways: [1, 2, 3, 4, 5, 6] },
  { code: "57228", detailPage: 20, colourways: [1, 2, 3, 4, 5] },
  { code: "57226", detailPage: 22, colourways: [1, 3, 4, 5, 6] },
  { code: "57225", detailPage: 24, colourways: [3, 4] },
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

function fedoraSwatchPath(designCode, n) {
  for (const ext of ["jpg", "png"]) {
    const p = path.join(FEDORA_SWATCHES, `${designCode}-${n}.${ext}`);
    if (existsSync(p)) return { path: p, ext };
  }
  return null;
}

// Enumerate rug crops on disk instead of assuming (page, a/b) tuples.
// This lets us drop a slot (e.g. page 9 has only one product, no slot b)
// without leaving a gap in the RUG-XXX code sequence.
async function listRugwayCrops() {
  const entries = await readdir(RUGWAY_CROPS);
  return entries
    .filter((f) => /^rug-p\d{2}[a-z]\.jpg$/i.test(f))
    .sort();
}

async function main() {
  const prisma = new PrismaClient();
  try {
    // ── Pre-flight: verify data folders are present ─────────────
    for (const dir of [FEDORA_SWATCHES, RUGWAY_CROPS]) {
      if (!existsSync(dir)) {
        console.error(`Missing source directory: ${dir}`);
        console.error("Rebuild the image with these baked in (Dockerfile COPY step).");
        process.exit(1);
      }
    }
    await mkdir(UPLOAD_DIR, { recursive: true });

    // ── Resolve Organization by name (id differs between envs) ──
    const org = await prisma.organization.findFirst({
      where:  { name: ORG_NAME },
      select: { id: true, name: true },
    });
    if (!org) {
      console.error(`Organization "${ORG_NAME}" not found.`);
      process.exit(1);
    }
    console.log(`Target org: ${org.name} (${org.id})`);

    // ── Show what we're about to destroy ────────────────────────
    const before = await catalogCounts(prisma, org.id);
    console.log("\nBEFORE wipe:");
    for (const [k, v] of Object.entries(before)) console.log(`  ${k.padEnd(20)} ${v}`);

    // ── WIPE the catalog + everything that FKs into it ──────────
    // TRUNCATE with CASCADE follows every FK, so Price/StockBalance/
    // StockMove/Allocation die too. CalcResult.colourwayId FKs are
    // ON DELETE SET NULL in the schema (verified) so measurements
    // survive; their calc rows just lose their chosen colourway.
    // POLine.colourwayId + OrderLine.colourwayId cascade as defined.
    console.log("\nWiping catalog (TRUNCATE ... CASCADE) ...");
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        ALTER TABLE "StockMove" DISABLE TRIGGER USER;
        TRUNCATE TABLE
          "Colourway", "Design", "Collection", "Brand"
          RESTART IDENTITY CASCADE;
        ALTER TABLE "StockMove" ENABLE TRIGGER USER;
      END $$;
    `);

    // ── Rugway import (44 rugs) ─────────────────────────────────
    console.log("\nLoading Rugway ...");
    const rugCount = await importRugway(prisma, org.id);

    // ── Fedora import (26 designs, ~100 colourways) ─────────────
    console.log("\nLoading Fedora ...");
    const fed = await importFedora(prisma, org.id);

    // ── Report ──────────────────────────────────────────────────
    const after = await catalogCounts(prisma, org.id);
    console.log("\nAFTER load:");
    for (const [k, v] of Object.entries(after)) console.log(`  ${k.padEnd(20)} ${v}`);
    console.log(`\n✓ Done. Rugway: ${rugCount} rugs. Fedora: ${fed.designs} designs / ${fed.colourways} colourways.`);
  } finally {
    await prisma.$disconnect();
  }
}

async function catalogCounts(db, orgId) {
  const [brands, collections, designs, colourways, prices] = await Promise.all([
    db.brand.count({      where: { organizationId: orgId } }),
    db.collection.count({ where: { organizationId: orgId } }),
    db.design.count({     where: { organizationId: orgId } }),
    db.colourway.count({  where: { organizationId: orgId } }),
    db.price.count({      where: { organizationId: orgId } }),
  ]);
  return { brands, collections, designs, colourways, prices };
}

async function importRugway(db, orgId) {
  const brand = await db.brand.create({
    data:   { organizationId: orgId, name: "Rugway" },
    select: { id: true },
  });
  const collection = await db.collection.create({
    data:   { organizationId: orgId, brandId: brand.id, name: "Rugs", family: "RUG" },
    select: { id: true },
  });

  const now = new Date();
  const files = await listRugwayCrops();
  let count = 0;
  for (const cropFile of files) {
    count += 1;
    const code = `RUG-${String(count).padStart(3, "0")}`;
    const src  = path.join(RUGWAY_CROPS, cropFile);
    // Preserve provenance via the filename (rug-p09a.jpg) in specs, so
    // we can trace any single rug back to the PDF page + slot it came
    // from without depending on the sequential code alone.
    const design = await db.design.create({
      data: {
        organizationId: orgId,
        collectionId:   collection.id,
        code,
        name:           `Rugway ${code}`,
        family:         "RUG",
        hsn:            "5703",
        gstRate:        12,
        specs:          { sourcedFrom: "Rugway Rugs- PDF", cropFile },
      },
      select: { id: true },
    });
    const cw = await db.colourway.create({
      data: {
        organizationId: orgId,
        designId:       design.id,
        code,
        colourName:     "Standard",
        sellUnit:       "PIECE",
      },
      select: { id: true },
    });
    await db.price.create({
      data: {
        organizationId: orgId,
        colourwayId:    cw.id,
        tier:           "MRP",
        amount:         0n,
        effectiveFrom:  now,
      },
    });

    const buf = await readFile(src);
    const dst = path.join(UPLOAD_DIR, `${cw.id}.jpg`);
    await writeFile(dst, buf);
    await db.colourway.update({
      where: { id: cw.id },
      data:  { imageKey: `${PUBLIC_ROUTE}/${cw.id}.jpg?v=${Date.now()}` },
    });
  }
  return count;
}

async function importFedora(db, orgId) {
  const brand = await db.brand.create({
    data:   { organizationId: orgId, name: "GNI KOREA", country: "Korea" },
    select: { id: true },
  });
  const collection = await db.collection.create({
    data:   { organizationId: orgId, brandId: brand.id, name: "Fedora", family: "WALLPAPER" },
    select: { id: true },
  });

  const now = new Date();
  let designs = 0, colourways = 0, missing = 0;

  for (const spec of FEDORA_DESIGNS) {
    const design = await db.design.create({
      data: {
        organizationId: orgId,
        collectionId:   collection.id,
        code:           spec.code,
        name:           `Fedora ${spec.code}`,
        family:         "WALLPAPER",
        rollWidthMm:    530,
        rollLengthM:    10.05,
        hsn:            "4814",
        gstRate:        12,
        specs:          { sourcedFrom: "ARTBOOK VOL. 2 — Fedora GNI KOREA", detailPage: spec.detailPage },
      },
      select: { id: true },
    });
    designs += 1;

    for (const n of spec.colourways) {
      const cwCode = `${spec.code}-${n}`;
      const cw = await db.colourway.create({
        data: {
          organizationId: orgId,
          designId:       design.id,
          code:           cwCode,
          colourName:     `Colour ${n}`,
          sellUnit:       "ROLL",
        },
        select: { id: true },
      });
      colourways += 1;

      const s = fedoraSwatchPath(spec.code, n);
      if (s) {
        const buf = await readFile(s.path);
        const dst = path.join(UPLOAD_DIR, `${cw.id}.${s.ext}`);
        await writeFile(dst, buf);
        await db.colourway.update({
          where: { id: cw.id },
          data:  { imageKey: `${PUBLIC_ROUTE}/${cw.id}.${s.ext}?v=${Date.now()}` },
        });
      } else {
        missing += 1;
      }

      await db.price.create({
        data: {
          organizationId: orgId,
          colourwayId:    cw.id,
          tier:           "MRP",
          amount:         0n,
          effectiveFrom:  now,
        },
      });
    }
  }
  console.log(`  colourways without swatch: ${missing}`);
  return { designs, colourways };
}

main().catch((err) => {
  console.error("FAIL:", err?.message ?? err);
  process.exitCode = 1;
});

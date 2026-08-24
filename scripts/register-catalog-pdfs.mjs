// Register PDFs downloaded from Google Drive as browseable Brand + Collection
// entries — MIRRORING THE GOOGLE DRIVE FOLDER STRUCTURE.
//
// Drive has 4 shared folders:
//   1. LATEST WALLPAPER -CJS       → 13 PDFs
//   2. PLATINUM RANGE              → 11 PDFs
//   3. READY STOCK                 →  9 PDFs
//   4. Catalogues - Fedora Wallpapers → 27 PDFs
//
// Mapping:
//   Each source folder becomes ONE Brand (name cleaned up for display).
//   Each PDF inside becomes ONE Collection under that Brand.
//   catalogPdfKey = the slugified filename copied into /app/public/catalog/pdfs.
//
// The 72 pre-existing root PDFs at /pdfs/*.pdf are LEFT ALONE — they were on
// disk before the Drive sync and don't fit this brand grouping. If you want
// those registered too, we'll do it separately once you decide grouping.

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const CATALOG_DIR = "/app/public/catalog";
const PDFS_DIR    = path.join(CATALOG_DIR, "pdfs");

// [ folder-on-disk, brand-display-name ]
const BRAND_MAP = [
  ["LATEST WALLPAPER -CJS",             "Latest Wallpaper — CJS"],
  ["PLATINUM RANGE",                    "Platinum Range"],
  ["READY STOCK",                       "Ready Stock"],
  ["Catalogues - Fedora Wallpapers",    "Fedora Wallpapers"],
];

// Match the app's /api/catalog/pdf route SAFE_KEY: /^[a-zA-Z0-9_-]+\.pdf$/
function slugifyPdf(orig) {
  const base = path.basename(orig, ".pdf");
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "unnamed"}.pdf`;
}

// Turn "brahmos-cjs-4.pdf" → "Brahmos Cjs 4" (Collection display name)
function collectionNameFromSlug(slug) {
  const base = slug.replace(/\.pdf$/i, "");
  return base
    .split(/[-_]/)
    .filter((w) => w.length > 0)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function main() {
  const db  = new PrismaClient();
  const org = await db.organization.findFirst({ select: { id: true, name: true } });
  if (!org) { console.error("No Organization row found."); process.exit(1); }
  console.log(`Org: ${org.name}`);

  fs.mkdirSync(PDFS_DIR, { recursive: true });
  const takenSlugs = new Set(fs.readdirSync(PDFS_DIR).filter((f) => f.endsWith(".pdf")));

  let totalCollections = 0;

  for (const [folder, brandName] of BRAND_MAP) {
    const src = path.join(CATALOG_DIR, folder);
    if (!fs.existsSync(src)) {
      console.log(`  · skip missing: ${folder}`);
      continue;
    }

    const files = fs.readdirSync(src).filter((f) => /\.pdf$/i.test(f));
    console.log(`\n=== Brand: "${brandName}"   folder: "${folder}"   ${files.length} PDFs ===`);

    // Upsert the Brand (unique on org + name).
    const brand = await db.brand.upsert({
      where:  { organizationId_name: { organizationId: org.id, name: brandName } },
      update: {},
      create: { organizationId: org.id, name: brandName, isActive: true },
      select: { id: true },
    });

    for (const f of files) {
      // 1 · Slugify + de-collide
      let slug = slugifyPdf(f);
      if (takenSlugs.has(slug)) {
        let i = 2;
        const base = slug.replace(/\.pdf$/i, "");
        while (takenSlugs.has(`${base}-${i}.pdf`)) i++;
        slug = `${base}-${i}.pdf`;
      }
      takenSlugs.add(slug);

      // 2 · Move file into /pdfs/<slug>.pdf
      const target = path.join(PDFS_DIR, slug);
      fs.renameSync(path.join(src, f), target);

      // 3 · Upsert Collection under this brand
      const collectionName = collectionNameFromSlug(slug);
      await db.collection.upsert({
        where: {
          organizationId_brandId_name: {
            organizationId: org.id, brandId: brand.id, name: collectionName,
          },
        },
        update: { catalogPdfKey: slug, isActive: true },
        create: {
          organizationId: org.id, brandId: brand.id,
          name: collectionName, family: "WALLPAPER",
          catalogPdfKey: slug, isActive: true,
        },
      });
      totalCollections++;
      console.log(`   + ${collectionName}   (${slug})`);
    }

    // Remove the now-empty source folder.
    try {
      const remaining = fs.readdirSync(src);
      if (remaining.length === 0) { fs.rmdirSync(src); }
      else                        { console.log(`   (folder not empty, kept: ${folder})`); }
    } catch { /* silent */ }
  }

  console.log(`\n=== Summary ===`);
  const brandCount = await db.brand.count({ where: { organizationId: org.id } });
  const collWith   = await db.collection.count({
    where: { organizationId: org.id, catalogPdfKey: { not: null } },
  });
  console.log(`Total brands in DB:            ${brandCount}`);
  console.log(`Collections with catalogPdfKey: ${collWith}`);
  console.log(`New collections registered:    ${totalCollections}`);

  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

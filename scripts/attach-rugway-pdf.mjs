// scripts/attach-rugway-pdf.mjs
//
// Non-destructive: attach scripts/rugway-crops/rugway-rugs.pdf to the
// existing Rugway → Rugs collection so the "View PDF" button appears on
// /products/brand/[rugway-id]. Does NOT wipe or modify any other row.
//
// Baked into the runtime image so it can be run inside the app container:
//
//   node /app/scripts/attach-rugway-pdf.mjs
//
// Idempotent: re-running replaces the on-disk PDF with the current one and
// re-asserts catalogPdfKey. Safe to run after every deploy.
//
// The full prod-reset-catalog.mjs also attaches this PDF during its Rugway
// import — this script exists so we can attach the PDF WITHOUT wiping the
// live catalogue (which would drop projects, orders, stock refs, etc).

import { PrismaClient } from "@prisma/client";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ORG_NAME     = "Mandovara";
const BRAND_NAME   = "Rugway";
const COLLECTION   = "Rugs";

const SCRIPTS_ROOT = existsSync("/app/scripts/rugway-crops")
  ? "/app/scripts"
  : path.resolve("scripts");
const RUGWAY_PDF   = path.join(SCRIPTS_ROOT, "rugway-crops", "rugway-rugs.pdf");

const PDF_DIR = existsSync("/app/public/catalog")
  ? "/app/public/catalog/pdfs"
  : path.resolve("public", "catalog", "pdfs");

async function main() {
  if (!existsSync(RUGWAY_PDF)) {
    console.error(`Missing source PDF: ${RUGWAY_PDF}`);
    console.error("Rebuild the image so Dockerfile COPY picks up scripts/rugway-crops/rugway-rugs.pdf.");
    process.exit(1);
  }

  const prisma = new PrismaClient({
    datasourceUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  });

  try {
    const org = await prisma.organization.findFirst({
      where:  { name: ORG_NAME },
      select: { id: true, name: true },
    });
    if (!org) { console.error(`Organization "${ORG_NAME}" not found.`); process.exit(1); }

    const brand = await prisma.brand.findFirst({
      where:  { organizationId: org.id, name: BRAND_NAME },
      select: { id: true },
    });
    if (!brand) { console.error(`Brand "${BRAND_NAME}" not found — run prod-reset-catalog.mjs first.`); process.exit(1); }

    const col = await prisma.collection.findFirst({
      where:  { organizationId: org.id, brandId: brand.id, name: COLLECTION },
      select: { id: true, catalogPdfKey: true },
    });
    if (!col) { console.error(`Collection "${COLLECTION}" under "${BRAND_NAME}" not found.`); process.exit(1); }

    await mkdir(PDF_DIR, { recursive: true });
    const pdfKey  = `${col.id}.pdf`;
    const pdfDest = path.join(PDF_DIR, pdfKey);
    await writeFile(pdfDest, await readFile(RUGWAY_PDF));

    if (col.catalogPdfKey !== pdfKey) {
      await prisma.collection.update({
        where: { id: col.id },
        data:  { catalogPdfKey: pdfKey },
      });
    }

    console.log(`✓ Attached ${RUGWAY_PDF} → ${pdfDest}`);
    console.log(`  collectionId=${col.id}  catalogPdfKey=${pdfKey}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

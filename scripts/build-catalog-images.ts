// Convert catalogue PDFs → cover JPG + attach the whole PDF for
// flip-through browsing.
//
// Scans `PDF_DIR` recursively for *.pdf. For each PDF:
//   1. Renders page 1 at 1.5× scale via pdf-to-img (pure JS, no
//      system tools needed) → public/catalog/{slug}.jpg.
//   2. Copies the source PDF to public/catalog/pdfs/{slug}.pdf so
//      the PDP can embed it via the browser's built-in PDF viewer.
//   3. Matches the PDF's base name (case + separator insensitive) to
//      any Design in the DB and updates:
//         - Design.catalogPdfKey        = /catalog/pdfs/{slug}.pdf
//         - Colourway(-STD).imageKey    = /catalog/{slug}.jpg
//
// Idempotent — skips PDFs that already have a JPG on disk unless
// FORCE=1 is set. Matches are permissive; PDFs that don't match any
// Design still produce a JPG + copied PDF (so you can inspect them
// under public/catalog/), just no DB link is written.
//
// Run:  pnpm tsx scripts/build-catalog-images.ts
//       PDF_DIR="path/to/folder" pnpm tsx scripts/build-catalog-images.ts
//       FORCE=1 pnpm tsx scripts/build-catalog-images.ts   (re-render everything)

import { PrismaClient } from "@prisma/client";
import { pdf } from "pdf-to-img";
import { copyFile, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

const PDF_DIR      = process.env["PDF_DIR"] ?? "c:\\Users\\Administrator\\Downloads\\product catalog";
const OUT_DIR      = resolve(process.cwd(), "public", "catalog");
const PDF_OUT_DIR  = resolve(process.cwd(), "public", "catalog", "pdfs");
const IMAGE_ROUTE  = "/catalog";
const PDF_ROUTE    = "/catalog/pdfs";
const FORCE        = process.env["FORCE"] === "1";

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(PDF_OUT_DIR, { recursive: true });
  const db = new PrismaClient();
  try {
    const org = await db.organization.findFirst({ where: { name: "Mandovara" }, select: { id: true } });
    if (!org) throw new Error("Run scripts/bootstrap-admin.ts first.");

    // Preload every Design's normalised name → { designId, standardColourwayId }
    const designs = await db.design.findMany({
      where:  { organizationId: org.id },
      select: {
        id: true, name: true,
        colourways: { where: { code: { endsWith: "-STD" } }, select: { id: true, code: true } },
      },
    });
    const nameToTarget = new Map<string, { designId: string; colourwayId: string }>();
    for (const d of designs) {
      const key = normalise(d.name);
      const std = d.colourways[0];
      if (std && !nameToTarget.has(key)) {
        nameToTarget.set(key, { designId: d.id, colourwayId: std.id });
      }
    }
    console.log(`Loaded ${designs.length} designs, ${nameToTarget.size} with a Standard colourway.\n`);

    const pdfs = await findPdfs(PDF_DIR);
    console.log(`Found ${pdfs.length} PDF(s) under ${PDF_DIR}\n`);

    let rendered = 0, matched = 0, skipped = 0, pdfsCopied = 0;
    for (const pdfPath of pdfs) {
      const rawName  = basename(pdfPath, ".pdf");
      const slug     = slugify(rawName);
      const jpgOut   = join(OUT_DIR, `${slug}.jpg`);
      const pdfOut   = join(PDF_OUT_DIR, `${slug}.pdf`);

      // Render cover JPG (skip if it already exists and !FORCE)
      if (!FORCE && existsSync(jpgOut)) {
        skipped += 1;
      } else {
        try {
          const document = await pdf(pdfPath, { scale: 1.5 });
          const first   = await document.getPage(1);
          await writeFile(jpgOut, first);
          rendered += 1;
          console.log(`  ✓ ${slug.padEnd(40)} cover ${((first.length / 1024) | 0).toString().padStart(4)} KB`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(`  ✗ ${slug.padEnd(40)} ${msg}`);
          continue;
        }
      }

      // Copy the whole PDF so /products/[id] can serve it (skip if already copied and !FORCE)
      if (FORCE || !existsSync(pdfOut)) {
        try {
          await copyFile(pdfPath, pdfOut);
          pdfsCopied += 1;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(`  ✗ ${slug.padEnd(40)} PDF copy failed: ${msg}`);
        }
      }

      // Match + write DB links
      const key    = normalise(rawName);
      const target = matchOnce(nameToTarget, key);
      if (target) {
        await db.$transaction([
          db.colourway.update({
            where: { id: target.colourwayId },
            data:  { imageKey: `${IMAGE_ROUTE}/${slug}.jpg` },
          }),
          db.design.update({
            where: { id: target.designId },
            data:  { catalogPdfKey: `${PDF_ROUTE}/${slug}.pdf` },
          }),
        ]);
        matched += 1;
      }
    }

    console.log("\n" + "─".repeat(60));
    console.log(`  PDFs rendered:        ${rendered}`);
    console.log(`  Already had a JPG:    ${skipped}`);
    console.log(`  PDFs copied:          ${pdfsCopied}`);
    console.log(`  Linked to a design:   ${matched}`);
    console.log(`  Output folder:        ${OUT_DIR}`);
    console.log("─".repeat(60));
  } finally {
    await db.$disconnect();
  }
}

async function findPdfs(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(d: string): Promise<void> {
    let entries: string[] = [];
    try { entries = await readdir(d); } catch { return; }
    for (const e of entries) {
      const p = join(d, e);
      let s;
      try { s = await stat(p); } catch { continue; }
      if (s.isDirectory()) {
        // Skip our own PDF-output directory so a subsequent run doesn't scan
        // the copies we just wrote there.
        if (resolve(p) === PDF_OUT_DIR) continue;
        await walk(p);
      } else if (s.isFile() && extname(e).toLowerCase() === ".pdf") {
        out.push(p);
      }
    }
  }
  await walk(dir);
  return out.sort();
}

// Turn "ATHENA - CJS (5).pdf" → "athena", "SKY 1-CJS" → "sky-1".
function normalise(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .replace(/\(\d+\)/g, "")            // "(5)" revision number
    .replace(/\bcjs\b/g, "")            // supplier tag
    .replace(/[-_]+$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

function slugify(raw: string): string {
  return normalise(raw) || "unnamed";
}

// Consume the map entry on first match so a design with several
// PDFs (e.g. VOL 1 + VOL 2) only claims one cover.
//
// Match strategy:
//   1. Exact hit.
//   2. Token-overlap fallback: for each candidate design key, count
//      how many tokens of the design key appear in the PDF key.
//      The design with the highest overlap (min 1, min proportion
//      50% of its own tokens) wins. This beats blind first-word
//      prefix — "silver-moon-xvii-pdf" now correctly picks
//      "silver-moon" (2/2 tokens present) over "silver-oak" (1/2).
function matchOnce(
  map: Map<string, { designId: string; colourwayId: string }>,
  key: string,
): { designId: string; colourwayId: string } | null {
  const exact = map.get(key);
  if (exact) { map.delete(key); return exact; }

  const keyTokens = new Set(key.split("-").filter((t) => t.length >= 2));
  if (keyTokens.size === 0) return null;

  // Fuzzy fallback: only multi-token designs, and only when at least
  // TWO of the design's tokens appear in the PDF key. This blocks
  // "silver" alone from claiming SILVER-OAK when the PDF is
  // silver-moon-xviii, and blocks "garden" alone from stealing
  // SQUARE GARDEN when the PDF is mallow-garden. Single-token
  // designs (VIBE, HAPPY) rely on the exact-match branch above.
  const REQUIRED_SCORE = 2;
  let bestKey: string | null = null;
  let bestScore = 0;
  let bestRatio = 0;
  for (const [k, _] of map.entries()) {
    // Dedupe design tokens so a repeated word ("WALL INDEX WALL COVERING")
    // can't inflate the overlap score.
    const designTokens = [...new Set(k.split("-").filter((t) => t.length >= 2))];
    if (designTokens.length < 2) continue;
    const score = designTokens.filter((t) => keyTokens.has(t)).length;
    if (score < REQUIRED_SCORE) continue;
    const ratio = score / designTokens.length;
    if (score > bestScore || (score === bestScore && ratio > bestRatio)) {
      bestKey = k;
      bestScore = score;
      bestRatio = ratio;
    }
  }
  if (bestKey == null) return null;
  const v = map.get(bestKey)!;
  map.delete(bestKey);
  return v;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

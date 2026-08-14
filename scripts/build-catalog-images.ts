// Convert catalogue PDFs → cover JPGs → link to Colourway.imageKey.
//
// Scans `PDF_DIR` recursively for *.pdf. For each PDF:
//   1. Renders page 1 at 1.5× scale via pdf-to-img (pure JS, no
//      system tools needed).
//   2. Saves the JPG to public/catalog/{slug}.jpg where slug is the
//      normalised PDF filename.
//   3. Matches the PDF's base name (case + separator insensitive) to
//      any Design in the DB and updates its Standard colourway's
//      imageKey to `/catalog/{slug}.jpg`.
//
// Idempotent — skips PDFs that already have a JPG on disk unless
// FORCE=1 is set. Matches are permissive; PDFs that don't match any
// Design still produce a JPG (so you can inspect them under
// public/catalog/), just no DB link is written.
//
// Run:  pnpm tsx scripts/build-catalog-images.ts
//       FORCE=1 pnpm tsx scripts/build-catalog-images.ts   (re-render everything)

import { PrismaClient } from "@prisma/client";
import { pdf } from "pdf-to-img";
import { readdir, mkdir, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname, basename, resolve } from "node:path";

const PDF_DIR      = "c:\\Users\\Administrator\\Downloads\\product catalog";
const OUT_DIR      = resolve(process.cwd(), "public", "catalog");
const IMAGE_ROUTE  = "/catalog";
const FORCE        = process.env["FORCE"] === "1";

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const db = new PrismaClient();
  try {
    const org = await db.organization.findFirst({ where: { name: "Mandovara" }, select: { id: true } });
    if (!org) throw new Error("Run scripts/bootstrap-admin.ts first.");

    // Preload every Design's normalised name → colourway id
    const designs = await db.design.findMany({
      where:  { organizationId: org.id },
      select: {
        id: true, name: true,
        colourways: { where: { code: { endsWith: "-STD" } }, select: { id: true, code: true } },
      },
    });
    const nameToColourwayId = new Map<string, string>();
    for (const d of designs) {
      const key = normalise(d.name);
      const std = d.colourways[0];
      if (std && !nameToColourwayId.has(key)) nameToColourwayId.set(key, std.id);
    }
    console.log(`Loaded ${designs.length} designs, ${nameToColourwayId.size} with a Standard colourway.\n`);

    const pdfs = await findPdfs(PDF_DIR);
    console.log(`Found ${pdfs.length} PDF(s) under ${PDF_DIR}\n`);

    let rendered = 0, matched = 0, skipped = 0;
    for (const pdfPath of pdfs) {
      const rawName = basename(pdfPath, ".pdf");
      const slug    = slugify(rawName);
      const outPath = join(OUT_DIR, `${slug}.jpg`);

      if (!FORCE && existsSync(outPath)) {
        skipped += 1;
      } else {
        try {
          const document = await pdf(pdfPath, { scale: 1.5 });
          const first   = await document.getPage(1);
          await writeFile(outPath, first);
          rendered += 1;
          console.log(`  ✓ ${slug.padEnd(40)}  ${((first.length / 1024) | 0).toString().padStart(4)} KB`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(`  ✗ ${slug.padEnd(40)}  ${msg}`);
          continue;
        }
      }

      const key = normalise(rawName);
      const cwId = matchOnce(nameToColourwayId, key);
      if (cwId) {
        await db.colourway.update({
          where: { id: cwId },
          data:  { imageKey: `${IMAGE_ROUTE}/${slug}.jpg` },
        });
        matched += 1;
      }
    }

    console.log("\n" + "─".repeat(60));
    console.log(`  PDFs rendered:        ${rendered}`);
    console.log(`  Already had a JPG:    ${skipped}`);
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
      if (s.isDirectory()) await walk(p);
      else if (s.isFile() && extname(e).toLowerCase() === ".pdf") out.push(p);
    }
  }
  await walk(dir);
  return out.sort();
}

// Turn "ATHENA - CJS (5).pdf" → "athena", "SKY 1-CJS" → "sky-1",
// "Rugway Rugs-" → "rugway-rugs". Strip supplier/revision suffixes
// so the match key stays stable.
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
function matchOnce(map: Map<string, string>, key: string): string | null {
  const id = map.get(key);
  if (id) { map.delete(key); return id; }
  // Loose fallback: any key that starts with the same first word
  const first = key.split("-")[0] ?? "";
  if (first.length < 3) return null;
  for (const [k, v] of map.entries()) {
    if (k === first || k.startsWith(first + "-")) {
      map.delete(k);
      return v;
    }
  }
  return null;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

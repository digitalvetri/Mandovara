// Replace the low-res rug uploads with the hi-res 300 DPI re-renders.
// Uses Design.specs.page + Design.specs.slot (stored on original import)
// to find the matching hi-res crop.

import { PrismaClient } from "@prisma/client";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

const ORG_ID = "cmsvazyn20000f8dsbe8v8fhc";
const HI_DIR = path.resolve("scripts", "rugway-crops-hi");
const UPLOAD_DIR = path.resolve("public", "catalog", "uploads");
const PUBLIC_ROUTE = "/catalog/uploads";

const rugs = await prisma.colourway.findMany({
  where: { organizationId: ORG_ID, design: { family: "RUG" } },
  select: {
    id: true, code: true,
    design: { select: { specs: true } },
  },
  orderBy: { code: "asc" },
});

console.log(`swapping ${rugs.length} rug images…`);
let swapped = 0, missing = 0;
for (const cw of rugs) {
  const specs = cw.design.specs;
  const page = specs?.page;
  const slot = specs?.slot;
  if (!page || !slot) {
    console.warn(`${cw.code}: no page/slot in specs — skipping`);
    missing += 1;
    continue;
  }
  const src = path.join(HI_DIR, `rug-p${String(page).padStart(2, "0")}${slot}.jpg`);
  if (!existsSync(src)) {
    console.warn(`${cw.code}: missing ${src}`);
    missing += 1;
    continue;
  }
  const dst = path.join(UPLOAD_DIR, `${cw.id}.jpg`);
  const buf = await readFile(src);
  await writeFile(dst, buf);
  await prisma.colourway.update({
    where: { id: cw.id },
    data:  { imageKey: `${PUBLIC_ROUTE}/${cw.id}.jpg?v=${Date.now()}` },
  });
  swapped += 1;
}
console.log(`swapped ${swapped} · missing ${missing}`);
await prisma.$disconnect();

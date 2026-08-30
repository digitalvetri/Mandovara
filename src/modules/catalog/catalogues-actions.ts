"use server";

// Server actions for the /catalogues listing page.
//
// bulkAddCatalogues() takes a family + a pasted list of names, creates a
// Collection for each new one under an auto-managed "Catalogues" brand,
// and reports how many landed. Existing names (case-insensitive) are
// skipped so re-pasting the same list is a no-op.
//
// deleteCatalogue() removes a single collection row from the page — same
// safety rail as pdf-actions.ts::deleteCollection with cascade, so
// designs / colourways / prices go with it and the audit trail is
// preserved by refusing when downstream references exist.

import { revalidatePath } from "next/cache";
import type { ProductFamily } from "@prisma/client";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { scanTransactionalRefs } from "./refs-scan";
import { CATALOGUE_SEED } from "./catalogues-seed-data";

const CATALOGUES_BRAND_NAME = "Catalogues";
const MAX_NAME_LEN = 120;

export interface BulkAddResult {
  ok:       boolean;
  error?:   string;
  created:  number;
  skipped:  number;   // duplicates within brand
  invalid:  number;   // empty / too long
}

async function ensureCataloguesBrand(
  db:   ReturnType<typeof scoped>,
  orgId: string,
): Promise<{ id: string }> {
  const existing = await db.brand.findUnique({
    where:  { organizationId_name: { organizationId: orgId, name: CATALOGUES_BRAND_NAME } },
    select: { id: true },
  });
  if (existing) return existing;
  return db.brand.create({
    data:   { organizationId: orgId, name: CATALOGUES_BRAND_NAME, isActive: true },
    select: { id: true },
  });
}

// Normalise a pasted line into a display-ready name:
// - trim leading/trailing whitespace
// - collapse internal whitespace to single spaces
// - reject empty and over-long entries
function normalise(raw: string): string | null {
  const cleaned = raw.trim().replace(/\s+/g, " ");
  if (!cleaned) return null;
  if (cleaned.length > MAX_NAME_LEN) return null;
  return cleaned;
}

export async function bulkAddCatalogues(
  familyRaw: string,
  namesRaw:  string,
): Promise<BulkAddResult> {
  try {
    const ctx = await devContext();
    requirePermission(ctx, "catalog.create");
    const db = scoped(ctx);

    // Validate family against the enum. Prisma will reject invalid enum
    // values at query time, but a defensive check gives a nicer error.
    const validFamilies: readonly ProductFamily[] = [
      "CURTAIN_FABRIC", "SHEER", "LINING", "BLIND", "WALLPAPER", "FLOORING",
      "CARPET_ROLL", "CARPET_TILE", "RUG", "UPHOLSTERY_FABRIC", "FOAM_FILLING",
      "VERTICAL_GARDEN", "INTERIOR_FILM", "MURAL", "HARDWARE_TRACK",
      "HARDWARE_ROD", "MOTOR", "ACCESSORY", "SERVICE",
    ];
    if (!validFamilies.includes(familyRaw as ProductFamily)) {
      return { ok: false, error: "Unknown category.", created: 0, skipped: 0, invalid: 0 };
    }
    const family = familyRaw as ProductFamily;

    // Split, normalise, dedupe within the input.
    const seen = new Set<string>();
    let invalid = 0;
    const names: string[] = [];
    for (const raw of namesRaw.split(/\r?\n/)) {
      const n = normalise(raw);
      if (!n) { if (raw.trim() !== "") invalid++; continue; }
      const key = n.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      names.push(n);
    }
    if (names.length === 0) {
      return { ok: true, created: 0, skipped: 0, invalid };
    }

    const brand = await ensureCataloguesBrand(db, ctx.orgId);

    // Existing names in this brand — case-insensitive dedupe against DB.
    const existingRows = await db.collection.findMany({
      where:  { organizationId: ctx.orgId, brandId: brand.id },
      select: { name: true },
    });
    const existingKeys = new Set(existingRows.map((r) => r.name.toUpperCase()));

    let created = 0, skipped = 0;
    for (const name of names) {
      if (existingKeys.has(name.toUpperCase())) { skipped++; continue; }
      await db.collection.create({
        data: {
          organizationId: ctx.orgId,
          brandId:        brand.id,
          name,
          family,
          isActive:       true,
        },
      });
      created++;
    }

    revalidatePath("/catalogues");
    revalidatePath("/products");
    return { ok: true, created, skipped, invalid };
  } catch (err) {
    console.error("bulkAddCatalogues failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to add catalogues.",
      created: 0, skipped: 0, invalid: 0,
    };
  }
}

export interface SeedLoadResult {
  ok:       boolean;
  error?:   string;
  created:  number;
  skipped:  number;   // already existed
  byFamily: Array<{ family: ProductFamily; created: number; skipped: number }>;
}

// One-time load of the ~713 names baked in from CATALOGUE LIST.xlsx.
// Idempotent — re-running only creates missing rows. The button that
// calls this is only shown in the empty state on /catalogues.
export async function loadCataloguesFromSeed(): Promise<SeedLoadResult> {
  try {
    const ctx = await devContext();
    requirePermission(ctx, "catalog.create");
    const db = scoped(ctx);

    const brand = await ensureCataloguesBrand(db, ctx.orgId);

    // Pull existing names in this brand once — the seed loop below just
    // does membership checks, no per-row round-trip.
    const existingRows = await db.collection.findMany({
      where:  { organizationId: ctx.orgId, brandId: brand.id },
      select: { name: true },
    });
    const existingKeys = new Set(existingRows.map((r) => r.name.toUpperCase()));

    const byFamily: SeedLoadResult["byFamily"] = [];
    let totalCreated = 0, totalSkipped = 0;

    for (const bucket of CATALOGUE_SEED) {
      let created = 0, skipped = 0;
      for (const name of bucket.names) {
        if (existingKeys.has(name.toUpperCase())) { skipped++; continue; }
        await db.collection.create({
          data: {
            organizationId: ctx.orgId,
            brandId:        brand.id,
            name,
            family:         bucket.family,
            isActive:       true,
          },
        });
        existingKeys.add(name.toUpperCase());
        created++;
      }
      byFamily.push({ family: bucket.family, created, skipped });
      totalCreated += created;
      totalSkipped += skipped;
    }

    revalidatePath("/catalogues");
    revalidatePath("/products");
    return { ok: true, created: totalCreated, skipped: totalSkipped, byFamily };
  } catch (err) {
    console.error("loadCataloguesFromSeed failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to load starter list.",
      created: 0, skipped: 0, byFamily: [],
    };
  }
}

export async function deleteCatalogue(
  collectionId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const ctx = await devContext();
    requirePermission(ctx, "catalog.delete");
    const db = scoped(ctx);

    const col = await db.collection.findUniqueOrThrow({
      where:  { id: collectionId },
      select: {
        id: true,
        designs: { select: { id: true, colourways: { select: { id: true } } } },
      },
    });

    const designIds    = col.designs.map((d) => d.id);
    const colourwayIds = col.designs.flatMap((d) => d.colourways.map((cw) => cw.id));

    const blocking = await scanTransactionalRefs(db, colourwayIds, [col.id]);
    if (blocking) {
      return { ok: false, error: `Cannot delete: this catalogue is referenced by ${blocking}. Remove those first.` };
    }

    await db.$transaction([
      ...(colourwayIds.length > 0
        ? [
            db.calcResult.updateMany({ where: { colourwayId: { in: colourwayIds } }, data: { colourwayId: null } }),
            db.purchaseRequestLine.updateMany({ where: { colourwayId: { in: colourwayIds } }, data: { colourwayId: null } }),
            db.stockBalance.deleteMany({ where: { colourwayId: { in: colourwayIds } } }),
            db.price.deleteMany({ where: { colourwayId: { in: colourwayIds } } }),
            db.colourway.deleteMany({ where: { id: { in: colourwayIds } } }),
          ]
        : []),
      ...(designIds.length > 0
        ? [db.design.deleteMany({ where: { id: { in: designIds } } })]
        : []),
      db.collection.delete({ where: { id: col.id } }),
    ]);

    revalidatePath("/catalogues");
    revalidatePath("/products");
    return { ok: true };
  } catch (err) {
    console.error("deleteCatalogue failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Delete failed." };
  }
}

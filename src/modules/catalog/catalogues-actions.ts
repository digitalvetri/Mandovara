"use server";

// Server actions for /catalogues. Writes to the dedicated Catalogue
// model — entirely separate from the Brand / Collection tree that
// powers /products.
//
//   bulkAddCatalogues(family, names) — user paste-many; dedupes on
//     (org, uppercased name) both against the input and against the
//     table.
//   loadCataloguesFromSeed()        — one-time import of the 713 names
//     baked in from CATALOGUE LIST.xlsx.
//   deleteCatalogue(id)             — remove a single row. Catalogue is
//     a leaf model (no FKs pointing at it), so a plain delete is safe;
//     no cascade or transactional-ref scan needed.

import { revalidatePath } from "next/cache";
import type { ProductFamily } from "@prisma/client";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { CATALOGUE_SEED } from "./catalogues-seed-data";

const MAX_NAME_LEN = 120;

const VALID_FAMILIES: readonly ProductFamily[] = [
  "CURTAIN_FABRIC", "SHEER", "LINING", "BLIND", "WALLPAPER", "FLOORING",
  "CARPET_ROLL", "CARPET_TILE", "RUG", "UPHOLSTERY_FABRIC", "FOAM_FILLING",
  "VERTICAL_GARDEN", "INTERIOR_FILM", "MURAL", "HARDWARE_TRACK",
  "HARDWARE_ROD", "MOTOR", "ACCESSORY", "SERVICE",
];

export interface BulkAddResult {
  ok:       boolean;
  error?:   string;
  created:  number;
  skipped:  number;   // duplicates against DB
  invalid:  number;   // empty / too long
}

export interface SeedLoadResult {
  ok:       boolean;
  error?:   string;
  created:  number;
  skipped:  number;
  byFamily: Array<{ family: ProductFamily; created: number; skipped: number }>;
}

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

    if (!VALID_FAMILIES.includes(familyRaw as ProductFamily)) {
      return { ok: false, error: "Unknown category.", created: 0, skipped: 0, invalid: 0 };
    }
    const family = familyRaw as ProductFamily;

    // Dedupe within input first.
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

    // Existing keys — case-insensitive.
    const existingRows = await db.catalogue.findMany({
      where:  { organizationId: ctx.orgId },
      select: { name: true },
    });
    const existingKeys = new Set(existingRows.map((r) => r.name.toUpperCase()));

    let created = 0, skipped = 0;
    for (const name of names) {
      if (existingKeys.has(name.toUpperCase())) { skipped++; continue; }
      await db.catalogue.create({
        data: {
          organizationId: ctx.orgId,
          name,
          family,
          isActive: true,
        },
      });
      existingKeys.add(name.toUpperCase());
      created++;
    }

    revalidatePath("/catalogues");
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

export async function loadCataloguesFromSeed(): Promise<SeedLoadResult> {
  try {
    const ctx = await devContext();
    requirePermission(ctx, "catalog.create");
    const db = scoped(ctx);

    // Pull existing rows with id + family so we can upsert-and-move on
    // re-runs: if a row already exists under the wrong family (e.g.
    // PAMPLETS names that used to sit under CARPET_ROLL and are now
    // classified as RUG), a re-run corrects the family in place.
    const existingRows = await db.catalogue.findMany({
      where:  { organizationId: ctx.orgId },
      select: { id: true, name: true, family: true },
    });
    const existing = new Map(
      existingRows.map((r) => [r.name.toUpperCase(), r]),
    );

    const byFamily: SeedLoadResult["byFamily"] = [];
    let totalCreated = 0, totalSkipped = 0;

    for (const bucket of CATALOGUE_SEED) {
      let created = 0, skipped = 0;
      for (const name of bucket.names) {
        const hit = existing.get(name.toUpperCase());
        if (hit) {
          if (hit.family !== bucket.family) {
            await db.catalogue.update({
              where: { id: hit.id },
              data:  { family: bucket.family },
            });
          }
          skipped++;
          continue;
        }
        const created_ = await db.catalogue.create({
          data: {
            organizationId: ctx.orgId,
            name,
            family:         bucket.family,
            isActive:       true,
          },
          select: { id: true, name: true, family: true },
        });
        existing.set(name.toUpperCase(), created_);
        created++;
      }
      byFamily.push({ family: bucket.family, created, skipped });
      totalCreated += created;
      totalSkipped += skipped;
    }

    revalidatePath("/catalogues");
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
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const ctx = await devContext();
    requirePermission(ctx, "catalog.delete");
    const db = scoped(ctx);

    await db.catalogue.delete({ where: { id } });

    revalidatePath("/catalogues");
    return { ok: true };
  } catch (err) {
    console.error("deleteCatalogue failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Delete failed." };
  }
}

"use server";

// Server action: catalog design bulk import.
// Calls the pure parser, then resolves brand/collection refs and writes to DB.
// Partial success: valid rows are committed even when some rows error.

import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import type { ActionResult } from "./actions";
import { parseDesignRows, type ImportError } from "./import-parser";
import { ProductFamilyEnum, PatternMatchEnum } from "./schema";
import type { z } from "zod";

export interface ImportResult {
  imported: number;
  skippedDuplicates: number;
  errors: ImportError[];
}

// Shape of a row we'll pass to db.design.createMany — avoids importing @prisma/client
// in a module file. Types align with the generated Prisma client via structural compatibility.
type DesignInsertRow = {
  organizationId: string;
  collectionId: string;
  code: string;
  name: string;
  family: z.infer<typeof ProductFamilyEnum>;
  hsn: string;
  gstRate: number;
  rollWidthMm: number | null;
  rollLengthM: number | null;
  fabricWidthMm: number | null;
  patternRepeatMm: number | null;
  patternMatch: z.infer<typeof PatternMatchEnum>;
  railroadable: boolean;
  gsm: number | null;
  areaPerBoxSqft: number | null;
  tileSizeMm: string | null;
  specs: Record<string, unknown>;
};

export async function importDesigns(
  formData: FormData,
): Promise<ActionResult<ImportResult>> {
  const ctx = await devContext();
  requirePermission(ctx, "catalog.create");

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return { ok: false, error: "No file uploaded" };
  }
  const name = file.name.toLowerCase();
  if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
    return { ok: false, error: "File must be an Excel workbook (.xlsx or .xls)" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { valid, errors } = parseDesignRows(buffer);

  if (valid.length === 0) {
    return { ok: true, data: { imported: 0, skippedDuplicates: 0, errors } };
  }

  const db = scoped(ctx);

  // Resolve brand names → IDs (only brands that exist in this org)
  const brandNames = [...new Set(valid.map((r) => r.brandName))];
  const brands = await db.brand.findMany({
    where: { name: { in: brandNames } },
    select: { id: true, name: true },
  });
  const brandMap = new Map(brands.map((b) => [b.name, b.id]));

  // Fetch all collections under resolved brands (avoids complex OR filter)
  const brandIds = [...brandMap.values()];
  const collections = await db.collection.findMany({
    where: { brandId: { in: brandIds } },
    select: { id: true, name: true, brandId: true, family: true },
  });
  // Lookup: "brandId||collectionName||family" → collectionId
  const collMap = new Map(
    collections.map((c) => [`${c.brandId}||${c.name}||${c.family}`, c.id]),
  );

  // Pre-fetch codes that already exist in DB to catch duplicates before insert
  const allCodes = valid.map((r) => r.code);
  const existingDesigns = await db.design.findMany({
    where: { code: { in: allCodes } },
    select: { code: true },
  });
  const existingCodeSet = new Set(existingDesigns.map((d) => d.code));

  // Walk valid rows, resolve references, build insert list
  const allErrors: ImportError[] = [...errors];
  const toInsert: DesignInsertRow[] = [];
  const queued = new Set<string>(); // guard against post-parse dupes (shouldn't happen)

  for (const row of valid) {
    const brandId = brandMap.get(row.brandName);
    if (!brandId) {
      allErrors.push({
        row: row.rowNumber,
        field: "brand_name",
        reason: `Brand "${row.brandName}" not found in catalog`,
      });
      continue;
    }

    const collKey = `${brandId}||${row.collectionName}||${row.family}`;
    const collectionId = collMap.get(collKey);
    if (!collectionId) {
      allErrors.push({
        row: row.rowNumber,
        field: "collection_name",
        reason: `Collection "${row.collectionName}" (${row.family}) not found under brand "${row.brandName}"`,
      });
      continue;
    }

    if (existingCodeSet.has(row.code)) {
      allErrors.push({
        row: row.rowNumber,
        field: "design_code",
        reason: `Design code "${row.code}" already exists in the catalog`,
      });
      continue;
    }

    if (queued.has(row.code)) continue;
    queued.add(row.code);

    toInsert.push({
      organizationId: ctx.orgId,
      collectionId,
      code: row.code,
      name: row.name,
      family: row.family,
      hsn: row.hsn,
      gstRate: row.gstRate,
      rollWidthMm: row.rollWidthMm,
      rollLengthM: row.rollLengthM,
      fabricWidthMm: row.fabricWidthMm,
      patternRepeatMm: row.patternRepeatMm,
      patternMatch: row.patternMatch,
      railroadable: row.railroadable,
      gsm: row.gsm,
      areaPerBoxSqft: row.areaPerBoxSqft,
      tileSizeMm: row.tileSizeMm,
      specs: {},
    });
  }

  let imported = 0;
  let skippedDuplicates = 0;
  if (toInsert.length > 0) {
    const result = await db.design.createMany({
      data: toInsert,
      skipDuplicates: true,
    });
    imported = result.count;
    skippedDuplicates = toInsert.length - result.count;
  }

  revalidatePath("/catalog");
  return {
    ok: true,
    data: { imported, skippedDuplicates, errors: allErrors },
  };
}

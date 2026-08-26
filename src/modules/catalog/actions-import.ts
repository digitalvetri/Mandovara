"use server";

// Baseline catalog importer — reads the pre-extracted CATALOG_IMPORT_ROWS
// (produced by scripts/extract-catalog.ts from the owner's WALLAPPER
// STOCK LIST xlsx) and materialises Brand → Collection → Design →
// Colourway → Price. No StockBalance rows are written — those are the
// stock importer's job. Catalog entries live in /products and drive
// the browsable Product Catalog surface even before any inventory
// exists.
//
// Idempotent — every write is upsert-shaped: brands/collections/designs
// are only created when missing, and the RETAIL price is only inserted
// if a live one doesn't already exist for that colourway.

import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import {
  CATALOG_IMPORT_ROWS,
  type CatalogImportRow,
} from "@/modules/catalog-import/data";
import type { ProductFamily, SellUnit } from "@prisma/client";

export interface ImportBaselineCatalogResult {
  ok:                boolean;
  rowsProcessed:     number;
  brandsCreated:     number;
  collectionsCreated:number;
  designsCreated:    number;
  colourwaysCreated: number;
  pricesCreated:     number;
  errors:            string[];
}

export async function importBaselineCatalog(): Promise<ImportBaselineCatalogResult> {
  const ctx = await devContext();
  requirePermission(ctx, "catalog.create");

  const result: ImportBaselineCatalogResult = {
    ok: true,
    rowsProcessed: 0, brandsCreated: 0, collectionsCreated: 0,
    designsCreated: 0, colourwaysCreated: 0, pricesCreated: 0,
    errors: [],
  };

  const now = new Date();

  for (const row of CATALOG_IMPORT_ROWS) {
    try {
      await withTransaction(async (tx: TxClient) => {
        await importOneRow(tx, row, ctx.orgId, now, result);
      }, { orgId: ctx.orgId });
      result.rowsProcessed++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`${row.collection}/${row.designName}: ${msg}`);
    }
  }

  result.ok = result.errors.length === 0;
  revalidatePath("/products");
  return result;
}

async function importOneRow(
  tx:    TxClient,
  row:   CatalogImportRow,
  orgId: string,
  now:   Date,
  acc:   ImportBaselineCatalogResult,
): Promise<void> {
  let brand = await tx.brand.findFirst({
    where:  { organizationId: orgId, name: row.brand },
    select: { id: true },
  });
  if (!brand) {
    brand = await tx.brand.create({
      data:   { organizationId: orgId, name: row.brand, country: "IN", leadTimeDays: 14 },
      select: { id: true },
    });
    acc.brandsCreated++;
  }

  let coll = await tx.collection.findFirst({
    where:  { organizationId: orgId, brandId: brand.id, name: row.collection },
    select: { id: true },
  });
  if (!coll) {
    coll = await tx.collection.create({
      data: {
        organizationId: orgId,
        brandId:        brand.id,
        name:           row.collection,
        family:         row.family as ProductFamily,
      },
      select: { id: true },
    });
    acc.collectionsCreated++;
  }

  let design = await tx.design.findFirst({
    where:  { organizationId: orgId, collectionId: coll.id, code: row.designCode },
    select: { id: true },
  });
  if (!design) {
    design = await tx.design.create({
      data: {
        organizationId: orgId,
        collectionId:   coll.id,
        code:           row.designCode,
        name:           row.designName,
        family:         row.family as ProductFamily,
        hsn:            row.hsn,
        gstRate:        new Decimal(row.gstRatePct),
        specs:          { sourcedFrom: "WALLAPPER STOCK LIST.xlsx" },
      },
      select: { id: true },
    });
    acc.designsCreated++;
  }

  let cw = await tx.colourway.findFirst({
    where:  { organizationId: orgId, designId: design.id, code: row.colourwayCode },
    select: { id: true },
  });
  if (!cw) {
    cw = await tx.colourway.create({
      data: {
        organizationId: orgId,
        designId:       design.id,
        code:           row.colourwayCode,
        colourName:     "Standard",
        hex:            row.hex,
        sellUnit:       row.sellUnit as SellUnit,
      },
      select: { id: true },
    });
    acc.colourwaysCreated++;
  }

  const existingPrice = await tx.price.findFirst({
    where:  { colourwayId: cw.id, tier: "RETAIL", effectiveTo: null },
    select: { id: true },
  });
  if (!existingPrice) {
    await tx.price.create({
      data: {
        organizationId: orgId,
        colourwayId:    cw.id,
        tier:           "RETAIL",
        amount:         BigInt(row.ratePaise),
        effectiveFrom:  now,
      },
    });
    acc.pricesCreated++;
  }
}

"use server";

// Baseline stock importer — reads the pre-extracted STOCK_IMPORT_ROWS
// (produced by scripts/extract-stock.ts from the owner's WALLAPPER
// STOCK LIST xlsx) and materialises the full catalog + stock chain in
// one go.
//
// Same shape as /api/admin/import-stock (which is gated by
// IMPORT_TOKEN), but exposed as a server action so the owner can
// trigger it from a UI button on /inventory. Idempotent — every write
// is upsert-shaped; the StockBalance value is REPLACED with the sheet
// quantity and a StockMove ADJUSTMENT records the delta so the ledger
// stays honest under re-runs.

import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { STOCK_IMPORT_ROWS, type StockImportRow } from "@/modules/stock-import/data";

export interface ImportBaselineStockResult {
  ok:                boolean;
  rowsProcessed:     number;
  brandsCreated:     number;
  collectionsCreated:number;
  designsCreated:    number;
  colourwaysCreated: number;
  stockBalancesSet:  number;
  errors:            string[];
}

interface FamilyMeta { readonly hsn: string; readonly gstRate: number }
const FAMILY_META: Record<StockImportRow["family"], FamilyMeta> = {
  WALLPAPER:      { hsn: "4814", gstRate: 12 },
  FLOORING:       { hsn: "3918", gstRate: 18 },
  HARDWARE_TRACK: { hsn: "3925", gstRate: 18 },
};

export async function importBaselineStock(): Promise<ImportBaselineStockResult> {
  const ctx = await devContext();
  requirePermission(ctx, "inventory.adjust");

  const result: ImportBaselineStockResult = {
    ok: true,
    rowsProcessed: 0, brandsCreated: 0, collectionsCreated: 0,
    designsCreated: 0, colourwaysCreated: 0, stockBalancesSet: 0,
    errors: [],
  };

  for (const row of STOCK_IMPORT_ROWS) {
    try {
      await withTransaction(async (tx: TxClient) => {
        await importOneRow(tx, row, ctx.orgId, ctx.userId, result);
      }, { orgId: ctx.orgId });
      result.rowsProcessed++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`${row.brand}/${row.collection}/${row.code}: ${msg}`);
    }
  }

  result.ok = result.errors.length === 0;
  revalidatePath("/inventory");
  revalidatePath("/products");
  return result;
}

async function importOneRow(
  tx:     TxClient,
  row:    StockImportRow,
  orgId:  string,
  userId: string,
  acc:    ImportBaselineStockResult,
): Promise<void> {
  const meta = FAMILY_META[row.family];

  let brand = await tx.brand.findFirst({
    where:  { organizationId: orgId, name: row.brand },
    select: { id: true },
  });
  if (!brand) {
    brand = await tx.brand.create({
      data:   { organizationId: orgId, name: row.brand },
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
        family:         row.family,
      },
      select: { id: true },
    });
    acc.collectionsCreated++;
  }

  let design = await tx.design.findFirst({
    where:  { organizationId: orgId, collectionId: coll.id, code: row.code },
    select: { id: true },
  });
  if (!design) {
    design = await tx.design.create({
      data: {
        organizationId: orgId,
        collectionId:   coll.id,
        code:           row.code,
        name:           row.name,
        family:         row.family,
        specs:          row.notes ? { notes: row.notes } : {},
        hsn:            meta.hsn,
        gstRate:        new Decimal(meta.gstRate),
      },
      select: { id: true },
    });
    acc.designsCreated++;
  }

  let cw = await tx.colourway.findFirst({
    where:  { organizationId: orgId, designId: design.id },
    select: { id: true },
  });
  if (!cw) {
    cw = await tx.colourway.create({
      data: {
        organizationId: orgId,
        designId:       design.id,
        code:           row.code,
        colourName:     "Default",
        sellUnit:       row.sellUnit,
      },
      select: { id: true },
    });
    acc.colourwaysCreated++;
  }

  const targetQty = new Decimal(row.quantity);
  const existing = await tx.stockBalance.findFirst({
    where:  { colourwayId: cw.id, dyeLot: null },
    select: { id: true, quantity: true },
  });
  const curQty = existing ? new Decimal(existing.quantity) : new Decimal(0);
  const delta  = targetQty.minus(curQty);

  if (!delta.equals(0)) {
    await tx.stockMove.create({
      data: {
        organizationId: orgId,
        colourwayId:    cw.id,
        dyeLot:         null,
        type:           "ADJUSTMENT",
        quantity:       delta.abs(),
        rate:           0n,
        refType:        "ADJUSTMENT",
        refId:          "adjust-STOCK_IMPORT",
        occurredAt:     new Date(),
        createdById:    userId,
      },
    });
  }
  if (existing) {
    await tx.stockBalance.update({
      where: { id: existing.id },
      data:  { quantity: targetQty },
    });
  } else {
    await tx.stockBalance.create({
      data: {
        organizationId: orgId,
        colourwayId:    cw.id,
        dyeLot:         null,
        quantity:       targetQty,
        value:          0n,
      },
    });
  }
  acc.stockBalancesSet++;
}

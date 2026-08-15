// One-shot stock importer for the seed batch from the user's Excel.
// Gated by X-Import-Token so it can sit in prod safely.
//
// Usage:
//   curl -X POST http://<host>/api/admin/import-stock?dry=1 \
//        -H "X-Import-Token: $IMPORT_TOKEN"
//   curl -X POST http://<host>/api/admin/import-stock \
//        -H "X-Import-Token: $IMPORT_TOKEN"
//
// Upsert semantics:
//   - Brand: created if missing, reused if present
//   - Collection: created if missing, reused if present
//   - Design: created if missing, reused if present
//   - Colourway: one default per Design; created if missing
//   - StockBalance: for (colourway, dyeLot=null), quantity is REPLACED
//     with the sheet value + a StockMove ADJUSTMENT row records the delta
//     so the ledger stays honest.

import { NextResponse } from "next/server";
import { Prisma } from "@/kernel/numbering/series";
import { prisma } from "@/kernel/db/client";
import { STOCK_IMPORT_ROWS, type StockImportRow } from "@/modules/stock-import/data";

// Prisma.Decimal is the runtime Decimal ctor exported through the Prisma
// namespace — avoids a second import of @prisma/client/runtime/library.
const { Decimal } = Prisma;

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";

interface FamilyMeta { readonly hsn: string; readonly gstRate: number }
const FAMILY_META: Record<StockImportRow["family"], FamilyMeta> = {
  WALLPAPER:      { hsn: "4814", gstRate: 12 },
  FLOORING:       { hsn: "3918", gstRate: 18 },
  HARDWARE_TRACK: { hsn: "3925", gstRate: 18 },
};

interface ImportResult {
  ok:                boolean;
  dryRun:            boolean;
  organizationId:    string;
  rowsProcessed:     number;
  brandsCreated:     number;
  collectionsCreated:number;
  designsCreated:    number;
  colourwaysCreated: number;
  stockBalancesSet:  number;
  errors:            string[];
}

export async function POST(req: Request): Promise<NextResponse<ImportResult | { error: string }>> {
  const provided = req.headers.get("x-import-token");
  const expected = process.env["IMPORT_TOKEN"];
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry") === "1";

  const org = await prisma.organization.findFirst({ select: { id: true } });
  if (!org) {
    return NextResponse.json({ error: "no organization in DB" }, { status: 412 });
  }
  const owner = await prisma.user.findFirst({
    where:  { organizationId: org.id, role: "OWNER", status: "ACTIVE" },
    select: { id: true },
  });
  if (!owner) {
    return NextResponse.json({ error: "no active OWNER user in DB" }, { status: 412 });
  }

  const result: ImportResult = {
    ok: true, dryRun, organizationId: org.id,
    rowsProcessed: 0, brandsCreated: 0, collectionsCreated: 0,
    designsCreated: 0, colourwaysCreated: 0, stockBalancesSet: 0,
    errors: [],
  };

  // Dry-run: just count what would be new vs. existing.
  if (dryRun) {
    const brandNames  = new Set(STOCK_IMPORT_ROWS.map((r) => r.brand));
    const collectionKeys = new Set(STOCK_IMPORT_ROWS.map((r) => `${r.brand}|${r.collection}`));
    const designCodes = new Set(STOCK_IMPORT_ROWS.map((r) => r.code));
    const existingBrands = await prisma.brand.findMany({
      where:  { organizationId: org.id, name: { in: [...brandNames] } },
      select: { name: true },
    });
    const existingDesigns = await prisma.design.findMany({
      where:  { organizationId: org.id, code: { in: [...designCodes] } },
      select: { code: true },
    });
    result.rowsProcessed     = STOCK_IMPORT_ROWS.length;
    result.brandsCreated     = brandNames.size - existingBrands.length;
    result.collectionsCreated= collectionKeys.size;   // approx (would need a per-brand check)
    result.designsCreated    = designCodes.size - existingDesigns.length;
    result.colourwaysCreated = result.designsCreated;
    result.stockBalancesSet  = STOCK_IMPORT_ROWS.length;
    return NextResponse.json(result);
  }

  // Real run — one transaction per row so partial failure is contained.
  for (const row of STOCK_IMPORT_ROWS) {
    try {
      await prisma.$transaction(async (tx) => {
        const meta = FAMILY_META[row.family];

        // Brand
        let brand = await tx.brand.findFirst({
          where:  { organizationId: org.id, name: row.brand },
          select: { id: true },
        });
        if (!brand) {
          brand = await tx.brand.create({
            data:   { organizationId: org.id, name: row.brand },
            select: { id: true },
          });
          result.brandsCreated++;
        }

        // Collection
        let coll = await tx.collection.findFirst({
          where:  { organizationId: org.id, brandId: brand.id, name: row.collection },
          select: { id: true },
        });
        if (!coll) {
          coll = await tx.collection.create({
            data: {
              organizationId: org.id,
              brandId:        brand.id,
              name:           row.collection,
              family:         row.family,
            },
            select: { id: true },
          });
          result.collectionsCreated++;
        }

        // Design (find by unique triple, else create)
        let design = await tx.design.findFirst({
          where:  { organizationId: org.id, collectionId: coll.id, code: row.code },
          select: { id: true },
        });
        if (!design) {
          design = await tx.design.create({
            data: {
              organizationId: org.id,
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
          result.designsCreated++;
        }

        // Colourway (one default per design, reused across imports)
        let cw = await tx.colourway.findFirst({
          where:  { organizationId: org.id, designId: design.id },
          select: { id: true },
        });
        if (!cw) {
          cw = await tx.colourway.create({
            data: {
              organizationId: org.id,
              designId:       design.id,
              code:           row.code,
              colourName:     "Default",
              sellUnit:       row.sellUnit,
            },
            select: { id: true },
          });
          result.colourwaysCreated++;
        }

        // StockBalance for (colourway, dyeLot=null): set to the sheet value.
        // If different from current, write an ADJUSTMENT StockMove for the delta.
        const targetQty = new Prisma.Decimal(row.quantity);
        const existing = await tx.stockBalance.findFirst({
          where:  { colourwayId: cw.id, dyeLot: null },
          select: { id: true, quantity: true, value: true },
        });
        const curQty = existing ? new Prisma.Decimal(existing.quantity) : new Prisma.Decimal(0);
        const delta  = targetQty.minus(curQty);

        if (!delta.equals(0)) {
          await tx.stockMove.create({
            data: {
              organizationId: org.id,
              colourwayId:    cw.id,
              dyeLot:         null,
              type:           "ADJUSTMENT",
              quantity:       delta.abs(),
              rate:           0n,
              refType:        "ADJUSTMENT",
              refId:          "adjust-STOCK_IMPORT",
              occurredAt:     new Date(),
              createdById:    owner.id,
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
              organizationId: org.id,
              colourwayId:    cw.id,
              dyeLot:         null,
              quantity:       targetQty,
              value:          0n,
            },
          });
        }
        result.stockBalancesSet++;
      });
      result.rowsProcessed++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`${row.brand}/${row.collection}/${row.code}: ${msg}`);
    }
  }

  result.ok = result.errors.length === 0;
  return NextResponse.json(result);
}

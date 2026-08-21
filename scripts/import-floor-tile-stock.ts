// Import FLOOR TILE 4.8.26 stock into the Mandovara system.
//
// Source: WALLAPPER STOCK LIST (2) (2) (4) (1).xlsx — sheet "FLOOR TILE 4.8.26"
// Delivery date: 4 August 2026 (matches BRAHMOS sheet date)
// Product: PVC Floor Tile Strips, 1.5mm thickness
// 20 colour codes, quantities in BOX (stored as text "10 BOX" in Excel)
//
// What this script creates:
//   1. Collection "PVC Floor Tile Strips 1.5mm" under Ready Stock brand
//   2. 20 Design records (codes 1505–1524 minus 1516, plus 1572)
//   3. 20 Colourway records (same codes, sell unit BOX)
//   4. 1 GRN record (MDV/GRN-2608-0003, dated 2026-08-04)
//   5. 20 GRNLine records (qty parsed from "N BOX" text, dye lot "4.8.26")
//   6. 20 StockBalance + 20 StockMove (GRN_IN) records
//
// Notes:
//   • Code 1516 is absent from the sheet — not delivered, not imported.
//   • Code 1572 is out of numeric sequence — imported as-is.
//   • Qty text "7 BOX" for code 1510 is parsed correctly.
//   • HSN 3918 (vinyl / PVC floor coverings), GST 18%.
//
// Idempotent: guards on GRN invoiceRef. Safe to re-run.
// Run: pnpm tsx scripts/import-floor-tile-stock.ts

import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import { existsSync } from "node:fs";

const XLSX_PATH =
  "c:\\Users\\binu\\Downloads\\WALLAPPER STOCK LIST (2) (2) (4) (1).xlsx";
const SHEET_NAME        = "FLOOR TILE 4.8.26";
const GRN_INVOICE_REF  = "FLOOR-TILE-4.8.26";
const DELIVERY_DATE    = new Date("2026-08-04T09:00:00+05:30");
const DYE_LOT          = "4.8.26";

// Ready Stock brand (existing) — showroom inventory with no specific external brand
const READY_STOCK_BRAND_ID = "cmt31t04m0000u17k3q0hnwpq";
// VND-SHOWROOM vendor (created during MANDOVARA STOCK import)
const SHOWROOM_VENDOR_ID   = "cmt35qr3h0000u1tg2b0dyr9g";

const COLLECTION_NAME = "PVC Floor Tile Strips 1.5mm";
const HSN    = "3918"; // vinyl / PVC floor coverings
const GST    = 18;     // %

interface TileRow {
  sno:  number;
  code: string; // "1505" — the numeric prefix of the description
  raw:  string; // "1505 PVC FLOOR TILE STRIPS 1.5MM"
  qty:  number; // parsed integer from "10 BOX"
}

if (!existsSync(XLSX_PATH)) {
  console.error(`Not found: ${XLSX_PATH}`);
  process.exit(1);
}

function readSheet(): TileRow[] {
  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets[SHEET_NAME];
  if (!ws) throw new Error(`Sheet "${SHEET_NAME}" not found in ${XLSX_PATH}`);

  const raw = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
  }) as Array<[number, string, string]>;

  // Row 0 = headers, rows 1–20 = data
  return raw.slice(1).map((row, i) => {
    const rawCode = String(row[1] ?? "").trim();
    const code    = rawCode.split(" ")[0]!;          // "1505 PVC..." → "1505"
    const qtyText = String(row[2] ?? "0").trim();    // "10 BOX"
    const qty     = parseInt(qtyText, 10);            // 10
    if (!code || !Number.isFinite(qty) || qty <= 0) {
      throw new Error(`Invalid row ${i + 2}: code="${rawCode}" qty="${qtyText}"`);
    }
    return { sno: i + 1, code, raw: rawCode, qty };
  });
}

async function main(): Promise<void> {
  const db = new PrismaClient();

  try {
    // ── 0. Read & validate ────────────────────────────────────────────────
    const rows = readSheet();
    const totalBoxes = rows.reduce((s, r) => s + r.qty, 0);
    console.log(`\nExcel: ${rows.length} rows, ${totalBoxes} boxes total`);

    if (rows.length !== 20 || totalBoxes !== 167) {
      throw new Error(
        `Expected 20 rows / 167 boxes — got ${rows.length} rows / ${totalBoxes} boxes. Aborting.`
      );
    }

    // Note missing code
    const codes      = rows.map((r) => Number(r.code));
    const _sequential = [1505,1506,1507,1508,1509,1510,1511,1512,1513,1514,1515,1517,1518,1519,1520,1521,1522,1523,1524,1572];
    const _missing    = [1516];
    console.log(
      `Codes present: ${codes.join(", ")}`
    );
    console.log(`Code 1516 absent from sheet — not delivered, will not be imported.`);

    // ── 1. Resolve org + admin ────────────────────────────────────────────
    const org = await db.organization.findFirstOrThrow({
      where:  { name: "Mandovara" },
      select: { id: true },
    });
    const admin = await db.user.findFirstOrThrow({
      where:  { organizationId: org.id, role: "OWNER" },
      select: { id: true, name: true },
    });
    console.log(`\nOrg:   ${org.id}`);
    console.log(`Admin: ${admin.name} (${admin.id})`);

    // ── 2. Idempotency guard ─────────────────────────────────────────────
    const existingGrn = await db.gRN.findFirst({
      where:  { organizationId: org.id, invoiceRef: GRN_INVOICE_REF },
      select: { id: true, number: true },
    });
    if (existingGrn) {
      console.log(
        `\n⚠  GRN already exists: ${existingGrn.number} — running verification only.\n`
      );
      await verify(db, org.id, rows);
      return;
    }

    // ── 3. Upsert collection ──────────────────────────────────────────────
    const collection = await db.collection.upsert({
      where: {
        organizationId_brandId_name: {
          organizationId: org.id,
          brandId:        READY_STOCK_BRAND_ID,
          name:           COLLECTION_NAME,
        },
      },
      update: {},
      create: {
        organizationId: org.id,
        brandId:        READY_STOCK_BRAND_ID,
        name:           COLLECTION_NAME,
        family:         "FLOORING",
      },
    });
    console.log(`\nCollection: "${collection.name}" (id: ${collection.id})`);

    // ── 4. Upsert Designs (one per code) ─────────────────────────────────
    console.log(`\nUpserting ${rows.length} designs + colourways…`);
    const colourwayIdByCode = new Map<string, string>();

    for (const row of rows) {
      const design = await db.design.upsert({
        where: {
          organizationId_collectionId_code: {
            organizationId: org.id,
            collectionId:   collection.id,
            code:           row.code,
          },
        },
        update: {},
        create: {
          organizationId: org.id,
          collectionId:   collection.id,
          code:           row.code,
          name:           `PVC Strip ${row.code}`,
          family:         "FLOORING",
          thicknessMm:    1.5,
          hsn:            HSN,
          gstRate:        GST,
          specs: {
            source:      "FLOOR-TILE-4.8.26-import",
            importedOn:  "2026-08-21",
            description: row.raw,
          },
        },
      });

      const cw = await db.colourway.upsert({
        where: {
          organizationId_code: { organizationId: org.id, code: row.code },
        },
        update: {},
        create: {
          organizationId: org.id,
          designId:       design.id,
          code:           row.code,
          colourName:     "Standard",
          sellUnit:       "BOX",
        },
      });

      colourwayIdByCode.set(row.code, cw.id);
      process.stdout.write(`  ✓ ${row.code.padEnd(6)} → cw:${cw.id}\n`);
    }

    // ── 5. Allocate GRN number ────────────────────────────────────────────
    const grnNumber = await db.$transaction(async (tx) => {
      const seq = await tx.numberSequence.update({
        where: {
          organizationId_series_yymm: {
            organizationId: org.id,
            series:         "GRN",
            yymm:           "2608",
          },
        },
        data: { counter: { increment: 1 } },
      });
      return `MDV/GRN-${seq.yymm}-${String(seq.counter).padStart(4, "0")}`;
    });
    console.log(`\nGRN number: ${grnNumber}`);

    // ── 6. Create GRN + lines ─────────────────────────────────────────────
    const grn = await db.gRN.create({
      data: {
        organizationId: org.id,
        number:         grnNumber,
        vendorId:       SHOWROOM_VENDOR_ID,
        receivedAt:     DELIVERY_DATE,
        invoiceRef:     GRN_INVOICE_REF,
        lines: {
          create: rows.map((row) => ({
            organizationId: org.id,
            colourwayId:    colourwayIdByCode.get(row.code)!,
            quantity:       row.qty,
            rejectedQty:    0,
            rate:           0,
            dyeLot:         DYE_LOT,
          })),
        },
      },
    });
    console.log(`GRN created: ${grn.id}`);

    // ── 7. StockBalance (upsert) + StockMove (GRN_IN) ─────────────────────
    console.log(`\nWriting ${rows.length} StockBalance + StockMove records…`);

    await db.$transaction(
      rows.map((row) => {
        const colourwayId = colourwayIdByCode.get(row.code)!;
        return db.stockBalance.upsert({
          where: {
            colourwayId_dyeLot: { colourwayId, dyeLot: DYE_LOT },
          },
          update: { quantity: { increment: row.qty } },
          create: {
            organizationId: org.id,
            colourwayId,
            dyeLot:         DYE_LOT,
            quantity:       row.qty,
            reserved:       0,
            value:          0,
          },
        });
      })
    );

    await db.$transaction(
      rows.map((row) => {
        const colourwayId = colourwayIdByCode.get(row.code)!;
        return db.stockMove.create({
          data: {
            organizationId: org.id,
            colourwayId,
            dyeLot:         DYE_LOT,
            type:           "GRN_IN",
            quantity:       row.qty,
            rate:           0,
            refType:        "GRN",
            refId:          grn.id,
            occurredAt:     DELIVERY_DATE,
            createdById:    admin.id,
          },
        });
      })
    );
    console.log("Stock records written.");

    // ── 8. Verify ─────────────────────────────────────────────────────────
    console.log(`\n${"─".repeat(65)}`);
    console.log("VERIFICATION");
    console.log(`${"─".repeat(65)}`);
    await verify(db, org.id, rows);
  } finally {
    await db.$disconnect();
  }
}

async function verify(
  db: PrismaClient,
  orgId: string,
  rows: TileRow[]
): Promise<void> {
  // Fetch all balances for this dye lot, then filter to FLOORING/BOX in JS
  // (avoids deeply-nested Prisma relation filters that TypeScript rejects).
  const allBalances = await db.stockBalance.findMany({
    where: { organizationId: orgId, dyeLot: DYE_LOT },
    include: {
      colourway: {
        include: {
          design: { include: { collection: { include: { brand: true } } } },
        },
      },
    },
    orderBy: { colourway: { code: "asc" } },
  });

  const floorOnly = allBalances.filter(
    (b) => b.colourway.design.family === "FLOORING" && b.colourway.sellUnit === "BOX"
  );

  // Collect the colourway IDs so we can count StockMove rows precisely
  const cwIds = floorOnly.map((b) => b.colourwayId);

  let totalBoxes = 0;
  let mismatches = 0;
  for (const b of floorOnly) {
    const expected = rows.find((r) => r.code === b.colourway.code);
    const qty = Number(b.quantity);
    totalBoxes += qty;
    const ok = expected != null && qty === expected.qty;
    if (!ok) mismatches++;
    console.log(
      `  ${ok ? "✓" : "✗"} code:${b.colourway.code.padEnd(6)} dye:${(b.dyeLot ?? "").padEnd(8)} qty:${String(qty).padStart(3)} BOX  | ${b.colourway.design.collection.brand.name} | ${b.colourway.design.collection.name}`
    );
  }

  console.log(`\n  SKU records : ${floorOnly.length} (expected 20)`);
  console.log(`  Total boxes : ${totalBoxes} (expected 167)`);

  const moveCount = await db.stockMove.count({
    where: {
      organizationId: orgId,
      dyeLot:         DYE_LOT,
      type:           "GRN_IN",
      colourwayId:    { in: cwIds },
    },
  });
  console.log(`  StockMove   : ${moveCount} (expected 20)`);

  if (floorOnly.length === 20 && totalBoxes === 167 && mismatches === 0) {
    console.log("\n✓  Verification PASSED — 20 SKUs, 167 boxes, all quantities correct.");
  } else {
    console.log("\n✗  Verification FAILED — check output above.");
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

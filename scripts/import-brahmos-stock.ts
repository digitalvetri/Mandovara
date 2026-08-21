// Import BRAHMOS 4.8.26 stock into the Mandovara system.
//
// Source: WALLAPPER STOCK LIST (2) (2) (4) (1).xlsx — sheet "BRAHMOS 4.8.26"
// Delivery date: 4 August 2026
// Collection: Ready Stock | BRAHMOS (family: WALLPAPER)
// 13 designs × 5 colourways each = 65 colourways × 6 rolls = 390 rolls
//
// What this script creates:
//   1. BRAHMOS vendor (VND-BRAHMOS) — required for GRN
//   2. 13 Design records (codes 2101–2113) under Ready Stock | BRAHMOS
//   3. 65 Colourway records (codes 2101-1 … 2113-5) with sell unit ROLL
//   4. 1 GRN record (MDV/GRN-2608-0001, dated 2026-08-04)
//   5. 65 GRNLine records (qty 6, dye lot "4.8.26")
//   6. 65 StockBalance records (qty 6 ROLL, dye lot "4.8.26")
//   7. 65 StockMove records (type GRN_IN, qty 6, dated 2026-08-04)
//
// Idempotent: checks for existing GRN before creating. Safe to re-run.
// Run: pnpm tsx scripts/import-brahmos-stock.ts

import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import { existsSync } from "node:fs";

const XLSX_PATH =
  "c:\\Users\\binu\\Downloads\\WALLAPPER STOCK LIST (2) (2) (4) (1).xlsx";
const SHEET_NAME = "BRAHMOS 4.8.26";
const DYE_LOT = "4.8.26";
const DELIVERY_DATE = new Date("2026-08-04T09:00:00+05:30");
const GRN_INVOICE_REF = "BRAHMOS-4.8.26"; // idempotency key

// BRAHMOS collection in "Ready Stock" brand
const BRAHMOS_COLLECTION_ID = "cmt31t0840004u17kyicf5zwj";

// Standard wallpaper defaults (CLAUDE.md §4)
const ROLL_WIDTH_MM = 530;
const ROLL_LENGTH_M = 10.05;
const HSN = "4814";
const GST_RATE = 12; // %

if (!existsSync(XLSX_PATH)) {
  console.error(`Not found: ${XLSX_PATH}`);
  process.exit(1);
}

interface BrahmosRow {
  sno: number;
  code: string; // e.g. "2113-1"
  qty: number;  // always 6
}

function readSheet(): BrahmosRow[] {
  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets[SHEET_NAME];
  if (!ws) throw new Error(`Sheet "${SHEET_NAME}" not found in ${XLSX_PATH}`);

  const raw = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
  }) as Array<[number, string, number]>;

  // Row 0 = headers: ["S.NO", "CODE NO", "QTY"]
  return raw.slice(1).map((row) => ({
    sno:  Number(row[0]),
    code: String(row[1]).trim(),
    qty:  Number(row[2]),
  }));
}

function designCode(colourwayCode: string): string {
  return colourwayCode.split("-")[0]!; // "2113-1" → "2113"
}

function colourwaySuffix(colourwayCode: string): string {
  return colourwayCode.split("-")[1] ?? "1"; // "2113-1" → "1"
}

async function main(): Promise<void> {
  const db = new PrismaClient();

  try {
    // ── 0. Read & validate Excel ──────────────────────────────────────────
    const rows = readSheet();
    const total = rows.reduce((s, r) => s + r.qty, 0);
    console.log(`\nExcel: ${rows.length} rows, ${total} rolls total`);
    if (rows.length !== 65 || total !== 390) {
      throw new Error(
        `Expected 65 rows / 390 rolls — got ${rows.length} rows / ${total} rolls. Aborting.`
      );
    }

    // ── 1. Resolve org and user ───────────────────────────────────────────
    const org = await db.organization.findFirstOrThrow({
      where:  { name: "Mandovara" },
      select: { id: true },
    });
    const adminUser = await db.user.findFirstOrThrow({
      where:  { organizationId: org.id, role: "OWNER" },
      select: { id: true, name: true },
    });
    console.log(`Org: ${org.id}`);
    console.log(`Admin: ${adminUser.name} (${adminUser.id})`);

    // ── 2. Verify BRAHMOS collection ──────────────────────────────────────
    const collection = await db.collection.findUniqueOrThrow({
      where:   { id: BRAHMOS_COLLECTION_ID },
      include: { brand: { select: { name: true } } },
    });
    console.log(
      `\nCollection: "${collection.brand.name} | ${collection.name}" (family: ${collection.family})`
    );

    // ── 3. Idempotency guard — check for existing GRN ────────────────────
    const existingGrn = await db.gRN.findFirst({
      where: { organizationId: org.id, invoiceRef: GRN_INVOICE_REF },
      select: { id: true, number: true },
    });
    if (existingGrn) {
      console.log(
        `\n⚠  GRN already exists: ${existingGrn.number} (${existingGrn.id})`
      );
      console.log("Running verification only — skipping import.\n");
      await verify(db, org.id, rows);
      return;
    }

    // ── 4. Create / find BRAHMOS vendor ───────────────────────────────────
    const vendor = await db.vendor.upsert({
      where:  { organizationId_code: { organizationId: org.id, code: "VND-BRAHMOS" } },
      update: {},
      create: {
        organizationId:   org.id,
        code:             "VND-BRAHMOS",
        name:             "BRAHMOS Wallpapers",
        mobile:           "0000000000",
        paymentTermsDays: 30,
        leadTimeDays:     14,
        brandIds:         [],
      },
    });
    console.log(`\nVendor: ${vendor.name} (${vendor.id})`);

    // ── 5. Upsert Designs (2101–2113) ─────────────────────────────────────
    const designCodeSet = new Set(rows.map((r) => designCode(r.code)));
    const designIdByCode = new Map<string, string>();

    console.log(`\nUpserting ${designCodeSet.size} designs…`);
    for (const dc of Array.from(designCodeSet).sort()) {
      const designNum = dc.slice(2); // "2101" → "01"
      const design = await db.design.upsert({
        where: {
          organizationId_collectionId_code: {
            organizationId: org.id,
            collectionId:   BRAHMOS_COLLECTION_ID,
            code:           dc,
          },
        },
        update: {},
        create: {
          organizationId: org.id,
          collectionId:   BRAHMOS_COLLECTION_ID,
          code:           dc,
          name:           `BRAHMOS Design ${designNum}`,
          family:         "WALLPAPER",
          rollWidthMm:    ROLL_WIDTH_MM,
          rollLengthM:    ROLL_LENGTH_M,
          patternMatch:   "FREE",
          hsn:            HSN,
          gstRate:        GST_RATE,
          specs:          { source: "BRAHMOS-4.8.26-import", importedOn: "2026-08-21" },
        },
      });
      designIdByCode.set(dc, design.id);
      process.stdout.write(`.`);
    }
    console.log(` done`);

    // ── 6. Upsert Colourways (65 codes) ───────────────────────────────────
    const colourwayIdByCode = new Map<string, string>();

    console.log(`\nUpserting ${rows.length} colourways…`);
    for (const row of rows) {
      const dc     = designCode(row.code);
      const suffix = colourwaySuffix(row.code);
      const designId = designIdByCode.get(dc)!;

      const cw = await db.colourway.upsert({
        where: {
          organizationId_code: { organizationId: org.id, code: row.code },
        },
        update: {},
        create: {
          organizationId: org.id,
          designId:       designId,
          code:           row.code,
          colourName:     `Colourway ${suffix}`,
          sellUnit:       "ROLL",
        },
      });
      colourwayIdByCode.set(row.code, cw.id);
      process.stdout.write(`.`);
    }
    console.log(` done`);

    // ── 7. Create GRN + GRNLines + StockBalance + StockMove ───────────────
    console.log(`\nCreating GRN with ${rows.length} lines…`);

    // Allocate GRN number from NumberSequence
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
    console.log(`GRN number: ${grnNumber}`);

    // Create GRN record
    const grn = await db.gRN.create({
      data: {
        organizationId: org.id,
        number:         grnNumber,
        vendorId:       vendor.id,
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
            rollCount:      row.qty,
          })),
        },
      },
    });
    console.log(`GRN created: ${grn.id}`);

    // Create StockBalance + StockMove in one transaction
    console.log(`\nWriting ${rows.length} StockBalance + StockMove records…`);
    await db.$transaction(
      rows.map((row) => {
        const colourwayId = colourwayIdByCode.get(row.code)!;
        return db.stockBalance.upsert({
          where: {
            colourwayId_dyeLot: { colourwayId, dyeLot: DYE_LOT },
          },
          update: {
            quantity: { increment: row.qty },
            value:    { increment: 0 },
          },
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
            createdById:    adminUser.id,
          },
        });
      })
    );
    console.log(`Stock records written.`);

    // ── 8. Verify ─────────────────────────────────────────────────────────
    console.log(`\n${"─".repeat(60)}`);
    console.log("VERIFICATION");
    console.log(`${"─".repeat(60)}`);
    await verify(db, org.id, rows);
  } finally {
    await db.$disconnect();
  }
}

async function verify(
  db: PrismaClient,
  orgId: string,
  rows: BrahmosRow[]
): Promise<void> {
  const balances = await db.stockBalance.findMany({
    where: { organizationId: orgId, dyeLot: DYE_LOT },
    include: {
      colourway: {
        include: {
          design: {
            include: { collection: { include: { brand: true } } },
          },
        },
      },
    },
    orderBy: { colourway: { code: "asc" } },
  });

  // Only BRAHMOS ones
  const brahmos = balances.filter(
    (b) => b.colourway.design.collectionId === BRAHMOS_COLLECTION_ID
  );

  let totalRolls = 0;
  brahmos.forEach((b) => {
    const qty = Number(b.quantity);
    totalRolls += qty;
    console.log(
      `  ${b.colourway.code.padEnd(10)} dye:${(b.dyeLot ?? "").padEnd(8)} qty:${String(qty).padStart(2)} ROLL  | ${b.colourway.design.collection.brand.name} | ${b.colourway.design.collection.name}`
    );
  });

  console.log(`\n  Colourway records with stock : ${brahmos.length} (expected 65)`);
  console.log(`  Total rolls                  : ${totalRolls} (expected 390)`);

  const moveCount = await db.stockMove.count({
    where: { organizationId: orgId, dyeLot: DYE_LOT, type: "GRN_IN" },
  });
  console.log(`  StockMove GRN_IN rows        : ${moveCount} (expected 65)`);

  const grnLines = await db.gRNLine.count({
    where: { organizationId: orgId, dyeLot: DYE_LOT },
  });
  console.log(`  GRNLine rows                 : ${grnLines} (expected 65)`);

  if (brahmos.length !== 65 || totalRolls !== 390 || moveCount !== 65) {
    console.log("\n✗  Verification FAILED — numbers do not match expected values.");
    process.exitCode = 1;
  } else {
    console.log("\n✓  Verification PASSED — 65 colourways, 390 rolls, all records consistent.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

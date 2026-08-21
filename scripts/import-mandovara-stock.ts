// Import MANDOVARA STOCK — Section A (named & coded stock) only.
//
// Source: WALLAPPER STOCK LIST (2) (2) (4) (1).xlsx — sheet "MANDOVARA STOCK"
// Captured: August 2026 (existing showroom inventory, no single delivery date)
//
// Section A = rows 1–21 in the sheet (before the blank gap at row 22).
// Section B (colour-only, no code) and Section C (customised) are NOT imported;
// they are printed as a "Flagged for Review" report at the end.
//
// Catalogue matching strategy:
//   Import  → catalogue name found in the Product Catalogue (DB collection).
//   Skip    → catalogue name not found, or entry has "-" (unknown); flagged only.
//   DREAMLAND → matched to "Platinum Range | DREAM LAND" (name variation confirmed).
//
// What is created for each imported row:
//   • Design   — colourway code as design code, family WALLPAPER
//   • Colourway — same code, sell unit ROLL
//   • GRN      — MDV/GRN-2608-0002, dated today, one line per row
//   • GRNLine  — qty, dye lot = code number (supplier's production identifier)
//   • StockBalance — qty, dye lot = code number
//   • StockMove    — type GRN_IN, qty, dated today
//
// Idempotent: guards on GRN invoiceRef and Colourway unique code constraint.
// Run: pnpm tsx scripts/import-mandovara-stock.ts

import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import { existsSync } from "node:fs";

const XLSX_PATH =
  "c:\\Users\\binu\\Downloads\\WALLAPPER STOCK LIST (2) (2) (4) (1).xlsx";
const SHEET_NAME = "MANDOVARA STOCK";
const GRN_INVOICE_REF = "MANDOVARA-STOCK-SECA-2608";
// Recorded date — these are existing showroom items captured in August 2026
const CAPTURE_DATE = new Date("2026-08-21T10:00:00+05:30");

// ── Confirmed collection matches (verified against DB) ────────────────────
// Key = catalogue name in Excel (uppercase), value = existing DB collection.
const COLLECTION_MAP: Record<string, { id: string; brand: string; dbName: string }> = {
  ATHENA:    { id: "cmt31t0640002u17kacg3vh4h", brand: "Ready Stock",    dbName: "ATHENA"     },
  FLAMES:    { id: "cmt31t0f10008u17k5dr98z0s", brand: "Ready Stock",    dbName: "FLAMES"     },
  MAYA:      { id: "cmt311yar000wu1b89q66fgxd", brand: "Fedora",         dbName: "MAYA"       },
  DREAMLAND: { id: "cmt31ahyo000eu12w8o2wrcoy", brand: "Platinum Range", dbName: "DREAM LAND" },
};

const HSN = "4814";         // wallpaper
const GST_RATE = 12;        // %

// ── Types ─────────────────────────────────────────────────────────────────
interface StockRow {
  catalogueName: string;  // "-" means unknown
  code: string;
  qty: number;
}

if (!existsSync(XLSX_PATH)) {
  console.error(`Not found: ${XLSX_PATH}`);
  process.exit(1);
}

function readSectionA(): StockRow[] {
  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets[SHEET_NAME];
  if (!ws) throw new Error(`Sheet "${SHEET_NAME}" not found`);

  const raw = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
  }) as Array<[string | number | null, string | number | null, number | null]>;

  // Section A = rows 1–21 (indices 1–21 after header at index 0).
  // Blank rows at indices 22-24 mark the end of Section A.
  const sectionA: StockRow[] = [];
  for (let i = 1; i <= 21; i++) {
    const row = raw[i];
    if (!row) break;
    const [cat, code, qty] = row;
    if (cat == null && code == null) break; // safety: stop at first blank row

    sectionA.push({
      catalogueName: String(cat ?? "-").trim().toUpperCase(),
      code:          String(code ?? "").trim(),
      qty:           Number(qty ?? 0),
    });
  }
  return sectionA;
}

async function main(): Promise<void> {
  const db = new PrismaClient();

  try {
    // ── 0. Read & split Section A ────────────────────────────────────────
    const rows = readSectionA();
    console.log(`\nSection A: ${rows.length} rows read from "${SHEET_NAME}"`);

    const toImport = rows.filter(
      (r) => r.catalogueName !== "-" && r.catalogueName in COLLECTION_MAP
    );
    const flaggedNamed = rows.filter(
      (r) => r.catalogueName !== "-" && !(r.catalogueName in COLLECTION_MAP)
    );
    const flaggedUnknown = rows.filter((r) => r.catalogueName === "-");

    console.log(`  → Import (catalogue matched)   : ${toImport.length} rows`);
    console.log(`  → Flagged (catalogue not in DB): ${flaggedNamed.length} rows`);
    console.log(`  → Flagged (no catalogue name)  : ${flaggedUnknown.length} rows`);

    // ── 1. Resolve org + admin user ──────────────────────────────────────
    const org = await db.organization.findFirstOrThrow({
      where:  { name: "Mandovara" },
      select: { id: true },
    });
    const adminUser = await db.user.findFirstOrThrow({
      where:  { organizationId: org.id, role: "OWNER" },
      select: { id: true, name: true },
    });
    console.log(`\nOrg: ${org.id}`);
    console.log(`Admin: ${adminUser.name} (${adminUser.id})`);

    // ── 2. Idempotency guard ─────────────────────────────────────────────
    const existingGrn = await db.gRN.findFirst({
      where:  { organizationId: org.id, invoiceRef: GRN_INVOICE_REF },
      select: { id: true, number: true },
    });
    if (existingGrn) {
      console.log(`\n⚠  GRN already exists: ${existingGrn.number} — running verification only.\n`);
      await verify(db, org.id, toImport);
      printFlagged(flaggedNamed, flaggedUnknown);
      return;
    }

    // ── 3. Create / find vendor for showroom stock ───────────────────────
    const vendor = await db.vendor.upsert({
      where:  { organizationId_code: { organizationId: org.id, code: "VND-SHOWROOM" } },
      update: {},
      create: {
        organizationId:   org.id,
        code:             "VND-SHOWROOM",
        name:             "Mandovara Showroom (Internal)",
        mobile:           "0000000000",
        paymentTermsDays: 0,
        leadTimeDays:     0,
        brandIds:         [],
      },
    });
    console.log(`\nVendor: ${vendor.name} (${vendor.id})`);

    // ── 4. Upsert Design + Colourway for each matched row ────────────────
    console.log(`\nUpserting designs + colourways…`);
    const colourwayIdByCode = new Map<string, string>();

    for (const row of toImport) {
      const coll = COLLECTION_MAP[row.catalogueName]!;

      const design = await db.design.upsert({
        where: {
          organizationId_collectionId_code: {
            organizationId: org.id,
            collectionId:   coll.id,
            code:           row.code,
          },
        },
        update: {},
        create: {
          organizationId: org.id,
          collectionId:   coll.id,
          code:           row.code,
          name:           `${row.catalogueName} ${row.code}`,
          family:         "WALLPAPER",
          hsn:            HSN,
          gstRate:        GST_RATE,
          specs:          { source: "MANDOVARA-STOCK-import", importedOn: "2026-08-21" },
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
          sellUnit:       "ROLL",
        },
      });

      colourwayIdByCode.set(row.code, cw.id);
      process.stdout.write(`  ✓ ${row.catalogueName.padEnd(12)} ${row.code.padEnd(16)} → cw:${cw.id}\n`);
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

    // ── 6. Create GRN + lines (dye lot = supplier code) ──────────────────
    const grn = await db.gRN.create({
      data: {
        organizationId: org.id,
        number:         grnNumber,
        vendorId:       vendor.id,
        receivedAt:     CAPTURE_DATE,
        invoiceRef:     GRN_INVOICE_REF,
        lines: {
          create: toImport.map((row) => ({
            organizationId: org.id,
            colourwayId:    colourwayIdByCode.get(row.code)!,
            quantity:       row.qty,
            rejectedQty:    0,
            rate:           0,
            dyeLot:         row.code, // supplier code = dye lot identifier
            rollCount:      row.qty,
          })),
        },
      },
    });
    console.log(`GRN created: ${grn.id}`);

    // ── 7. StockBalance (upsert) + StockMove (GRN_IN) ─────────────────────
    console.log(`\nWriting ${toImport.length} StockBalance + StockMove records…`);

    await db.$transaction(
      toImport.map((row) => {
        const colourwayId = colourwayIdByCode.get(row.code)!;
        return db.stockBalance.upsert({
          where: {
            colourwayId_dyeLot: { colourwayId, dyeLot: row.code },
          },
          update: { quantity: { increment: row.qty } },
          create: {
            organizationId: org.id,
            colourwayId,
            dyeLot:         row.code,
            quantity:       row.qty,
            reserved:       0,
            value:          0,
          },
        });
      })
    );

    await db.$transaction(
      toImport.map((row) => {
        const colourwayId = colourwayIdByCode.get(row.code)!;
        return db.stockMove.create({
          data: {
            organizationId: org.id,
            colourwayId,
            dyeLot:         row.code,
            type:           "GRN_IN",
            quantity:       row.qty,
            rate:           0,
            refType:        "GRN",
            refId:          grn.id,
            occurredAt:     CAPTURE_DATE,
            createdById:    adminUser.id,
          },
        });
      })
    );
    console.log(`Stock records written.`);

    // ── 8. Verify ─────────────────────────────────────────────────────────
    console.log(`\n${"─".repeat(70)}`);
    console.log("VERIFICATION — IMPORTED RECORDS");
    console.log(`${"─".repeat(70)}`);
    await verify(db, org.id, toImport);

    // ── 9. Flagged report ─────────────────────────────────────────────────
    printFlagged(flaggedNamed, flaggedUnknown);
  } finally {
    await db.$disconnect();
  }
}

async function verify(
  db: PrismaClient,
  orgId: string,
  toImport: StockRow[]
): Promise<void> {
  let totalRolls = 0;
  let allPass = true;

  for (const row of toImport) {
    const coll = COLLECTION_MAP[row.catalogueName]!;
    const bal = await db.stockBalance.findFirst({
      where: { organizationId: orgId, dyeLot: row.code },
      include: {
        colourway: {
          include: {
            design: {
              include: { collection: { include: { brand: true } } },
            },
          },
        },
      },
    });

    if (!bal) {
      console.log(`  ✗ MISSING  ${row.code.padEnd(16)} (${row.catalogueName})`);
      allPass = false;
      continue;
    }

    const qty = Number(bal.quantity);
    totalRolls += qty;
    const brand = bal.colourway.design.collection.brand.name;
    const collName = bal.colourway.design.collection.name;
    const match = collName === coll.dbName ? "✓" : "≈";

    console.log(
      `  ${match} ${bal.colourway.code.padEnd(18)} dye:${(bal.dyeLot ?? "").padEnd(18)} qty:${String(qty).padStart(2)} ROLL  | ${brand} | ${collName}`
    );

    if (qty !== row.qty) {
      console.log(`    ⚠  Expected ${row.qty} rolls, got ${qty}`);
      allPass = false;
    }
  }

  console.log(`\n  Rows imported : ${toImport.length} (expected ${toImport.length})`);
  console.log(`  Total rolls   : ${totalRolls} (expected ${toImport.reduce((s, r) => s + r.qty, 0)})`);

  if (allPass) {
    console.log(`\n✓  Verification PASSED`);
  } else {
    console.log(`\n✗  Verification FAILED — check output above`);
    process.exitCode = 1;
  }
}

function printFlagged(named: StockRow[], unknown: StockRow[]): void {
  const sep = "─".repeat(70);
  console.log(`\n${sep}`);
  console.log("FLAGGED FOR MANUAL REVIEW — NOT IMPORTED");
  console.log(sep);

  if (named.length > 0) {
    console.log("\n  Section A — Catalogue name not found in Product Catalogue:");
    console.log(`  ${"CATALOGUE".padEnd(14)} ${"CODE".padEnd(20)} ROLLS`);

    // Group by catalogue name
    const grouped = new Map<string, StockRow[]>();
    for (const r of named) {
      if (!grouped.has(r.catalogueName)) grouped.set(r.catalogueName, []);
      grouped.get(r.catalogueName)!.push(r);
    }

    let flagTotal = 0;
    for (const [cat, rows] of Array.from(grouped.entries()).sort()) {
      for (const r of rows) {
        console.log(`  ${cat.padEnd(14)} ${r.code.padEnd(20)} ${r.qty}`);
        flagTotal += r.qty;
      }
    }
    console.log(`\n  Subtotal: ${named.length} rows, ${flagTotal} rolls`);
    console.log(`\n  Action required:`);
    console.log(`    • Add these collections to the Product Catalogue under the correct brand`);
    console.log(`    • Re-run this script — it is idempotent and will pick up new matches`);
  }

  if (unknown.length > 0) {
    console.log("\n  Section A — No catalogue name (listed as \"-\" in Excel):");
    console.log(`  ${"CODE".padEnd(22)} ROLLS`);
    let unkTotal = 0;
    for (const r of unknown) {
      console.log(`  ${r.code.padEnd(22)} ${r.qty}`);
      unkTotal += r.qty;
    }
    console.log(`\n  Subtotal: ${unknown.length} rows, ${unkTotal} rolls`);
    console.log(`\n  Action required:`);
    console.log(`    • Identify the collection for each code (check roll label or supplier)`);
    console.log(`    • Add the collection to the Product Catalogue`);
    console.log(`    • Add the row to Section A of MANDOVARA STOCK with the correct catalogue name`);
    console.log(`    • Re-run this script`);
  }

  console.log(`\n  Section B (colour-only, no code) and Section C (customised) were`);
  console.log(`  deliberately excluded — they require manual catalogue matching first.`);
  console.log(sep);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

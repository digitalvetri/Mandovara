// Import TRACK STOCK into the Mandovara system.
//
// Source: WALLAPPER STOCK LIST (2) (2) (4) (1).xlsx — sheet "TRACK STOCK"
// Captured: August 2026 (existing showroom hardware inventory)
//
// IMPORTED (10 items, 28 rows, 43 pieces):
//   ROMAN          → Curtain Tracks  / HARDWARE_TRACK   (3 lengths)
//   JAMBO TRACK    → Curtain Tracks  / HARDWARE_TRACK   (2 lengths)
//   M TRACK        → Curtain Tracks  / HARDWARE_TRACK   (4 lengths)
//   SST HEAVY CHANEL → Curtain Tracks / HARDWARE_TRACK  (1 length)
//   GOLD RAD       → Curtain Rods    / HARDWARE_ROD     (1 length)
//   ROSE GOLD ROD  → Curtain Rods    / HARDWARE_ROD     (8 lengths)
//   COPPER ROD     → Curtain Rods    / HARDWARE_ROD     (4 lengths)
//   SS ROD         → Curtain Rods    / HARDWARE_ROD     (3 lengths)
//   BLACK ROD      → Curtain Rods    / HARDWARE_ROD     (1 length)
//   MOTARAIZED     → Motorized Units / MOTOR            (no length, 1 pc)
//
// EXCLUDED (pending manual confirmation):
//   PLYWOOD   — raw material, family unclear
//   ANTICRAFF — ambiguous (track vs rod)
//
// Design per item type. Colourway per (item type × length).
// Lengths converted: 1 inch = 25.4 mm exactly.
// Original inch value preserved in Design.specs.
// Dye lot: null (hardware has no batch concept).
// SellUnit: PIECE throughout.
//
// Idempotent: guards on GRN invoiceRef. Safe to re-run.
// Run: pnpm tsx scripts/import-track-stock.ts

import { PrismaClient } from "@prisma/client";

const GRN_INVOICE_REF = "TRACK-STOCK-2608";
const CAPTURE_DATE    = new Date("2026-08-21T10:00:00+05:30");

// Existing IDs (verified before writing this script)
const READY_STOCK_BRAND_ID = "cmt31t04m0000u17k3q0hnwpq";
const SHOWROOM_VENDOR_ID   = "cmt35qr3h0000u1tg2b0dyr9g";

// HSN codes (confirm with CA; these are reasonable industry mappings)
// 8302 = base metal mountings / fittings for furniture, doors, windows, blinds
// 8501 = electric motors and generators
const HSN_HARDWARE = "8302";
const HSN_MOTOR    = "8501";
const GST_HARDWARE = 18; // %
const GST_MOTOR    = 18; // %

const INCH_TO_MM = 25.4;

// ── Source data ────────────────────────────────────────────────────────────
// Structured directly from the Excel sheet (null-fill applied manually).
// Each entry: { item, designCode, family, inches, qty }
// items without a length (MOTARAIZED) have inches: null.

interface TrackRow {
  item:       string;   // display name
  designCode: string;   // slug for Design.code
  family:     "HARDWARE_TRACK" | "HARDWARE_ROD" | "MOTOR";
  inches:     number | null;
  qty:        number;
}

const ROWS: TrackRow[] = [
  // ── TRACKS ──────────────────────────────────────────────────────────────
  { item: "ROMAN",           designCode: "ROMAN",            family: "HARDWARE_TRACK", inches: 26,   qty: 7 },
  { item: "ROMAN",           designCode: "ROMAN",            family: "HARDWARE_TRACK", inches: 62,   qty: 1 },
  { item: "ROMAN",           designCode: "ROMAN",            family: "HARDWARE_TRACK", inches: 52,   qty: 1 },
  { item: "JAMBO TRACK",     designCode: "JAMBO-TRACK",      family: "HARDWARE_TRACK", inches: 66,   qty: 2 },
  { item: "JAMBO TRACK",     designCode: "JAMBO-TRACK",      family: "HARDWARE_TRACK", inches: 67,   qty: 2 },
  { item: "M TRACK",         designCode: "M-TRACK",          family: "HARDWARE_TRACK", inches: 76,   qty: 1 },
  { item: "M TRACK",         designCode: "M-TRACK",          family: "HARDWARE_TRACK", inches: 85.5, qty: 1 },
  { item: "M TRACK",         designCode: "M-TRACK",          family: "HARDWARE_TRACK", inches: 82,   qty: 2 },
  { item: "M TRACK",         designCode: "M-TRACK",          family: "HARDWARE_TRACK", inches: 26,   qty: 1 },
  { item: "SST HEAVY CHANEL",designCode: "SST-HEAVY-CHANEL", family: "HARDWARE_TRACK", inches: 57.5, qty: 1 },
  // ── RODS ────────────────────────────────────────────────────────────────
  { item: "GOLD RAD",        designCode: "GOLD-RAD",         family: "HARDWARE_ROD",   inches: 64,   qty: 2 },
  { item: "ROSE GOLD ROD",   designCode: "ROSE-GOLD-ROD",    family: "HARDWARE_ROD",   inches: 41.5, qty: 1 },
  { item: "ROSE GOLD ROD",   designCode: "ROSE-GOLD-ROD",    family: "HARDWARE_ROD",   inches: 39,   qty: 1 },
  { item: "ROSE GOLD ROD",   designCode: "ROSE-GOLD-ROD",    family: "HARDWARE_ROD",   inches: 34,   qty: 1 },
  { item: "ROSE GOLD ROD",   designCode: "ROSE-GOLD-ROD",    family: "HARDWARE_ROD",   inches: 38,   qty: 1 },
  { item: "ROSE GOLD ROD",   designCode: "ROSE-GOLD-ROD",    family: "HARDWARE_ROD",   inches: 35,   qty: 1 },
  { item: "ROSE GOLD ROD",   designCode: "ROSE-GOLD-ROD",    family: "HARDWARE_ROD",   inches: 36,   qty: 1 },
  { item: "ROSE GOLD ROD",   designCode: "ROSE-GOLD-ROD",    family: "HARDWARE_ROD",   inches: 37,   qty: 1 },
  { item: "ROSE GOLD ROD",   designCode: "ROSE-GOLD-ROD",    family: "HARDWARE_ROD",   inches: 51,   qty: 1 },
  { item: "COPPER ROD",      designCode: "COPPER-ROD",       family: "HARDWARE_ROD",   inches: 39,   qty: 4 },
  { item: "COPPER ROD",      designCode: "COPPER-ROD",       family: "HARDWARE_ROD",   inches: 48,   qty: 2 },
  { item: "COPPER ROD",      designCode: "COPPER-ROD",       family: "HARDWARE_ROD",   inches: 23,   qty: 1 },
  { item: "COPPER ROD",      designCode: "COPPER-ROD",       family: "HARDWARE_ROD",   inches: 54,   qty: 2 },
  { item: "SS ROD",          designCode: "SS-ROD",           family: "HARDWARE_ROD",   inches: 48,   qty: 1 },
  { item: "SS ROD",          designCode: "SS-ROD",           family: "HARDWARE_ROD",   inches: 27,   qty: 1 },
  { item: "SS ROD",          designCode: "SS-ROD",           family: "HARDWARE_ROD",   inches: 55,   qty: 1 },
  { item: "BLACK ROD",       designCode: "BLACK-ROD",        family: "HARDWARE_ROD",   inches: 92,   qty: 1 },
  // ── MOTOR ────────────────────────────────────────────────────────────────
  { item: "MOTARAIZED",      designCode: "MOTOR-UNIT",       family: "MOTOR",          inches: null, qty: 1 },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function inchesToMm(inches: number): number {
  return Math.round(inches * INCH_TO_MM * 100) / 100; // Decimal(10,2)
}

function cwCode(designCode: string, inches: number | null): string {
  if (inches === null) return designCode;
  // Format: "ROMAN-26IN" or "M-TRACK-85.5IN"
  return `${designCode}-${inches}IN`;
}

function cwName(inches: number | null): string {
  if (inches === null) return "Motorized Drive Unit";
  const mm = inchesToMm(inches);
  return `${inches} in / ${mm.toFixed(2)} mm`;
}

function designName(item: string): string {
  // Title-case the display name
  return item.split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// Unique design types across the rows
function uniqueDesigns(): Array<{ item: string; designCode: string; family: TrackRow["family"] }> {
  const seen = new Set<string>();
  const out: Array<{ item: string; designCode: string; family: TrackRow["family"] }> = [];
  for (const r of ROWS) {
    if (!seen.has(r.designCode)) {
      seen.add(r.designCode);
      out.push({ item: r.item, designCode: r.designCode, family: r.family });
    }
  }
  return out;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const db = new PrismaClient();

  try {
    // ── 0. Pre-flight ──────────────────────────────────────────────────────
    const totalPieces = ROWS.reduce((s, r) => s + r.qty, 0);
    console.log(`\nSource data: ${ROWS.length} rows, ${totalPieces} pieces`);
    console.log(`Excluded: PLYWOOD (2 pcs) and ANTICRAFF (2 pcs) — pending confirmation`);

    // ── 1. Resolve org + admin ─────────────────────────────────────────────
    const org = await db.organization.findFirstOrThrow({
      where: { name: "Mandovara" }, select: { id: true },
    });
    const admin = await db.user.findFirstOrThrow({
      where: { organizationId: org.id, role: "OWNER" }, select: { id: true, name: true },
    });
    console.log(`\nOrg: ${org.id}`);
    console.log(`Admin: ${admin.name} (${admin.id})`);

    // ── 2. Idempotency guard ───────────────────────────────────────────────
    const existingGrn = await db.gRN.findFirst({
      where: { organizationId: org.id, invoiceRef: GRN_INVOICE_REF },
      select: { id: true, number: true },
    });
    if (existingGrn) {
      console.log(`\n⚠  GRN already exists: ${existingGrn.number} — running verification only.\n`);
      await verify(db, org.id);
      return;
    }

    // ── 3. Upsert the three collections ───────────────────────────────────
    console.log("\nUpserting collections…");

    const trackCol = await db.collection.upsert({
      where: { organizationId_brandId_name: {
        organizationId: org.id, brandId: READY_STOCK_BRAND_ID, name: "Curtain Tracks",
      }},
      update: {},
      create: { organizationId: org.id, brandId: READY_STOCK_BRAND_ID, name: "Curtain Tracks", family: "HARDWARE_TRACK" },
    });

    const rodCol = await db.collection.upsert({
      where: { organizationId_brandId_name: {
        organizationId: org.id, brandId: READY_STOCK_BRAND_ID, name: "Curtain Rods",
      }},
      update: {},
      create: { organizationId: org.id, brandId: READY_STOCK_BRAND_ID, name: "Curtain Rods", family: "HARDWARE_ROD" },
    });

    const motorCol = await db.collection.upsert({
      where: { organizationId_brandId_name: {
        organizationId: org.id, brandId: READY_STOCK_BRAND_ID, name: "Motorized Units",
      }},
      update: {},
      create: { organizationId: org.id, brandId: READY_STOCK_BRAND_ID, name: "Motorized Units", family: "MOTOR" },
    });

    const collectionByFamily: Record<string, { id: string }> = {
      HARDWARE_TRACK: trackCol,
      HARDWARE_ROD:   rodCol,
      MOTOR:          motorCol,
    };

    console.log(`  ✓ Curtain Tracks     (id: ${trackCol.id})`);
    console.log(`  ✓ Curtain Rods       (id: ${rodCol.id})`);
    console.log(`  ✓ Motorized Units    (id: ${motorCol.id})`);

    // ── 4. Upsert Designs (one per item type) ─────────────────────────────
    console.log("\nUpserting designs…");
    const designIdByCode = new Map<string, string>();

    for (const { item, designCode, family } of uniqueDesigns()) {
      const coll = collectionByFamily[family]!;
      const hsn  = family === "MOTOR" ? HSN_MOTOR : HSN_HARDWARE;
      const gst  = family === "MOTOR" ? GST_MOTOR : GST_HARDWARE;

      const design = await db.design.upsert({
        where: { organizationId_collectionId_code: {
          organizationId: org.id, collectionId: coll.id, code: designCode,
        }},
        update: {},
        create: {
          organizationId: org.id,
          collectionId:   coll.id,
          code:           designCode,
          name:           designName(item),
          family,
          hsn,
          gstRate:        gst,
          specs: {
            source:          "TRACK-STOCK-import",
            importedOn:      "2026-08-21",
            originalItemName: item,
            note:            "HSN 8302/8501 — confirm with CA before invoicing",
          },
        },
      });

      designIdByCode.set(designCode, design.id);
      console.log(`  ✓ ${designCode.padEnd(20)} → design:${design.id}`);
    }

    // ── 5. Upsert Colourways (one per row = one per item×length) ──────────
    console.log("\nUpserting colourways…");
    const colourwayIdByRow = new Map<number, string>();

    for (let i = 0; i < ROWS.length; i++) {
      const row       = ROWS[i]!;
      const code      = cwCode(row.designCode, row.inches);
      const designId  = designIdByCode.get(row.designCode)!;

      const cw = await db.colourway.upsert({
        where: { organizationId_code: { organizationId: org.id, code } },
        update: {},
        create: {
          organizationId: org.id,
          designId,
          code,
          colourName: cwName(row.inches),
          sellUnit:   "PIECE",
        },
      });

      colourwayIdByRow.set(i, cw.id);
      const mmDisplay = row.inches !== null ? ` (${inchesToMm(row.inches).toFixed(2)} mm)` : "";
      console.log(`  ✓ ${code.padEnd(28)} qty:${String(row.qty).padStart(2)}${mmDisplay}`);
    }

    // ── 6. Allocate GRN number ────────────────────────────────────────────
    const grnNumber = await db.$transaction(async (tx) => {
      const seq = await tx.numberSequence.update({
        where: { organizationId_series_yymm: {
          organizationId: org.id, series: "GRN", yymm: "2608",
        }},
        data: { counter: { increment: 1 } },
      });
      return `MDV/GRN-${seq.yymm}-${String(seq.counter).padStart(4, "0")}`;
    });
    console.log(`\nGRN number: ${grnNumber}`);

    // ── 7. Create GRN + lines ──────────────────────────────────────────────
    const grn = await db.gRN.create({
      data: {
        organizationId: org.id,
        number:         grnNumber,
        vendorId:       SHOWROOM_VENDOR_ID,
        receivedAt:     CAPTURE_DATE,
        invoiceRef:     GRN_INVOICE_REF,
        lines: {
          create: ROWS.map((row, i) => ({
            organizationId: org.id,
            colourwayId:    colourwayIdByRow.get(i)!,
            quantity:       row.qty,
            rejectedQty:    0,
            rate:           0,
            // dyeLot intentionally omitted — hardware has no batch/dye-lot concept
          })),
        },
      },
    });
    console.log(`GRN created: ${grn.id}`);

    // ── 8. StockBalance (upsert) + StockMove (GRN_IN) ─────────────────────
    console.log(`\nWriting ${ROWS.length} StockBalance rows…`);

    // Prisma's generated compound-unique type (StockBalanceColourwayIdDyeLotCompoundUniqueInput)
    // requires dyeLot: string, not string|null — so upsert via that key is impossible when
    // dyeLot is null. We're behind the idempotency GRN guard, so createMany is safe here:
    // this block executes at most once per import run.
    await db.stockBalance.createMany({
      data: ROWS.map((row, i) => ({
        organizationId: org.id,
        colourwayId:    colourwayIdByRow.get(i)!,
        dyeLot:         null,
        quantity:       row.qty,
        reserved:       0,
        value:          0,
      })),
    });

    await db.stockMove.createMany({
      data: ROWS.map((row, i) => ({
        organizationId: org.id,
        colourwayId:    colourwayIdByRow.get(i)!,
        dyeLot:         null,
        type:           "GRN_IN" as const,
        quantity:       row.qty,
        rate:           0,
        refType:        "GRN",
        refId:          grn.id,
        occurredAt:     CAPTURE_DATE,
        createdById:    admin.id,
      })),
    });
    console.log("Stock records written.");

    // ── 9. Verify ──────────────────────────────────────────────────────────
    console.log(`\n${"─".repeat(70)}`);
    console.log("VERIFICATION");
    console.log(`${"─".repeat(70)}`);
    await verify(db, org.id);
  } finally {
    await db.$disconnect();
  }
}

// ── Verification ───────────────────────────────────────────────────────────

async function verify(db: PrismaClient, orgId: string): Promise<void> {
  const hwFamilies = ["HARDWARE_TRACK", "HARDWARE_ROD", "MOTOR"] as const;

  // Fetch all StockBalance rows for hardware colourways under Ready Stock brand
  const balances = await db.stockBalance.findMany({
    where: {
      organizationId: orgId,
      colourway: {
        design: {
          family: { in: [...hwFamilies] },
          collection: { brandId: READY_STOCK_BRAND_ID },
        },
      },
    },
    include: {
      colourway: {
        include: { design: { include: { collection: true } } },
      },
    },
    orderBy: [
      { colourway: { design: { collection: { name: "asc" } } } },
      { colourway: { code: "asc" } },
    ],
  });

  let totalPieces = 0;
  let currentCollection = "";

  for (const b of balances) {
    const collName = b.colourway.design.collection.name;
    if (collName !== currentCollection) {
      currentCollection = collName;
      console.log(`\n  [${collName}]`);
    }
    const qty = Number(b.quantity);
    totalPieces += qty;
    console.log(
      `    ✓ ${b.colourway.code.padEnd(28)} qty:${String(qty).padStart(2)} pc  colourName:"${b.colourway.colourName}"`
    );
  }

  // By collection
  const byCollection: Record<string, { skus: number; pcs: number }> = {};
  for (const b of balances) {
    const k = b.colourway.design.collection.name;
    byCollection[k] ??= { skus: 0, pcs: 0 };
    byCollection[k]!.skus++;
    byCollection[k]!.pcs += Number(b.quantity);
  }

  console.log(`\n  ── Totals by collection ──`);
  for (const [name, v] of Object.entries(byCollection).sort()) {
    console.log(`  ${name.padEnd(22)} ${v.skus} SKUs, ${v.pcs} pcs`);
  }

  // Collect colourway IDs from the balances we already fetched (avoids
  // an invalid nested relation filter on StockMoveWhereInput).
  const hwCwIds = balances.map((b) => b.colourwayId);

  const moveCount = await db.stockMove.count({
    where: {
      organizationId: orgId,
      type:           "GRN_IN",
      refType:        "GRN",
      colourwayId:    { in: hwCwIds },
    },
  });

  const grnLineCount = await db.gRNLine.count({
    where: {
      organizationId: orgId,
      grn: { invoiceRef: GRN_INVOICE_REF },
    },
  });

  console.log(`\n  SKUs (StockBalance rows) : ${balances.length}  (expected 28)`);
  console.log(`  Total pieces             : ${totalPieces}  (expected 43)`);
  console.log(`  GRN lines                : ${grnLineCount}  (expected 28)`);
  console.log(`  StockMove GRN_IN rows    : ${moveCount}  (expected 28)`);

  const pass =
    balances.length === 28 &&
    totalPieces      === 43 &&
    grnLineCount     === 28 &&
    moveCount        === 28;

  if (pass) {
    console.log("\n✓  Verification PASSED — 28 SKUs, 43 pieces, all records consistent.");
    console.log("\n  Excluded (pending confirmation):");
    console.log("    PLYWOOD    — 2 pcs — family ambiguous (HARDWARE_TRACK vs ACCESSORY)");
    console.log("    ANTICRAFF  — 2 pcs (32 in, 33 in) — track vs rod unclear");
  } else {
    console.log("\n✗  Verification FAILED — check output above.");
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

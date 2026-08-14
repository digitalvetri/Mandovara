// Seed a real Mandovara catalog — all 9 product families with the
// sub-types and image URLs pulled from mandovara.com on 2026-08-14.
//
// Structure:
//   Brand "Mandovara Studio"
//     Collection per family (Curtains, Blinds, Wallpaper, ...)
//       Design per sub-type (Sheer, Main, Motorized, Zebra, ...)
//         Colourway "Standard" carrying the mandovara.com image URL
//           Price row (RETAIL) at a starter rate you can revise later
//
// Idempotent — every insert goes through upsert on the schema's
// unique key. Safe to re-run; running it doesn't duplicate rows or
// stomp on the price history.
//
// Run:  pnpm tsx scripts/add-catalog.ts
//
// After running, open the quick-quote picker (/quotations/quick?client=<id>)
// — the catalog picker will search across every colourway added here.

import { PrismaClient, type SellUnit } from "@prisma/client";

// ── Types ────────────────────────────────────────────────────────

interface DesignSpec {
  code:       string;     // short unique code inside collection, e.g. "SHR-01"
  name:       string;     // display name
  family:     string;     // must match ProductFamily enum
  sellUnit:   SellUnit;   // per-unit for pricing
  hsn:        string;
  gstRatePct: number;
  ratePaise:  bigint;     // default RETAIL price
  imageUrl:   string;     // mandovara.com image
  hex?:       string;     // fallback swatch colour
}

interface CollectionSpec {
  name:    string;
  family:  string;
  designs: DesignSpec[];
}

// ── Config from mandovara.com (2026-08-14) ───────────────────────

const BRAND_NAME = "Mandovara Studio";

const COLLECTIONS: CollectionSpec[] = [
  {
    name:   "Curtains",
    family: "CURTAIN_FABRIC",
    designs: [
      { code: "SHR-01", name: "Sheer Curtain",     family: "SHEER",          sellUnit: "METRE", hsn: "5407", gstRatePct: 12, ratePaise: 60000n,
        imageUrl: "https://mandovara.com/wp-content/uploads/2023/03/9e717e39559b0fe0dedecfa4b41c0e25.jpg", hex: "#EFE9DC" },
      { code: "MAIN-01", name: "Main Curtain",     family: "CURTAIN_FABRIC", sellUnit: "METRE", hsn: "5407", gstRatePct: 12, ratePaise: 120000n,
        imageUrl: "https://mandovara.com/wp-content/uploads/2023/03/main_beige_chic_2_1_1_1_1_1_1_1.png", hex: "#C8B79A" },
      { code: "MOT-01", name: "Motorized Curtain", family: "CURTAIN_FABRIC", sellUnit: "PIECE", hsn: "5407", gstRatePct: 12, ratePaise: 3500000n,
        imageUrl: "https://mandovara.com/wp-content/uploads/2023/03/dove-grey-electric-remote-control-roller-blind.jpg", hex: "#7A7B7E" },
    ],
  },
  {
    name:   "Blinds",
    family: "BLIND",
    designs: [
      { code: "BLD-ROL", name: "Roller Blind",         family: "BLIND", sellUnit: "SQFT", hsn: "6303", gstRatePct: 12, ratePaise: 24000n,
        imageUrl: "https://mandovara.com/wp-content/uploads/2023/03/04_half_blind_wall_4.jpg", hex: "#D8CFB8" },
      { code: "BLD-ZEB", name: "Zebra Blind",          family: "BLIND", sellUnit: "SQFT", hsn: "6303", gstRatePct: 12, ratePaise: 30000n,
        imageUrl: "https://mandovara.com/wp-content/uploads/2023/03/0063478-0135_2000_x_2000_pix_11_1_2.jpg", hex: "#B8B0A2" },
      { code: "BLD-PNL", name: "Panel Blind",          family: "BLIND", sellUnit: "SQFT", hsn: "6303", gstRatePct: 12, ratePaise: 36000n,
        imageUrl: "https://mandovara.com/wp-content/uploads/2023/03/panel-blind-1.jpg", hex: "#8E8A82" },
      { code: "BLD-PRT", name: "Customized Printed Blind", family: "BLIND", sellUnit: "SQFT", hsn: "6303", gstRatePct: 12, ratePaise: 42000n,
        imageUrl: "https://mandovara.com/wp-content/uploads/2023/03/il_fullxfull.3760466594_gdy7.webp", hex: "#7E6B4A" },
      { code: "BLD-SMT", name: "Smart Curtain",        family: "BLIND", sellUnit: "PIECE", hsn: "6303", gstRatePct: 18, ratePaise: 4500000n,
        imageUrl: "https://mandovara.com/wp-content/uploads/2023/03/71Q7TjhwDZL._AC_UF10001000_QL80_.jpg", hex: "#EEEBE6" },
      { code: "BLD-CEL", name: "Cellular Blind",       family: "BLIND", sellUnit: "SQFT", hsn: "6303", gstRatePct: 12, ratePaise: 38000n,
        imageUrl: "https://mandovara.com/wp-content/uploads/2023/03/715CB5TTnOL._SL1500_.jpg", hex: "#EFECE1" },
      { code: "BLD-WOD", name: "Wooden Blind",         family: "BLIND", sellUnit: "SQFT", hsn: "6303", gstRatePct: 12, ratePaise: 55000n,
        imageUrl: "https://mandovara.com/wp-content/uploads/2023/03/touched_by_design_woodlux_light_oak.webp", hex: "#B78E5A" },
      { code: "BLD-EXT", name: "Weather Exterior Blind", family: "BLIND", sellUnit: "SQFT", hsn: "6303", gstRatePct: 12, ratePaise: 46000n,
        imageUrl: "https://mandovara.com/wp-content/uploads/2023/03/outdoor-blinds-qcblinds.webp", hex: "#6B7F76" },
      { code: "BLD-PVC", name: "PVC Blind",            family: "BLIND", sellUnit: "SQFT", hsn: "6303", gstRatePct: 18, ratePaise: 18000n,
        imageUrl: "https://mandovara.com/wp-content/uploads/2023/03/41518996.jpg", hex: "#DFDCD3" },
      { code: "BLD-SKY", name: "Skylight Blind",       family: "BLIND", sellUnit: "SQFT", hsn: "6303", gstRatePct: 12, ratePaise: 48000n,
        imageUrl: "https://mandovara.com/wp-content/uploads/2023/03/bCvnNWTENJwcGy73CWzmY9.jpg", hex: "#8AA5B6" },
      { code: "BLD-MOT", name: "Motorized Blind",      family: "BLIND", sellUnit: "PIECE", hsn: "6303", gstRatePct: 18, ratePaise: 3200000n,
        imageUrl: "https://mandovara.com/wp-content/uploads/2023/03/dove-grey-electric-remote-control-roller-blind.jpg", hex: "#7A7B7E" },
    ],
  },
  {
    name:   "Wallpaper",
    family: "WALLPAPER",
    designs: [
      { code: "WP-STD", name: "Standard Wallpaper Roll", family: "WALLPAPER", sellUnit: "ROLL", hsn: "4814", gstRatePct: 12, ratePaise: 250000n,
        imageUrl: "https://mandovara.com/wp-content/uploads/2023/03/growing-plants-home-concept-450x450.jpg", hex: "#D9C9B4" },
    ],
  },
  {
    name:   "Flooring",
    family: "FLOORING",
    designs: [
      { code: "FLR-LAM", name: "Laminated Flooring — Bergen Oak Grey", family: "FLOORING", sellUnit: "BOX", hsn: "4411", gstRatePct: 18, ratePaise: 480000n,
        imageUrl: "https://mandovara.com/wp-content/uploads/2023/03/03-X-Treme-12mm-D4792-Bergen-Oak-Grey.-2.jpg", hex: "#9E8869" },
      { code: "FLR-WOD", name: "Wooden Flooring",     family: "FLOORING",   sellUnit: "BOX",  hsn: "4409", gstRatePct: 12, ratePaise: 720000n,
        imageUrl: "https://mandovara.com/wp-content/uploads/2023/03/0445U_01027_ROOM.jpg", hex: "#8B6845" },
      { code: "FLR-SPC", name: "SPC Flooring",        family: "FLOORING",   sellUnit: "BOX",  hsn: "3918", gstRatePct: 18, ratePaise: 380000n,
        imageUrl: "https://mandovara.com/wp-content/uploads/2023/03/SPC-flooring-image.webp", hex: "#B7A891" },
      { code: "FLR-VIN", name: "Vinyl Flooring",      family: "FLOORING",   sellUnit: "SQFT", hsn: "3918", gstRatePct: 18, ratePaise: 12000n,
        imageUrl: "https://mandovara.com/wp-content/uploads/2023/03/preview.jpg", hex: "#C2B49B" },
    ],
  },
  {
    name:   "Carpets",
    family: "CARPET_TILE",
    designs: [
      { code: "CRP-W2W", name: "Wall-to-Wall Carpet",  family: "CARPET_ROLL", sellUnit: "SQFT", hsn: "5703", gstRatePct: 12, ratePaise: 20000n,
        imageUrl: "https://mandovara.com/wp-content/uploads/2023/03/Premium_Wall_to_Wall-min.webp", hex: "#6E4C34" },
      { code: "CRP-TIL", name: "Tile Carpet",          family: "CARPET_TILE", sellUnit: "BOX",  hsn: "5703", gstRatePct: 12, ratePaise: 550000n,
        imageUrl: "https://mandovara.com/wp-content/uploads/2023/03/81tRce0i8gL._SL1500_.jpg", hex: "#4A4740" },
    ],
  },
  {
    name:   "Upholstery",
    family: "UPHOLSTERY_FABRIC",
    designs: [
      { code: "UPH-HDB", name: "Headboard",  family: "UPHOLSTERY_FABRIC", sellUnit: "PIECE", hsn: "9403", gstRatePct: 18, ratePaise: 2500000n,
        imageUrl: "https://mandovara.com/wp-content/uploads/2023/03/Untitled-6-01.webp", hex: "#A78568" },
      { code: "UPH-CSH", name: "Cushion",    family: "UPHOLSTERY_FABRIC", sellUnit: "PIECE", hsn: "9404", gstRatePct: 18, ratePaise: 120000n,
        imageUrl: "https://mandovara.com/wp-content/uploads/2023/03/8130XocASpL._AC_SX569_.jpg", hex: "#C9A67F" },
      { code: "UPH-SFA", name: "Sofa",       family: "UPHOLSTERY_FABRIC", sellUnit: "PIECE", hsn: "9403", gstRatePct: 18, ratePaise: 6500000n,
        imageUrl: "https://mandovara.com/wp-content/uploads/2023/03/WSFABLZN3FVBL.webp", hex: "#3E4A55" },
    ],
  },
  {
    name:   "Vertical Garden",
    family: "VERTICAL_GARDEN",
    designs: [
      { code: "VG-MOD", name: "Modular Panel Vertical Garden", family: "VERTICAL_GARDEN", sellUnit: "SQFT", hsn: "3925", gstRatePct: 18, ratePaise: 65000n,
        imageUrl: "https://mandovara.com/wp-content/uploads/2023/07/vertical-wall-garden-interior-design-3d-render-450x450.jpg", hex: "#3B6B3B" },
      { code: "VG-POT", name: "Potted Plant Wall",             family: "VERTICAL_GARDEN", sellUnit: "SQFT", hsn: "3925", gstRatePct: 18, ratePaise: 55000n,
        imageUrl: "https://mandovara.com/wp-content/uploads/2023/07/growing-plants-home-concept-450x450.jpg", hex: "#4E7A3F" },
      { code: "VG-POC", name: "Pocket System Vertical Garden", family: "VERTICAL_GARDEN", sellUnit: "SQFT", hsn: "3925", gstRatePct: 18, ratePaise: 50000n,
        imageUrl: "https://mandovara.com/wp-content/uploads/elementor/thumbs/3d-render-home-interior-mockup-sofa-green-vertical-plants-background-nature-premium-product-wallpaper-rn1rewmunpwpdzvrqxbd3y7nexr8mrgeywv3ujs5xm.jpg", hex: "#5A8046" },
    ],
  },
  {
    name:   "Interior Films",
    family: "INTERIOR_FILM",
    designs: [
      { code: "FLM-GLS", name: "Glass Film",       family: "INTERIOR_FILM", sellUnit: "SQFT", hsn: "3919", gstRatePct: 18, ratePaise: 15000n,
        imageUrl: "https://mandovara.com/wp-content/uploads/2023/03/Clear-Glass-Film-1.jpg", hex: "#C6D5DA" },
      { code: "FLM-FUR", name: "Furniture Film",   family: "INTERIOR_FILM", sellUnit: "SQFT", hsn: "3919", gstRatePct: 18, ratePaise: 22000n,
        imageUrl: "https://mandovara.com/wp-content/uploads/2023/03/V2045_00257_ROOM.jpg", hex: "#8A6C4C" },
      { code: "FLM-DEC", name: "Wall Decal",       family: "INTERIOR_FILM", sellUnit: "SQFT", hsn: "3919", gstRatePct: 18, ratePaise: 18000n,
        imageUrl: "https://mandovara.com/wp-content/uploads/2023/03/W107WI14L45_02.jpeg.image_.153.115.medium.jpg", hex: "#B78E5A" },
    ],
  },
  {
    name:   "Artistic Works",
    family: "MURAL",
    designs: [
      { code: "ART-MUR", name: "Customized Mural / Painting", family: "MURAL", sellUnit: "PIECE", hsn: "9701", gstRatePct: 12, ratePaise: 1500000n,
        imageUrl: "https://mandovara.com/wp-content/uploads/2023/03/main_beige_chic_2_1_1_1_1_1_1_1.png", hex: "#8B5A2B" },
    ],
  },
];

// ── Runner ───────────────────────────────────────────────────────

async function main(): Promise<void> {
  const db = new PrismaClient();
  try {
    const org = await db.organization.findFirst({ where: { name: "Mandovara" }, select: { id: true } });
    if (!org) {
      throw new Error("Run scripts/bootstrap-admin.ts first — no Mandovara organization found.");
    }

    console.log(`Seeding catalog for org ${org.id}…\n`);

    // Brand
    const brand = await db.brand.upsert({
      where:  { organizationId_name: { organizationId: org.id, name: BRAND_NAME } },
      update: {},
      create: { organizationId: org.id, name: BRAND_NAME, country: "IN", leadTimeDays: 14 },
    });
    console.log(`Brand: ${brand.name}`);

    let designCount = 0, colourwayCount = 0, priceCount = 0;
    for (const c of COLLECTIONS) {
      const collection = await db.collection.upsert({
        where:  { organizationId_brandId_name: { organizationId: org.id, brandId: brand.id, name: c.name } },
        update: { family: c.family as never },
        create: { organizationId: org.id, brandId: brand.id, name: c.name, family: c.family as never },
      });
      console.log(`\n  Collection: ${collection.name}`);

      for (const d of c.designs) {
        const design = await db.design.upsert({
          where:  { organizationId_collectionId_code: { organizationId: org.id, collectionId: collection.id, code: d.code } },
          update: { name: d.name, family: d.family as never, hsn: d.hsn, gstRate: d.gstRatePct },
          create: {
            organizationId: org.id,
            collectionId:   collection.id,
            code:           d.code,
            name:           d.name,
            family:         d.family as never,
            hsn:            d.hsn,
            gstRate:        d.gstRatePct,
            specs:          { sourcedFrom: "mandovara.com", sourcedOn: "2026-08-14" },
          },
        });
        designCount += 1;

        // One "Standard" colourway carrying the family image + hex.
        const cwCode = `${d.code}-STD`;
        const cw = await db.colourway.upsert({
          where:  { organizationId_code: { organizationId: org.id, code: cwCode } },
          update: { imageKey: d.imageUrl, hex: d.hex ?? null, sellUnit: d.sellUnit },
          create: {
            organizationId: org.id,
            designId:       design.id,
            code:           cwCode,
            colourName:     "Standard",
            hex:            d.hex ?? null,
            imageKey:       d.imageUrl,
            sellUnit:       d.sellUnit,
          },
        });
        colourwayCount += 1;

        // RETAIL price — one active row per colourway. Close any older
        // open row so the quick-quote picker always finds exactly one.
        const now = new Date();
        const existing = await db.price.findFirst({
          where:  { colourwayId: cw.id, tier: "RETAIL", effectiveTo: null },
          select: { id: true, amount: true },
        });
        if (existing && existing.amount === d.ratePaise) {
          // no-op — already priced at target
        } else {
          if (existing) {
            await db.price.update({ where: { id: existing.id }, data: { effectiveTo: now } });
          }
          await db.price.create({
            data: {
              organizationId: org.id,
              colourwayId:    cw.id,
              tier:           "RETAIL",
              amount:         d.ratePaise,
              effectiveFrom:  now,
            },
          });
          priceCount += 1;
        }
        console.log(`    ${d.code.padEnd(10)}  ${d.name.padEnd(38)}  ₹${(Number(d.ratePaise) / 100).toLocaleString("en-IN")} / ${d.sellUnit.toLowerCase()}`);
      }
    }

    console.log("\n" + "─".repeat(48));
    console.log(`  Designs upserted:     ${designCount}`);
    console.log(`  Colourways upserted:  ${colourwayCount}`);
    console.log(`  Price rows created:   ${priceCount}`);
    console.log("─".repeat(48));
    console.log("\n✓ Catalog seed complete. Quick-quote picker will now find these items.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

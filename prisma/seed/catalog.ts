import { PrismaClient } from "@prisma/client";
import type {
  Prisma,
  ProductFamily,
  PatternMatch,
  SellUnit,
  SampleStatus,
} from "@prisma/client";
import { BRANDS, COLOUR_NAMES, COLOUR_HEX } from "./data";
import { makeRng } from "./rng";

// ─── Exported types ───────────────────────────────────────────────────────────

export interface SeedCatalogResult {
  brandIds: string[];
  colourwayIds: string[];
  colourwayMeta: Map<string, { family: string; sellUnit: string; costPaise: bigint }>;
  sampleBookIds: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derive a 3-character uppercase brand prefix that is unique in the seen set. */
function uniquePrefix(name: string, seen: Set<string>): string {
  // Strip non-alpha, take first 3 uppercase letters
  const alpha = name.toUpperCase().replace(/[^A-Z]/g, "");
  const base = alpha.slice(0, 3).padEnd(3, "X");
  if (!seen.has(base)) {
    seen.add(base);
    return base;
  }
  // On collision: try replacing last char with 'A'–'Z'
  for (let c = 65; c <= 90; c++) {
    const candidate = base.slice(0, 2) + String.fromCharCode(c);
    if (!seen.has(candidate)) {
      seen.add(candidate);
      return candidate;
    }
  }
  // Fallback: append brand index letters
  for (let c = 65; c <= 90; c++) {
    for (let d = 65; d <= 90; d++) {
      const candidate = base.slice(0, 1) + String.fromCharCode(c) + String.fromCharCode(d);
      if (!seen.has(candidate)) {
        seen.add(candidate);
        return candidate;
      }
    }
  }
  throw new Error(`Cannot generate unique prefix for brand: ${name}`);
}

/** Derive pattern repeat + match that are always consistent.
 *  Rule: repeat=0 (or absent) → match must be FREE. */
function resolvePattern(
  tmpl: { patternRepeats?: number[]; patternMatches?: string[] },
  rng: ReturnType<typeof makeRng>,
): { patternRepeatMm: number | null; patternMatch: PatternMatch } {
  const repeats = tmpl.patternRepeats;
  const matches = tmpl.patternMatches;

  // No patterns defined for this family (blinds, flooring, vertical garden, etc.)
  if (!repeats || repeats.length === 0) {
    return { patternRepeatMm: null, patternMatch: "FREE" };
  }

  // Pick a repeat value
  const repeat = rng.pick(repeats as readonly number[]);

  if (repeat === 0) {
    return { patternRepeatMm: null, patternMatch: "FREE" };
  }

  // Repeat > 0: pick a non-FREE match
  const nonFreeMatches = (matches ?? []).filter((m) => m !== "FREE");
  let match: PatternMatch;
  if (nonFreeMatches.length > 0) {
    match = rng.pick(nonFreeMatches as readonly string[]) as PatternMatch;
  } else {
    // Template only has FREE but gave us a non-zero repeat — default to STRAIGHT
    match = "STRAIGHT";
  }

  return { patternRepeatMm: repeat, patternMatch: match };
}

/** Build a family-appropriate specs JSON object. */
function buildSpecs(family: string, tmpl: { gsm?: number; areaPerBoxSqft?: number; tileSizeMm?: string; rollWidthMm?: number }): Record<string, unknown> {
  switch (family) {
    case "CURTAIN_FABRIC":
    case "SHEER":
    case "LINING":
    case "UPHOLSTERY_FABRIC":
      return { family, gsm: tmpl.gsm ?? 150, finish: "woven", backing: family === "LINING" ? "blackout" : "none" };
    case "WALLPAPER":
      return { family, surface: "non-woven", strippable: true, washable: "class-2" };
    case "BLIND":
      return { family, motorizable: false, cordless: false };
    case "FLOORING":
      return { family, layPattern: "STRAIGHT", underlayIncluded: false, acClass: 4 };
    case "CARPET_ROLL":
      return { family, pile: "cut", fiberContent: "80% wool 20% nylon", backing: "jute" };
    case "CARPET_TILE":
      return { family, pile: "loop", fiberContent: "100% nylon", backing: "bitumen" };
    case "INTERIOR_FILM":
      return { family, adhesive: "pressure-sensitive", removable: true, uv: "outdoor-rated" };
    case "VERTICAL_GARDEN":
      return { family, wateringSystem: "drip", lightRequirement: "indirect" };
    default:
      return { family };
  }
}

/** Generate an ordinal suffix suffix word for design naming. */
function ordinalWord(n: number): string {
  const words = [
    "I","II","III","IV","V","VI","VII","VIII","IX","X",
    "XI","XII","XIII","XIV","XV","XVI","XVII","XVIII","XIX","XX",
  ];
  return words[n - 1] ?? String(n);
}

/** Build a human-readable design name from the collection name and design index. */
function buildDesignName(collectionName: string, family: string, designIndex: number): string {
  const suffix = ordinalWord(designIndex);
  switch (family) {
    case "CURTAIN_FABRIC":
    case "SHEER":
    case "LINING":
      return `${collectionName} — ${suffix}`;
    case "WALLPAPER":
      return `${collectionName} ${suffix}`;
    case "BLIND":
      return `${collectionName} ${String(designIndex).padStart(2, "0")}`;
    case "FLOORING":
    case "CARPET_ROLL":
    case "CARPET_TILE":
      return `${collectionName} ${String(designIndex).padStart(2, "0")}`;
    case "INTERIOR_FILM":
      return `${collectionName} ${suffix}`;
    case "VERTICAL_GARDEN":
      return `${collectionName} ${suffix}`;
    default:
      return `${collectionName} — Design ${String(designIndex).padStart(2, "0")}`;
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function seedCatalog(
  db: PrismaClient,
  organizationId: string,
  seed = 43,
): Promise<SeedCatalogResult> {
  const rng = makeRng(seed);
  const effectiveFrom = new Date("2024-04-01");

  // Pre-built rows
  const brandRows: Prisma.BrandCreateManyInput[] = [];
  const collectionRows: Prisma.CollectionCreateManyInput[] = [];
  const designRows: Prisma.DesignCreateManyInput[] = [];
  const colourwayRows: Prisma.ColourwayCreateManyInput[] = [];
  const priceRows: Prisma.PriceCreateManyInput[] = [];
  const sampleBookRows: Prisma.SampleBookCreateManyInput[] = [];

  // Tracking
  const brandIds: string[] = [];
  const colourwayIds: string[] = [];
  const colourwayMeta = new Map<string, { family: string; sellUnit: string; costPaise: bigint }>();
  const sampleBookIds: string[] = [];

  // Used to guarantee globally unique brand prefixes
  const seenPrefixes = new Set<string>();
  // Global colourway code uniqueness guard (@@unique on [organizationId, code])
  const seenCwCodes = new Set<string>();
  // Global sample book barcode uniqueness guard
  const seenBarcodes = new Set<string>();

  let sbSeq = 0; // global sample book sequence

  for (const brandSpec of BRANDS) {
    const brandId = crypto.randomUUID();
    const brandPrefix = uniquePrefix(brandSpec.name, seenPrefixes);

    brandRows.push({
      id: brandId,
      organizationId,
      name: brandSpec.name,
      country: brandSpec.country,
      leadTimeDays: brandSpec.leadTimeDays,
      isActive: true,
    });
    brandIds.push(brandId);

    for (let ci = 0; ci < brandSpec.collections.length; ci++) {
      const collSpec = brandSpec.collections[ci]!;
      const collId = crypto.randomUUID();
      const collIdx = String(ci + 1).padStart(2, "0");

      collectionRows.push({
        id: collId,
        organizationId,
        brandId,
        name: collSpec.name,
        family: collSpec.family as ProductFamily,
        seasonYear: collSpec.seasonYear ?? null,
        isActive: true,
      });

      const tmpl = collSpec.designTemplate;
      const colourNameList: string[] =
        COLOUR_NAMES[collSpec.family] ?? COLOUR_NAMES["WALLPAPER"]!;

      const actualDesignCount = Math.round(collSpec.designCount * 1.6);
      for (let d = 0; d < actualDesignCount; d++) {
        const designId = crypto.randomUUID();
        const designIdx = String(d + 1).padStart(3, "0");
        const designCode = `${brandPrefix}-${collIdx}-D${designIdx}`;

        const { patternRepeatMm, patternMatch } = resolvePattern(tmpl, rng);

        const designName = buildDesignName(collSpec.name, collSpec.family, d + 1);

        const specs = buildSpecs(collSpec.family, tmpl);

        designRows.push({
          id: designId,
          organizationId,
          collectionId: collId,
          code: designCode,
          name: designName,
          family: collSpec.family as ProductFamily,
          rollWidthMm: tmpl.rollWidthMm ?? null,
          rollLengthM: tmpl.rollLengthM ?? null,
          fabricWidthMm: tmpl.fabricWidthMm ?? null,
          patternRepeatMm,
          patternMatch,
          railroadable: tmpl.railroadable ?? false,
          areaPerBoxSqft: tmpl.areaPerBoxSqft ?? null,
          tileSizeMm: tmpl.tileSizeMm ?? null,
          specs: specs as Prisma.InputJsonValue,
          hsn: tmpl.hsn,
          gstRate: tmpl.gstRate,
          isActive: true,
          // searchVector is omitted — populated by DB trigger
        });

        // 2–4 colourways per design, cycling through colour list
        const colourCount = 2 + (d % 3); // 2, 3, or 4
        for (let c = 0; c < colourCount; c++) {
          const colourIdx = (d * 4 + c) % colourNameList.length;
          const colourName = colourNameList[colourIdx]!;
          const hex = COLOUR_HEX[colourName] ?? null;

          // Build a unique colourway code; append suffix if collision
          let cwCode = `${designCode}-CW${c + 1}`;
          if (seenCwCodes.has(cwCode)) {
            // This should not happen given unique designCodes, but guard anyway
            let attempt = 1;
            while (seenCwCodes.has(`${cwCode}-${attempt}`)) attempt++;
            cwCode = `${cwCode}-${attempt}`;
          }
          seenCwCodes.add(cwCode);

          const cwId = crypto.randomUUID();

          colourwayRows.push({
            id: cwId,
            organizationId,
            designId,
            code: cwCode,
            colourName,
            hex,
            sellUnit: tmpl.sellUnit as SellUnit,
            isActive: true,
          });

          colourwayIds.push(cwId);

          // Cost price: random in the range
          const [costMin, costMax] = tmpl.priceRangePaise;
          const costPaise = BigInt(
            Math.round(costMin + rng.next() * (costMax - costMin)),
          );
          // MRP: cost × 1.40 (using integer arithmetic to avoid float BigInt)
          const mrpPaise = (costPaise * 140n) / 100n;

          priceRows.push({
            id: crypto.randomUUID(),
            organizationId,
            colourwayId: cwId,
            tier: "COST",
            amount: costPaise,
            effectiveFrom,
          });
          priceRows.push({
            id: crypto.randomUUID(),
            organizationId,
            colourwayId: cwId,
            tier: "MRP",
            amount: mrpPaise,
            effectiveFrom,
          });

          colourwayMeta.set(cwId, {
            family: collSpec.family,
            sellUnit: tmpl.sellUnit,
            costPaise,
          });
        }
      }

      // SampleBook for every WALLPAPER or CURTAIN_FABRIC collection
      if (collSpec.family === "WALLPAPER" || collSpec.family === "CURTAIN_FABRIC") {
        sbSeq++;
        const sbBarcode = `SB-${brandPrefix}${collIdx}-${String(sbSeq).padStart(3, "0")}`;
        // Guard against barcode collision (shouldn't happen but be safe)
        let finalBarcode = sbBarcode;
        if (seenBarcodes.has(finalBarcode)) {
          finalBarcode = `${sbBarcode}-${sbSeq}`;
        }
        seenBarcodes.add(finalBarcode);

        const sbId = crypto.randomUUID();
        // costValue: 500000–1500000 paise (₹5,000–₹15,000)
        const sbCost = BigInt(
          500000 + Math.round(rng.next() * 1000000),
        );

        sampleBookRows.push({
          id: sbId,
          organizationId,
          collectionId: collId,
          barcode: finalBarcode,
          costValue: sbCost,
          status: "IN_LIBRARY" as SampleStatus,
        });
        sampleBookIds.push(sbId);
      }
    }
  }

  // ── Bulk inserts ─────────────────────────────────────────────────────────────
  await db.brand.createMany({ data: brandRows });
  await db.collection.createMany({ data: collectionRows });
  await db.design.createMany({ data: designRows });
  await db.colourway.createMany({ data: colourwayRows });
  await db.price.createMany({ data: priceRows });
  if (sampleBookRows.length > 0) {
    await db.sampleBook.createMany({ data: sampleBookRows });
  }

  process.stdout.write(
    `  brands: ${brandRows.length}, collections: ${collectionRows.length}, ` +
    `designs: ${designRows.length}, colourways: ${colourwayRows.length}, ` +
    `prices: ${priceRows.length}, sampleBooks: ${sampleBookRows.length}\n`,
  );

  return { brandIds, colourwayIds, colourwayMeta, sampleBookIds };
}

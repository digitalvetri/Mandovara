// Vary the seed catalog's RETAIL prices in place.
//
// The original importer (scripts/add-catalog-xlsx.ts) set a single flat
// rate per family, so every blind was ₹300, every wallpaper ₹2,500 and so
// on. This script walks every active colourway, computes a deterministic
// per-SKU price from the family band in scripts/_lib/catalog-pricing.ts,
// and updates the open RETAIL price row (or creates one if missing).
//
// Idempotent — same colourway code always resolves to the same rupee
// value, so re-running is a no-op after the first pass.
//
// Run:  pnpm tsx scripts/vary-catalog-prices.ts

import { PrismaClient } from "@prisma/client";
import { priceFor, FAMILY_PRICE_BANDS } from "./_lib/catalog-pricing";

async function main(): Promise<void> {
  const db = new PrismaClient();
  try {
    const org = await db.organization.findFirst({
      where:  { name: "Mandovara" },
      select: { id: true },
    });
    if (!org) throw new Error("No Mandovara organization found — run scripts/bootstrap-admin.ts first.");

    const colourways = await db.colourway.findMany({
      where:  { organizationId: org.id, isActive: true },
      select: {
        id: true, code: true,
        design: { select: { family: true } },
      },
    });

    const now = new Date();
    let created = 0, updated = 0, unchanged = 0;
    const familyCounts = new Map<string, { min: bigint; max: bigint; count: number }>();

    for (const cw of colourways) {
      const family = cw.design.family;
      const amount = priceFor(family, cw.code);

      const existing = await db.price.findFirst({
        where:  { colourwayId: cw.id, tier: "RETAIL", effectiveTo: null },
        select: { id: true, amount: true },
      });

      if (!existing) {
        await db.price.create({
          data: {
            organizationId: org.id,
            colourwayId:    cw.id,
            tier:           "RETAIL",
            amount,
            effectiveFrom:  now,
          },
        });
        created += 1;
      } else if (existing.amount !== amount) {
        await db.price.update({
          where: { id: existing.id },
          data:  { amount },
        });
        updated += 1;
      } else {
        unchanged += 1;
      }

      const bucket = familyCounts.get(family) ?? { min: amount, max: amount, count: 0 };
      bucket.count += 1;
      if (amount < bucket.min) bucket.min = amount;
      if (amount > bucket.max) bucket.max = amount;
      familyCounts.set(family, bucket);
    }

    console.log("─".repeat(64));
    console.log(`  Colourways processed:  ${colourways.length}`);
    console.log(`  Prices created:        ${created}`);
    console.log(`  Prices updated:        ${updated}`);
    console.log(`  Prices unchanged:      ${unchanged}`);
    console.log("─".repeat(64));
    console.log("  Family                 count   min (₹)   max (₹)   band configured?");
    for (const [family, b] of [...familyCounts.entries()].sort()) {
      const configured = FAMILY_PRICE_BANDS[family] ? "yes" : "no  (default band used)";
      const min = (Number(b.min) / 100).toFixed(0);
      const max = (Number(b.max) / 100).toFixed(0);
      console.log(`  ${family.padEnd(22)} ${String(b.count).padStart(5)}   ${min.padStart(7)}   ${max.padStart(7)}   ${configured}`);
    }
    console.log("─".repeat(64));
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

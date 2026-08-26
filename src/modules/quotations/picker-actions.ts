"use server";

// Catalog picker for the quick-quote UI. Search across designs +
// colourways; return one row per colourway with everything the line
// needs (id, display name, sellUnit, gstRate, and a default rate
// from RETAIL or MRP price, else 0).
//
// Types live in ./picker-types (this file is "use server" so it can
// only export async functions).

import { z } from "zod";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import type { PickerRow } from "./picker-types";

const querySchema = z.object({
  q:       z.string().trim().max(120).optional(),
  brandId: z.string().min(20).max(64).optional(),
  family:  z.string().trim().max(50).optional(),
  limit:   z.number().int().positive().max(200).default(100),
});

export async function searchColourwaysForPicker(input: unknown): Promise<PickerRow[]> {
  const ctx = await devContext();
  requirePermission(ctx, "catalog.view");
  const parsed = querySchema.safeParse(input ?? {});
  if (!parsed.success) return [];
  const { q, brandId, family, limit } = parsed.data;

  const db = scoped(ctx);
  const where: Record<string, unknown> = { isActive: true };
  const cw: Record<string, unknown> = { isActive: true };
  if (q && q.length > 0) {
    where["OR"] = [
      { name: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
      { collection: { brand: { name: { contains: q, mode: "insensitive" } } } },
      { colourways: { some: { colourName: { contains: q, mode: "insensitive" } } } },
    ];
  }
  if (brandId) where["collection"] = { brandId };
  if (family)  where["family"] = family;

  const designs = await db.design.findMany({
    where,
    take: limit,
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, family: true, hsn: true, gstRate: true,
      collection: { select: { name: true, brand: { select: { name: true } } } },
      colourways: {
        where: cw,
        take:  4,
        select: {
          id: true, code: true, colourName: true, hex: true, imageKey: true, sellUnit: true,
          prices: {
            where: {
              tier: { in: ["RETAIL", "MRP"] },
              effectiveFrom: { lte: new Date() },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
            },
            orderBy: { effectiveFrom: "desc" },
            take:    1,
            select:  { amount: true },
          },
        },
      },
    },
  });

  const rows: PickerRow[] = [];
  for (const d of designs) {
    for (const c of d.colourways) {
      const rate = c.prices[0]?.amount ?? 0n;
      rows.push({
        colourwayId:    c.id,
        designId:       d.id,
        displayName:    `${d.name} — ${c.colourName}`,
        brandName:      d.collection.brand.name,
        collectionName: d.collection.name,
        code:           c.code,
        sellUnit:       c.sellUnit,
        hsn:            d.hsn,
        gstRate:        Number(d.gstRate),
        family:         d.family,
        ratePaise:      rate.toString(),
        hex:            c.hex,
        imageUrl:       c.imageKey,
      });
    }
  }
  return rows.slice(0, limit);
}

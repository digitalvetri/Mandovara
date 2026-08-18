"use server";

// Product server actions.
//
// A "product" in the UI corresponds to one Colourway. The create flow
// stands up the full Brand → Collection → Design → Colourway chain in
// a single transaction, upserting Brand and Collection so repeated
// creates under the same brand + family reuse the parent rows instead
// of exploding them out. Prices are written alongside.
//
// Permissions:
//   - catalog.create           create a product
//   - catalog.update           edit basic fields / set status
//   - catalog.updateCost       write COST tier (dev with the money kernel)

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import {
  createProductSchema, FAMILY_OPTIONS, type ProductFamilyKey, type SellUnitKey,
} from "./schema";
import { parsePaise, zodError } from "./actions-part2-util";

// Family label → used as the auto-created Collection name so multiple
// families under the same brand get separate collections. The
// Collection unique key is (org, brand, name) — WITHOUT family — so a
// literal "General" would collide the moment a brand ships a second
// family.
const FAMILY_TO_LABEL = new Map<string, string>(FAMILY_OPTIONS.map((f) => [f.value, f.label]));

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createProduct(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "catalog.create");

  const parsed = createProductSchema.safeParse(input);
  if (!parsed.success) return zodError<{ id: string }>(parsed.error);
  const d = parsed.data;

  const mrpPaise = parsePaise(d.mrp);
  if (mrpPaise == null) {
    return { ok: false, error: "Validation failed", fieldErrors: { mrp: "Could not parse MRP" } };
  }
  const costPaise = d.cost != null && d.cost.trim() !== "" ? parsePaise(d.cost) : null;
  if (costPaise != null) requirePermission(ctx, "catalog.updateCost");

  const now = new Date();
  const family = d.family as ProductFamilyKey;
  const sellUnit = d.sellUnit as SellUnitKey;

  try {
    const created = await withTransaction(async (tx: TxClient) => {
      // 1. Brand — find-or-create by (org, name)
      const brand = await tx.brand.upsert({
        where:  { organizationId_name: { organizationId: ctx.orgId, name: d.brandName } },
        create: { organizationId: ctx.orgId, name: d.brandName },
        update: {},
        select: { id: true },
      });

      // 2. Collection — one bucket per (brand, family). Named after
      //    the family label so the same brand can carry multiple
      //    families without violating the (org, brand, name) unique
      //    key. Users can rename/split on the PDP later.
      const collectionName = FAMILY_TO_LABEL.get(family) ?? family;
      const collection = await tx.collection.upsert({
        where: {
          organizationId_brandId_name: {
            organizationId: ctx.orgId,
            brandId:        brand.id,
            name:           collectionName,
          },
        },
        create: {
          organizationId: ctx.orgId,
          brandId:        brand.id,
          name:           collectionName,
          family,
        },
        update: {},
        select: { id: true },
      });

      // 3. Design — one per code within the collection. Family-specific
      //    physical fields (rollWidthMm, patternRepeatMm, ...) stay null
      //    for now; they can be filled in on the PDP so the material
      //    calculators (/lib/calc) can use them.
      const design = await tx.design.create({
        data: {
          organizationId: ctx.orgId,
          collectionId:   collection.id,
          code:           d.code,
          name:           d.name,
          family,
          hsn:            d.hsn,
          gstRate:        d.gstRate,
          specs:          {},
        },
        select: { id: true },
      });

      // 4. Colourway — the sellable SKU. Single "Standard" colour per
      //    product for the minimal create flow; add-another-colour is a
      //    follow-up on the PDP.
      const colourway = await tx.colourway.create({
        data: {
          organizationId: ctx.orgId,
          designId:       design.id,
          code:           d.code,
          colourName:     "Standard",
          sellUnit,
        },
        select: { id: true },
      });

      // 5. Prices — MRP always, COST if provided.
      const priceRows: Array<{
        organizationId: string; colourwayId: string; tier: string;
        amount: bigint; effectiveFrom: Date;
      }> = [
        {
          organizationId: ctx.orgId,
          colourwayId:    colourway.id,
          tier:           "MRP",
          amount:         mrpPaise,
          effectiveFrom:  now,
        },
      ];
      if (costPaise != null) {
        priceRows.push({
          organizationId: ctx.orgId,
          colourwayId:    colourway.id,
          tier:           "COST",
          amount:         costPaise,
          effectiveFrom:  now,
        });
      }
      await tx.price.createMany({ data: priceRows });

      return { id: colourway.id };
    }, { orgId: ctx.orgId });

    revalidatePath("/products");
    return { ok: true, data: created };
  } catch (e: unknown) {
    // Unique-constraint on (organizationId, code) — friendly message.
    const err = e as { code?: string; meta?: { target?: string[] } };
    if (err?.code === "P2002") {
      return {
        ok: false,
        error: "A product with this code already exists.",
        fieldErrors: { code: "This code is already in use — pick another." },
      };
    }
    throw e;
  }
}

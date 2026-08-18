"use server";
/* eslint-disable max-lines -- FIXME(§10): 338 lines, limit 300. Split by concern before the next phase; the rule stays enforced so this stays visible. */

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

import type { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/kernel/rbac/guard";
import { parseINR } from "@/kernel/money/format";
import { devContext } from "@/lib/dev-context";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import {
  createProductSchema, updateProductSchema, setStatusSchema,
  FAMILY_OPTIONS, SIZE_TIER_PREFIX,
  type ProductFamilyKey, type SellUnitKey,
} from "./schema";

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

export async function updateProduct(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "catalog.update");

  const parsed = updateProductSchema.safeParse(input);
  if (!parsed.success) return zodError<{ id: string }>(parsed.error);
  const { id, ...rest } = parsed.data;

  const db = scoped(ctx);
  const cw = await db.colourway.findUnique({
    where:  { id },
    select: {
      id: true, designId: true,
      design: { select: { specs: true } },
    },
  });
  if (!cw) return { ok: false, error: "Product not found" };

  // COST needs a stronger permission — check before opening the tx.
  const costRaw = rest.cost;
  if (costRaw != null && costRaw.trim() !== "") {
    requirePermission(ctx, "catalog.updateCost");
  }
  const costPaise = costRaw != null && costRaw.trim() !== "" ? parsePaise(costRaw) : null;

  // Merge specs JSON — keep the sourcing markers (page/slot/etc.) and
  // any keys we don't manage; overwrite the fields the form owns.
  const existingSpecs = (cw.design.specs && typeof cw.design.specs === "object" && !Array.isArray(cw.design.specs))
    ? cw.design.specs as Record<string, unknown>
    : {};
  const nextSpecs: Record<string, unknown> = { ...existingSpecs };
  if (rest.pileYarn !== undefined) {
    if (rest.pileYarn === "") delete nextSpecs["pileYarn"];
    else nextSpecs["pileYarn"] = rest.pileYarn;
  }
  if (rest.points !== undefined) {
    if (rest.points === "") delete nextSpecs["points"];
    else nextSpecs["points"] = rest.points;
  }
  if (rest.extraSpecs !== undefined) {
    // Rebuild the "extra" bucket cleanly. Anything not in extraSpecs is
    // dropped from the JSON (except the reserved sourcing markers).
    const reserved = new Set(["sourcedFrom", "sourcedOn", "sheet", "page", "slot", "series", "pileYarn", "points"]);
    for (const k of Object.keys(nextSpecs)) {
      if (!reserved.has(k)) delete nextSpecs[k];
    }
    for (const row of rest.extraSpecs) {
      if (row.key.trim() && row.value.trim()) nextSpecs[row.key.trim()] = row.value.trim();
    }
  }

  await withTransaction(async (tx: TxClient) => {
    // Colourway — code / sellUnit
    if (rest.code != null || rest.sellUnit != null) {
      await tx.colourway.update({
        where: { id },
        data: {
          ...(rest.code != null     && { code: rest.code }),
          ...(rest.sellUnit != null && { sellUnit: rest.sellUnit }),
        },
      });
    }

    // Design — name / hsn / gstRate / gsm / thicknessMm / specs / code
    const designUpdates: Record<string, unknown> = {};
    if (rest.name != null)    designUpdates["name"]    = rest.name;
    if (rest.hsn != null)     designUpdates["hsn"]     = rest.hsn;
    if (rest.gstRate != null) designUpdates["gstRate"] = rest.gstRate;
    if (rest.code != null)    designUpdates["code"]    = rest.code;
    if (rest.gsm !== undefined) {
      designUpdates["gsm"] = rest.gsm === "" || rest.gsm === null ? null : rest.gsm;
    }
    if (rest.pileHeightMm !== undefined) {
      designUpdates["thicknessMm"] = rest.pileHeightMm === "" || rest.pileHeightMm === null ? null : rest.pileHeightMm;
    }
    if (rest.pileYarn !== undefined || rest.points !== undefined || rest.extraSpecs !== undefined) {
      designUpdates["specs"] = nextSpecs;
    }
    if (Object.keys(designUpdates).length > 0) {
      await tx.design.update({ where: { id: cw.designId }, data: designUpdates });
    }

    // Prices — SIZE:* rows are replace-all. Legacy single MRP row is
    // cleared as soon as size prices exist so we don't display both.
    if (rest.sizePrices !== undefined) {
      const now = new Date();
      const rows = rest.sizePrices.filter((r) => r.price.trim() !== "");
      await tx.price.deleteMany({
        where: {
          colourwayId: id,
          OR: [
            { tier: { startsWith: SIZE_TIER_PREFIX } },
            { tier: "MRP" },
          ],
        },
      });
      if (rows.length > 0) {
        await tx.price.createMany({
          data: rows.map((r) => {
            const paise = parsePaise(r.price);
            if (paise == null) throw new Error(`Invalid price for size ${r.tier}: "${r.price}"`);
            return {
              organizationId: ctx.orgId,
              colourwayId:    id,
              tier:           `${SIZE_TIER_PREFIX}${r.tier}`,
              amount:         paise,
              effectiveFrom:  now,
            };
          }),
        });
      }
    }

    // COST — single-tier revision (close open, insert new).
    if (costPaise != null) {
      await tx.price.updateMany({
        where: { colourwayId: id, tier: "COST", effectiveTo: null },
        data:  { effectiveTo: new Date() },
      });
      await tx.price.create({
        data: {
          organizationId: ctx.orgId,
          colourwayId:    id,
          tier:           "COST",
          amount:         costPaise,
          effectiveFrom:  new Date(),
        },
      });
    }
  });

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  return { ok: true, data: { id } };
}

export async function setProductStatus(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "catalog.update");

  const parsed = setStatusSchema.safeParse(input);
  if (!parsed.success) return zodError<{ id: string }>(parsed.error);
  const { id, status } = parsed.data;

  const isActive = status === "ACTIVE";
  const db = scoped(ctx);
  await db.colourway.update({ where: { id }, data: { isActive } });

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  return { ok: true, data: { id } };
}

// ── helpers ─────────────────────────────────────────────────────────

function zodError<T>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path
      .filter((seg): seg is string | number => typeof seg === "string" || typeof seg === "number")
      .join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}

function parsePaise(v: string): bigint | null {
  try { return parseINR(v); } catch { return null; }
}

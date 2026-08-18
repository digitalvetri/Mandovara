"use server";

// Split out of actions.ts to stay under the §10 300-line limit.


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
import { scoped } from "@/kernel/db/scoped";
import { updateProductSchema, setStatusSchema, SIZE_TIER_PREFIX } from "./schema";
import { ActionResult } from "./actions";
import { parsePaise, zodError } from "./actions-part2-util";

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



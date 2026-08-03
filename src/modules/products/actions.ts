"use server";

// Product server actions.
//   - permissions checked (Rule 8)
//   - Zod validation (schema.ts)
//   - db.scoped(ctx) so tenant scope + audit apply (Rules 1, 4)
//   - category is find-or-created inline so first-time users are not
//     blocked by "create category first" ceremony
//
// TODO event union: add product.created / product.priceRevised /
// product.statusChanged when the next kernel diff is applied.

import type { z } from "zod";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { parseINR } from "@/kernel/money/format";
import { devContext } from "@/lib/dev-context";
import type { RequestContext } from "@/kernel/auth/context";
import {
  createProductSchema, updateProductSchema, setStatusSchema,
} from "./schema";

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

  const db = scoped(ctx);
  const categoryId = await findOrCreateCategory(ctx, d.categoryName);

  const now = new Date();
  const mrpPaise  = parsePaise(d.mrp);
  if (mrpPaise == null) {
    return { ok: false, error: "Validation failed", fieldErrors: { mrp: "Could not parse MRP" } };
  }
  const costPaise = d.cost != null && d.cost.trim() !== "" ? parsePaise(d.cost) : null;
  if (costPaise != null) requirePermission(ctx, "catalog.updateCost");

  const created = await db.product.create({
    data: {
      orgId:        ctx.orgId,
      code:         d.code,
      name:         d.name,
      categoryId,
      hsn:          d.hsn,
      uom:          d.uom,
      uomPrecision: d.uomPrecision,
      gstRate:      d.gstRate,
      status:       "ACTIVE",
      reorderLevel: d.reorderLevel && d.reorderLevel.trim() !== "" ? d.reorderLevel : null,
      minStock:     d.minStock     && d.minStock.trim() !== ""     ? d.minStock     : null,
      trackBatch:   d.trackBatch ?? false,
      trackSerial:  d.trackSerial ?? false,
      createdById:  ctx.userId,
      updatedById:  ctx.userId,
      prices: {
        create: [
          { tier: "MRP",  amount: mrpPaise,  effectiveFrom: now },
          ...(costPaise != null
            ? [{ tier: "COST" as const, amount: costPaise, effectiveFrom: now }]
            : []),
        ],
      },
    },
    select: { id: true },
  });

  revalidatePath("/products");
  return { ok: true, data: { id: created.id } };
}

export async function updateProduct(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "catalog.update");

  const parsed = updateProductSchema.safeParse(input);
  if (!parsed.success) return zodError<{ id: string }>(parsed.error);
  const { id, categoryName, mrp, cost, ...rest } = parsed.data;

  const db = scoped(ctx);
  const categoryId = categoryName != null && categoryName.trim().length > 0
    ? await findOrCreateCategory(ctx, categoryName)
    : undefined;

  await db.product.update({
    where: { id },
    data: {
      ...(rest.code != null         && { code: rest.code }),
      ...(rest.name != null         && { name: rest.name }),
      ...(categoryId != null        && { categoryId }),
      ...(rest.hsn != null          && { hsn: rest.hsn }),
      ...(rest.uom != null          && { uom: rest.uom }),
      ...(rest.uomPrecision != null && { uomPrecision: rest.uomPrecision }),
      ...(rest.gstRate != null      && { gstRate: rest.gstRate }),
      ...(rest.reorderLevel != null && { reorderLevel: emptyToNullNum(rest.reorderLevel) }),
      ...(rest.minStock != null     && { minStock:     emptyToNullNum(rest.minStock) }),
      ...(rest.trackBatch != null   && { trackBatch:   rest.trackBatch }),
      ...(rest.trackSerial != null  && { trackSerial:  rest.trackSerial }),
      updatedById: ctx.userId,
    },
  });

  // Price revision — close the previous open price and open a new one.
  // Bulk price revision (Session 4 acceptance criterion "versioned and reversible")
  // will live in its own action; this handles the single-product edit case.
  const now = new Date();
  if (mrp != null && mrp.trim() !== "") {
    const p = parsePaise(mrp);
    if (p != null) await reviseTier(ctx, id, "MRP", p, now);
  }
  if (cost != null && cost.trim() !== "") {
    requirePermission(ctx, "catalog.updateCost");
    const p = parsePaise(cost);
    if (p != null) await reviseTier(ctx, id, "COST", p, now);
  }

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

  const db = scoped(ctx);
  await db.product.update({ where: { id }, data: { status, updatedById: ctx.userId } });

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  return { ok: true, data: { id } };
}

// ── helpers ──────────────────────────────────────────────────────

async function findOrCreateCategory(ctx: RequestContext, name: string): Promise<string> {
  const db = scoped(ctx);
  const trimmed = name.trim();
  const existing = await db.category.findFirst({
    where: { name: { equals: trimmed, mode: "insensitive" }, parentId: null },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await db.category.create({
    data: { orgId: ctx.orgId, name: trimmed },
    select: { id: true },
  });
  return created.id;
}

async function reviseTier(
  ctx: RequestContext,
  productId: string,
  tier: "MRP" | "COST" | "DEALER" | "DISTRIBUTOR" | "PROJECT",
  amount: bigint,
  now: Date,
): Promise<void> {
  const db = scoped(ctx);
  // Close any open row for this tier
  await db.productPrice.updateMany({
    where: { productId, tier, effectiveTo: null },
    data:  { effectiveTo: now },
  });
  await db.productPrice.create({
    data: { productId, tier, amount, effectiveFrom: now },
  });
}

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
function emptyToNullNum(v: string | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

"use server";

// Catalog mutations — brands, collections, designs, colourways, prices, sample library.
// All write operations: requirePermission → Zod parse → scoped client → revalidate.
// Cost / price operations require catalog.viewCost (OWNER, ACCOUNTS only).

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import {
  BrandSchema, CollectionSchema, DesignSchema, ColourwaySchema, PriceSchema,
} from "./schema";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

function zodError<T>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".");
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}

// Prisma throws known-request errors like P2002 (unique violation) that
// otherwise surface as an unhandled server-action rejection — the client
// then falls back to the generic "Failed to create…" text. Catching here
// so we can hand the real reason back to the form. Duck-typed on the
// `code`/`meta` shape rather than `instanceof PrismaClientKnownRequestError`
// so this file doesn't need to import from @prisma/client (kernel boundary).
function prismaError<T>(err: unknown, entity: string): ActionResult<T> {
  if (err && typeof err === "object" && "code" in err && (err as { code: unknown }).code === "P2002") {
    const meta = (err as { meta?: { target?: unknown } }).meta;
    const target = Array.isArray(meta?.target) ? meta.target.join(", ") : "name";
    return { ok: false, error: `A ${entity} with the same ${target} already exists.` };
  }
  console.error(`${entity} action failed:`, err);
  return { ok: false, error: err instanceof Error ? err.message : `Failed to save ${entity}.` };
}

// ── Brands ──────────────────────────────────────────────────────────────────

export async function createBrand(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "catalog.create");

  const parsed = BrandSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  try {
    const db = scoped(ctx);
    const row = await db.brand.create({
      data: { organizationId: ctx.orgId, ...parsed.data },
      select: { id: true },
    });

    revalidatePath("/catalog");
    revalidatePath("/products");
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    return prismaError(err, "brand");
  }
}

export async function updateBrand(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "catalog.update");

  const parsed = BrandSchema.partial().safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const db = scoped(ctx);
  const row = await db.brand.update({
    where: { id },
    data: parsed.data,
    select: { id: true },
  });

  revalidatePath("/catalog");
  return { ok: true, data: { id: row.id } };
}

// ── Collections ─────────────────────────────────────────────────────────────

export async function createCollection(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "catalog.create");

  const parsed = CollectionSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  try {
    const db = scoped(ctx);
    const row = await db.collection.create({
      data: { organizationId: ctx.orgId, ...parsed.data },
      select: { id: true },
    });

    revalidatePath("/catalog");
    revalidatePath("/products");
    revalidatePath(`/products/brand/${parsed.data.brandId}`);
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    return prismaError(err, "collection");
  }
}

export async function updateCollection(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "catalog.update");

  const parsed = CollectionSchema.omit({ brandId: true }).partial().safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const db = scoped(ctx);
  const row = await db.collection.update({
    where: { id },
    data: parsed.data,
    select: { id: true },
  });

  revalidatePath("/catalog");
  return { ok: true, data: { id: row.id } };
}

// ── Designs ─────────────────────────────────────────────────────────────────

export async function createDesign(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "catalog.create");

  const parsed = DesignSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const db = scoped(ctx);
  const row = await db.design.create({
    data: {
      organizationId: ctx.orgId,
      ...parsed.data,
      // Omit searchVector — populated by DB trigger
    },
    select: { id: true },
  });

  revalidatePath("/catalog");
  return { ok: true, data: { id: row.id } };
}

export async function updateDesign(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "catalog.update");

  const parsed = DesignSchema.omit({ collectionId: true }).partial().safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const db = scoped(ctx);
  const row = await db.design.update({
    where: { id },
    data: parsed.data,
    select: { id: true },
  });

  revalidatePath("/catalog");
  return { ok: true, data: { id: row.id } };
}

// ── Colourways ───────────────────────────────────────────────────────────────

export async function createColourway(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "catalog.create");

  const parsed = ColourwaySchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const db = scoped(ctx);
  const row = await db.colourway.create({
    data: { organizationId: ctx.orgId, ...parsed.data },
    select: { id: true },
  });

  revalidatePath("/catalog");
  return { ok: true, data: { id: row.id } };
}

export async function updateColourway(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "catalog.update");

  const parsed = ColourwaySchema.omit({ designId: true }).partial().safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const db = scoped(ctx);
  const row = await db.colourway.update({
    where: { id },
    data: parsed.data,
    select: { id: true },
  });

  revalidatePath("/catalog");
  return { ok: true, data: { id: row.id } };
}

// ── Prices ───────────────────────────────────────────────────────────────────

export async function setPrice(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "catalog.priceRevise");

  const parsed = PriceSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);

  // Expire the current active price for this colourway + tier (if any)
  await db.price.updateMany({
    where: {
      colourwayId: d.colourwayId,
      tier: d.tier,
      clientId: d.clientId ?? null,
      effectiveTo: null,
    },
    data: { effectiveTo: d.effectiveFrom },
  });

  const row = await db.price.create({
    data: { organizationId: ctx.orgId, ...d },
    select: { id: true },
  });

  revalidatePath("/catalog");
  return { ok: true, data: { id: row.id } };
}

// Sample library actions (issueSampleBook, returnSampleBook) live in
// ./sample-actions.ts to keep this file under the 300-line boundary.

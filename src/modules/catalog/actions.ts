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

// ── Brands ──────────────────────────────────────────────────────────────────

export async function createBrand(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "catalog.create");

  const parsed = BrandSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const db = scoped(ctx);
  const row = await db.brand.create({
    data: { organizationId: ctx.orgId, ...parsed.data },
    select: { id: true },
  });

  revalidatePath("/catalog");
  return { ok: true, data: { id: row.id } };
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

  const db = scoped(ctx);
  const row = await db.collection.create({
    data: { organizationId: ctx.orgId, ...parsed.data },
    select: { id: true },
  });

  revalidatePath("/catalog");
  return { ok: true, data: { id: row.id } };
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

// ── Sample library ────────────────────────────────────────────────────────────

const IssueSampleSchema = z.object({
  sampleBookId: z.string().min(1),
  issuedToType: z.enum(["CLIENT", "ARCHITECT", "STAFF"]),
  clientId: z.string().min(1).optional().nullable(),
  architectId: z.string().min(1).optional().nullable(),
  userId: z.string().min(1).optional().nullable(),
  dueAt: z.date(),
  depositAmount: z.bigint().min(0n).default(0n),
  notes: z.string().max(500).optional(),
});

export async function issueSampleBook(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "catalog.update");

  const parsed = IssueSampleSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);

  const [issue] = await db.$transaction([
    db.sampleIssue.create({
      data: { organizationId: ctx.orgId, ...d },
      select: { id: true },
    }),
    db.sampleBook.update({
      where: { id: d.sampleBookId },
      data: { status: "ISSUED" },
    }),
  ]);

  revalidatePath("/samples");
  return { ok: true, data: { id: issue.id } };
}

export async function returnSampleBook(
  issueId: string,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "catalog.update");

  const db = scoped(ctx);

  const issue = await db.sampleIssue.update({
    where: { id: issueId },
    data: { returnedAt: new Date() },
    select: { id: true, sampleBookId: true },
  });

  await db.sampleBook.update({
    where: { id: issue.sampleBookId },
    data: { status: "IN_LIBRARY" },
  });

  revalidatePath("/samples");
  return { ok: true, data: { id: issue.id } };
}

"use server";

// Destructive brand-level actions — split out of pdf-actions.ts to stay
// under the 300-line boundary. Both actions share the same audit-trail
// safety rail: refuse if any transactional record (quote / order / PO /
// GRN / stock move / allocation / sample book) still references the
// affected SKUs.

import { unlink } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { PDFS_DIR } from "./pdf-paths";
import { scanTransactionalRefs } from "./refs-scan";

// Hide (or unhide) a brand from the /products view without touching
// any collections, designs, colourways, PDFs or stock underneath. Sets
// isActive to false so listBrandsWithPdf() skips the whole card. Useful
// when the stock importer materialises a brand (BRAHMOS) whose designs
// are already referenced by stock moves — a real delete would refuse,
// but we still want the brand off Product Catalog.
export async function setBrandHidden(
  brandId: string,
  hidden:  boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const ctx = await devContext();
    requirePermission(ctx, "catalog.update");
    const db = scoped(ctx);

    await db.brand.update({
      where: { id: brandId },
      data:  { isActive: !hidden },
    });

    revalidatePath("/products");
    revalidatePath(`/products/brand/${brandId}`);
    return { ok: true };
  } catch (err) {
    console.error("setBrandHidden failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Failed to toggle visibility." };
  }
}

// Delete a brand and everything under it — collections, designs,
// colourways, prices, stock balances. Empty (no designs / sample books)
// by default; set cascade:true to also sweep populated collections.
// Refuses in either mode if a transactional record still references
// the colourways — audit trail is not silently orphaned.
export async function deleteBrand(
  brandId: string,
  opts: { cascade?: boolean } = {},
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await devContext();
  requirePermission(ctx, "catalog.delete");

  const db = scoped(ctx);
  const brand = await db.brand.findUniqueOrThrow({
    where:  { id: brandId },
    select: {
      id: true,
      collections: {
        select: {
          id: true, name: true, catalogPdfKey: true,
          _count: { select: { designs: true, sampleBooks: true } },
          designs: {
            select: { id: true, colourways: { select: { id: true } } },
          },
        },
      },
    },
  });

  const collectionIds = brand.collections.map((c) => c.id);
  const designIds     = brand.collections.flatMap((c) => c.designs.map((d) => d.id));
  const colourwayIds  = brand.collections.flatMap((c) =>
    c.designs.flatMap((d) => d.colourways.map((cw) => cw.id)),
  );

  if (!opts.cascade) {
    const [blocker] = brand.collections.filter(
      (c) => c._count.designs > 0 || c._count.sampleBooks > 0,
    );
    if (blocker) {
      return {
        ok: false,
        error: `Collection "${blocker.name}" still has ${blocker._count.designs} design${blocker._count.designs === 1 ? "" : "s"} and ${blocker._count.sampleBooks} sample book${blocker._count.sampleBooks === 1 ? "" : "s"} — remove them first.`,
      };
    }
  }

  if (opts.cascade) {
    const blocking = await scanTransactionalRefs(db, colourwayIds, collectionIds);
    if (blocking) {
      return { ok: false, error: `Cannot delete: this brand's designs are still referenced by ${blocking}. Delete those first.` };
    }
  }

  for (const col of brand.collections) {
    if (col.catalogPdfKey) {
      try { await unlink(path.join(PDFS_DIR, col.catalogPdfKey)); }
      catch { /* already gone */ }
    }
  }

  try {
    await db.$transaction([
      ...(colourwayIds.length > 0
        ? [
            db.calcResult.updateMany({ where: { colourwayId: { in: colourwayIds } }, data: { colourwayId: null } }),
            db.purchaseRequestLine.updateMany({ where: { colourwayId: { in: colourwayIds } }, data: { colourwayId: null } }),
            db.stockBalance.deleteMany({ where: { colourwayId: { in: colourwayIds } } }),
            db.price.deleteMany({ where: { colourwayId: { in: colourwayIds } } }),
            db.colourway.deleteMany({ where: { id: { in: colourwayIds } } }),
          ]
        : []),
      ...(designIds.length > 0
        ? [db.design.deleteMany({ where: { id: { in: designIds } } })]
        : []),
      db.collection.deleteMany({ where: { brandId } }),
      db.brand.delete({ where: { id: brandId } }),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("deleteBrand cascade failed:", err);
    return { ok: false, error: `Delete failed: ${msg.split("\n")[0]}. Contact support if this persists.` };
  }

  revalidatePath("/products");
  revalidatePath("/catalog");
  return { ok: true };
}

// Wipe every collection under a brand — but keep the brand shell so
// PDFs can be re-uploaded fresh. Same safety rail as the cascade in
// deleteBrand.
export async function wipeBrandCollections(
  brandId: string,
): Promise<{
  ok:      boolean;
  error?:  string;
  wiped?:  { collections: number; designs: number; colourways: number };
}> {
  const ctx = await devContext();
  requirePermission(ctx, "catalog.delete");

  const db = scoped(ctx);
  const brand = await db.brand.findUniqueOrThrow({
    where:  { id: brandId },
    select: {
      id: true, name: true,
      collections: {
        select: {
          id: true, catalogPdfKey: true,
          designs: { select: { id: true, colourways: { select: { id: true } } } },
        },
      },
    },
  });

  const collectionIds = brand.collections.map((c) => c.id);
  const designIds     = brand.collections.flatMap((c) => c.designs.map((d) => d.id));
  const colourwayIds  = brand.collections.flatMap((c) =>
    c.designs.flatMap((d) => d.colourways.map((cw) => cw.id)),
  );

  if (collectionIds.length === 0) {
    return { ok: true, wiped: { collections: 0, designs: 0, colourways: 0 } };
  }

  const blocking = await scanTransactionalRefs(db, colourwayIds, collectionIds);
  if (blocking) {
    return { ok: false, error: `Cannot wipe ${brand.name}: designs are still referenced by ${blocking}. Remove those first.` };
  }

  for (const col of brand.collections) {
    if (col.catalogPdfKey) {
      try { await unlink(path.join(PDFS_DIR, col.catalogPdfKey)); }
      catch { /* already gone */ }
    }
  }

  try {
    await db.$transaction([
      ...(colourwayIds.length > 0
        ? [
            db.calcResult.updateMany({ where: { colourwayId: { in: colourwayIds } }, data: { colourwayId: null } }),
            db.purchaseRequestLine.updateMany({ where: { colourwayId: { in: colourwayIds } }, data: { colourwayId: null } }),
            db.stockBalance.deleteMany({ where: { colourwayId: { in: colourwayIds } } }),
            db.price.deleteMany({ where: { colourwayId: { in: colourwayIds } } }),
            db.colourway.deleteMany({ where: { id: { in: colourwayIds } } }),
          ]
        : []),
      ...(designIds.length > 0
        ? [db.design.deleteMany({ where: { id: { in: designIds } } })]
        : []),
      db.collection.deleteMany({ where: { brandId } }),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("wipeBrandCollections failed:", err);
    return { ok: false, error: `Wipe failed: ${msg.split("\n")[0]}` };
  }

  revalidatePath("/products");
  revalidatePath("/catalog");
  revalidatePath(`/products/brand/${brandId}`);
  return {
    ok:    true,
    wiped: { collections: collectionIds.length, designs: designIds.length, colourways: colourwayIds.length },
  };
}

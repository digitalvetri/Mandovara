"use server";

import { writeFile, unlink, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";

// `/app` reliably indicates the Docker runtime; local dev falls back to
// the repo-relative path. The pdfs subfolder is not committed (public/catalog
// is gitignored) so it may not exist at container boot — every write path
// mkdirs first.
const PDFS_DIR = existsSync("/app")
  ? "/app/public/catalog/pdfs"
  : path.resolve("public", "catalog", "pdfs");

export interface PdfActionResult {
  ok: boolean;
  error?: string;
}

export async function uploadCollectionPdf(formData: FormData): Promise<PdfActionResult> {
  try {
    const ctx = await devContext();
    requirePermission(ctx, "catalog.update");

    const collectionId = formData.get("collectionId");
    const file = formData.get("pdf");

    if (typeof collectionId !== "string" || !collectionId) return { ok: false, error: "Missing collectionId." };
    if (!file || typeof file === "string") return { ok: false, error: "No PDF file provided." };

    const f = file as File;
    if (f.type !== "application/pdf" && !f.name.endsWith(".pdf")) {
      return { ok: false, error: "Only PDF files are allowed." };
    }
    if (f.size > 200 * 1024 * 1024) return { ok: false, error: "PDF must be under 200 MB." };

    const db = scoped(ctx);
    const col = await db.collection.findUniqueOrThrow({ where: { id: collectionId } });

    await mkdir(PDFS_DIR, { recursive: true });

    if (col.catalogPdfKey) {
      const oldPath = path.join(PDFS_DIR, col.catalogPdfKey);
      try { await unlink(oldPath); } catch { /* already gone */ }
    }

    const key = `${collectionId}.pdf`;
    const dest = path.join(PDFS_DIR, key);
    const buf = Buffer.from(await f.arrayBuffer());
    await writeFile(dest, buf);

    await db.collection.update({
      where: { id: collectionId },
      data: { catalogPdfKey: key },
    });

    revalidatePath("/products");
    revalidatePath(`/products/brand/${col.brandId}`);
    return { ok: true };
  } catch (err) {
    console.error("uploadCollectionPdf failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : "PDF upload failed." };
  }
}

export async function removeCollectionPdf(collectionId: string): Promise<PdfActionResult> {
  try {
    const ctx = await devContext();
    requirePermission(ctx, "catalog.update");

    const db = scoped(ctx);
    const col = await db.collection.findUniqueOrThrow({ where: { id: collectionId } });

    if (col.catalogPdfKey) {
      const filePath = path.join(PDFS_DIR, col.catalogPdfKey);
      try { await unlink(filePath); } catch { /* already gone */ }
    }

    await db.collection.update({
      where: { id: collectionId },
      data: { catalogPdfKey: null },
    });

    revalidatePath("/products");
    revalidatePath(`/products/brand/${col.brandId}`);
    return { ok: true };
  } catch (err) {
    console.error("removeCollectionPdf failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Failed to remove PDF." };
  }
}

// Delete a brand and everything under it — collections, designs,
// colourways, prices, stock balances. Refuses if any transactional
// record still references the colourways: a quotation/order/PO/GRN
// line, a stock move, an allocation, or a sample book. Those are
// audit trail — they must not be silently orphaned or destroyed.
// The caller must set { cascade: true } to opt into the sweep; the
// bare form still requires an empty brand.
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
          id: true,
          name: true,
          catalogPdfKey: true,
          _count: { select: { designs: true, sampleBooks: true } },
          designs: {
            select: {
              id: true,
              colourways: { select: { id: true } },
            },
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

  // Non-cascade path preserves the original safety rail — refuse if any
  // collection has real product data underneath.
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

  // Cascade path: refuse if any transactional row references these colourways.
  // Cheaper to count in parallel than to open a transaction that has to roll back.
  if (opts.cascade && colourwayIds.length > 0) {
    const inCw = { colourwayId: { in: colourwayIds } };
    const inCol = { collectionId: { in: collectionIds } };
    const [quoteLines, orderLines, poLines, grnLines, stockMoves, allocations, sampleBooks] = await Promise.all([
      db.quotationLine.count({ where: inCw }),
      db.orderLine.count({ where: inCw }),
      db.pOLine.count({ where: inCw }),
      db.gRNLine.count({ where: inCw }),
      db.stockMove.count({ where: inCw }),
      db.allocation.count({ where: inCw }),
      db.sampleBook.count({ where: inCol }),
    ]);

    const parts: string[] = [];
    if (quoteLines)  parts.push(`${quoteLines} quotation line${quoteLines === 1 ? "" : "s"}`);
    if (orderLines)  parts.push(`${orderLines} order line${orderLines === 1 ? "" : "s"}`);
    if (poLines)     parts.push(`${poLines} PO line${poLines === 1 ? "" : "s"}`);
    if (grnLines)    parts.push(`${grnLines} GRN line${grnLines === 1 ? "" : "s"}`);
    if (stockMoves)  parts.push(`${stockMoves} stock move${stockMoves === 1 ? "" : "s"}`);
    if (allocations) parts.push(`${allocations} allocation${allocations === 1 ? "" : "s"}`);
    if (sampleBooks) parts.push(`${sampleBooks} sample book${sampleBooks === 1 ? "" : "s"}`);
    if (parts.length > 0) {
      return {
        ok: false,
        error: `Cannot delete: this brand's designs are still referenced by ${parts.join(", ")}. Delete those first.`,
      };
    }
  }

  // Best-effort PDF cleanup before the DB transaction — file writes aren't
  // rolled back if the DB fails, but an orphan PDF is cheaper than a
  // half-deleted brand.
  for (const col of brand.collections) {
    if (col.catalogPdfKey) {
      try { await unlink(path.join(PDFS_DIR, col.catalogPdfKey)); }
      catch { /* already gone */ }
    }
  }

  // Order matters — children before parents.
  await db.$transaction([
    ...(colourwayIds.length > 0
      ? [
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

  revalidatePath("/products");
  revalidatePath("/catalog");
  return { ok: true };
}

// Delete an empty collection. Refuses if any Design or SampleBook FKs into it
// — deleting a collection with real product data underneath would silently
// break projects/orders/stock that reference those colourways.
export async function deleteCollection(
  collectionId: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await devContext();
  requirePermission(ctx, "catalog.delete");

  const db = scoped(ctx);
  const col = await db.collection.findUniqueOrThrow({
    where:  { id: collectionId },
    select: {
      id: true, brandId: true, catalogPdfKey: true,
      _count: { select: { designs: true, sampleBooks: true } },
    },
  });

  if (col._count.designs > 0) {
    return { ok: false, error: `Collection has ${col._count.designs} design${col._count.designs === 1 ? "" : "s"} — remove them first.` };
  }
  if (col._count.sampleBooks > 0) {
    return { ok: false, error: `Collection has ${col._count.sampleBooks} sample book${col._count.sampleBooks === 1 ? "" : "s"} — remove them first.` };
  }

  if (col.catalogPdfKey) {
    const filePath = path.join(PDFS_DIR, col.catalogPdfKey);
    try { await unlink(filePath); } catch { /* already gone */ }
  }

  await db.collection.delete({ where: { id: collectionId } });

  revalidatePath("/products");
  revalidatePath(`/products/brand/${col.brandId}`);
  return { ok: true };
}

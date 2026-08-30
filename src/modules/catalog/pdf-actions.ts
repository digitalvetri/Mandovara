"use server";

import { writeFile, unlink, mkdir } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { PDFS_DIR } from "./pdf-paths";
import { scanTransactionalRefs } from "./refs-scan";
import type { PdfActionResult } from "./pdf-actions-types";

// PDFS_DIR + PdfActionResult moved to sibling files — a "use server"
// file can only export async functions. Nothing here re-exports them;
// external callers import from ./pdf-paths and ./pdf-actions-types
// directly.

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

// Delete a collection. Without cascade, refuses if the collection has any
// designs or sample books — deleting a populated collection would leave
// orphan FKs in projects/orders/stock. With cascade=true, sweeps designs +
// colourways + prices + stock balances too, but still refuses if any
// transactional record (quotes / orders / POs / GRNs / stock moves /
// allocations / sample books) still references those colourways — the
// audit trail is never silently orphaned.
export async function deleteCollection(
  collectionId: string,
  opts: { cascade?: boolean } = {},
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await devContext();
  requirePermission(ctx, "catalog.delete");

  const db = scoped(ctx);
  const col = await db.collection.findUniqueOrThrow({
    where:  { id: collectionId },
    select: {
      id: true, brandId: true, catalogPdfKey: true,
      _count:  { select: { designs: true, sampleBooks: true } },
      designs: { select: { id: true, colourways: { select: { id: true } } } },
    },
  });

  const hasContent = col._count.designs > 0 || col._count.sampleBooks > 0;

  if (hasContent && !opts.cascade) {
    const parts: string[] = [];
    if (col._count.designs)     parts.push(`${col._count.designs} design${col._count.designs === 1 ? "" : "s"}`);
    if (col._count.sampleBooks) parts.push(`${col._count.sampleBooks} sample book${col._count.sampleBooks === 1 ? "" : "s"}`);
    return { ok: false, error: `Collection has ${parts.join(" and ")} — remove them first.` };
  }

  const designIds    = col.designs.map((d) => d.id);
  const colourwayIds = col.designs.flatMap((d) => d.colourways.map((cw) => cw.id));

  if (opts.cascade) {
    const blocking = await scanTransactionalRefs(db, colourwayIds, [col.id]);
    if (blocking) {
      return { ok: false, error: `Cannot delete: this collection's designs are still referenced by ${blocking}. Delete those first.` };
    }
  }

  if (col.catalogPdfKey) {
    const filePath = path.join(PDFS_DIR, col.catalogPdfKey);
    try { await unlink(filePath); } catch { /* already gone */ }
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
      db.collection.delete({ where: { id: collectionId } }),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("deleteCollection failed:", err);
    return { ok: false, error: `Delete failed: ${msg.split("\n")[0]}` };
  }

  revalidatePath("/products");
  revalidatePath(`/products/brand/${col.brandId}`);
  return { ok: true };
}

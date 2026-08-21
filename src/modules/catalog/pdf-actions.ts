"use server";

import { writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";

const PDFS_DIR = existsSync("/app/public/catalog/pdfs")
  ? "/app/public/catalog/pdfs"
  : path.resolve("public", "catalog", "pdfs");

export async function uploadCollectionPdf(formData: FormData) {
  const ctx = await devContext();
  requirePermission(ctx, "catalog.update");

  const collectionId = formData.get("collectionId");
  const file = formData.get("pdf");

  if (typeof collectionId !== "string" || !collectionId) throw new Error("Missing collectionId");
  if (!file || typeof file === "string") throw new Error("No PDF file provided");

  const f = file as File;
  if (f.type !== "application/pdf" && !f.name.endsWith(".pdf")) {
    throw new Error("Only PDF files are allowed");
  }
  if (f.size > 200 * 1024 * 1024) throw new Error("PDF must be under 200 MB");

  const db = scoped(ctx);
  const col = await db.collection.findUniqueOrThrow({ where: { id: collectionId } });

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
}

export async function removeCollectionPdf(collectionId: string) {
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
}

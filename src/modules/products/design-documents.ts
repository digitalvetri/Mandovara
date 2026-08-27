"use server";

// Samples, brochures and room shots attached to a design.
//
// The catalog's job is to help a designer show a client what they can
// have. Codes and roll widths do not do that; photographs of the actual
// material do. This is the read/delete side of that — the upload is a
// route handler because it takes a multipart body.

import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { orgPrisma } from "@/kernel/db/rls";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import type { RequestContext } from "@/kernel/auth/context";

export type DocCategory = "SAMPLE" | "BROCHURE" | "ROOM_SHOT" | "SPEC";

export interface DesignDocument {
  id:        string;
  category:  string;
  fileKey:   string;
  fileName:  string;
  mimeType:  string;
  sizeBytes: number;
  isImage:   boolean;
  createdAt: Date;
}

export async function listDesignDocuments(
  ctx:      RequestContext,
  designId: string,
): Promise<DesignDocument[]> {
  requirePermission(ctx, "catalog.view");
  const rows = await scoped(ctx).document.findMany({
    where:   { ownerType: "DESIGN", ownerId: designId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, category: true, fileKey: true, fileName: true,
      mimeType: true, sizeBytes: true, createdAt: true,
    },
  });
  return rows.map((r) => ({ ...r, isImage: r.mimeType.startsWith("image/") }));
}

export async function deleteDesignDocument(
  documentId: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await devContext();
  requirePermission(ctx, "catalog.attachDocument");

  const db = orgPrisma(ctx.orgId);
  const doc = await db.document.findUnique({
    where:  { id: documentId },
    select: { id: true, ownerType: true, ownerId: true },
  });
  if (!doc || doc.ownerType !== "DESIGN") {
    return { ok: false, error: "That file is no longer attached to this design." };
  }

  // The row goes; the file on the volume stays. Deliberate — an orphaned
  // few KB is cheaper than a delete that races a request already serving
  // the image, and the volume is swept separately.
  await db.document.delete({ where: { id: documentId } });
  revalidatePath(`/products/${doc.ownerId}`);
  return { ok: true };
}

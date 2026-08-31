"use server";

// Attachments — write side. Upload itself is a route handler
// (src/app/api/documents/upload) because a server action cannot stream a
// multipart body; this covers the rest.

import { revalidatePath } from "next/cache";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { PermissionKey } from "@/kernel/rbac/permissions";
import { devContext } from "@/lib/dev-context";

export interface ActionResult<T = unknown> {
  ok: boolean; data?: T; error?: string;
}

const OWNER_PERMISSION: Record<string, PermissionKey> = {
  CLIENT:      "client.update",
  PROJECT:     "project.update",
  MEASUREMENT: "measurement.update",
};

/**
 * Remove an attachment: the row, then the file.
 *
 * Row first, deliberately. If the unlink fails — the volume remounted, a
 * hand-edited path — the user still sees it gone and can move on, and what
 * is left behind is an orphaned byte range rather than a row pointing at
 * nothing. The reverse order fails the other way: file gone, row still
 * rendering a broken image.
 */
export async function deleteAttachment(id: string): Promise<ActionResult> {
  const ctx = await devContext();
  const db  = scoped(ctx);

  const row = await db.document.findUnique({
    where:  { id },
    select: { id: true, ownerType: true, ownerId: true, fileKey: true },
  });
  if (!row) return { ok: false, error: "That file has already been removed." };

  const permission = OWNER_PERMISSION[row.ownerType];
  if (!permission) return { ok: false, error: "Unknown attachment target." };
  try {
    requirePermission(ctx, permission);
  } catch {
    return { ok: false, error: "You don't have permission to remove this file." };
  }

  await db.document.delete({ where: { id } });

  // fileKey is a public URL ("/catalog/files/clients/x.jpg"); the file sits
  // under public/ at the same path.
  try {
    await fs.unlink(path.join(process.cwd(), "public", row.fileKey.replace(/^\//, "")));
  } catch {
    // Already gone, or never written. The row is what the UI reads.
  }

  if (row.ownerType === "CLIENT")  revalidatePath(`/clients/${row.ownerId}`);
  if (row.ownerType === "PROJECT") revalidatePath(`/projects/${row.ownerId}`);
  return { ok: true };
}

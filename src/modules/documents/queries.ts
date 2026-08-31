// Attachments hung off a record — read side.
//
// The Document model is generic (ownerType/ownerId), so one query serves
// clients, projects and measurement rounds rather than three near-identical
// ones per module.

import { scoped } from "@/kernel/db/scoped";
import type { RequestContext } from "@/kernel/auth/context";

export type DocumentOwnerType = "CLIENT" | "PROJECT" | "MEASUREMENT";

export interface AttachmentRow {
  id:         string;
  category:   string;
  fileKey:    string;
  fileName:   string;
  mimeType:   string;
  sizeBytes:  number;
  createdAt:  Date;
  uploadedBy: string;
  /** True for the types a browser can render inline, so the caller can
   *  decide between a thumbnail grid and a file row without sniffing. */
  isImage:    boolean;
}

export async function listAttachments(
  ctx:       RequestContext,
  ownerType: DocumentOwnerType,
  ownerId:   string,
): Promise<AttachmentRow[]> {
  const db = scoped(ctx);

  const rows = await db.document.findMany({
    where:   { ownerType, ownerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, category: true, fileKey: true, fileName: true,
      mimeType: true, sizeBytes: true, createdAt: true, uploadedById: true,
    },
  });
  if (rows.length === 0) return [];

  // Same shape as every other name lookup in this codebase: batch by id
  // rather than nesting, so an unreachable user costs one dash.
  const userIds = [...new Set(rows.map((r) => r.uploadedById))];
  const users = await db.user.findMany({
    where:  { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const nameOf = new Map(users.map((u) => [u.id, u.name]));

  return rows.map((r) => ({
    id:         r.id,
    category:   r.category,
    fileKey:    r.fileKey,
    fileName:   r.fileName,
    mimeType:   r.mimeType,
    sizeBytes:  r.sizeBytes,
    createdAt:  r.createdAt,
    uploadedBy: nameOf.get(r.uploadedById) ?? "—",
    isImage:    r.mimeType.startsWith("image/"),
  }));
}

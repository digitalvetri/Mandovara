// Generic attachment upload — files and photos hung off any record.
//
// The catalog already had upload-image (one deterministic file per
// colourway) and upload-document (many files per design). Neither could
// take a file for a CLIENT or a PROJECT, which is what the owner asked
// for: "in client page we need to give a option of uploading a file or
// image".
//
// So this is the same shape as products/upload-document, generalised over
// ownerType. The Document model was already generic — ownerType/ownerId,
// category, fileKey, fileName, mimeType, sizeBytes, uploadedById — and had
// exactly one writer. This is the second.
//
// POST multipart/form-data:
//   - `ownerType` (text)  — CLIENT | PROJECT | MEASUREMENT
//   - `ownerId`   (text)
//   - `category`  (text)  — see CATEGORIES
//   - `file`      (blob)  — jpg|png|webp|pdf, <= 10MB
//
// Storage: the Coolify `catalog-assets` volume mounted at /app/public/catalog,
// the same disk every other upload in this app writes to. Next serves
// public/ at runtime, so the file is reachable immediately with no redeploy.
// Deliberately NOT a data URL in the database — measurement photos went that
// way and put base64 in a text column.

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { orgPrisma } from "@/kernel/db/rls";
import { requirePermission } from "@/kernel/rbac/guard";
import type { PermissionKey } from "@/kernel/rbac/permissions";
import { devContext } from "@/lib/dev-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  "image/jpeg":      "jpg",
  "image/jpg":       "jpg",
  "image/png":       "png",
  "image/webp":      "webp",
  "application/pdf": "pdf",
};

/** Which permission each owner type is gated on, and where it is filed.
 *  A file hung off a record is an edit to that record, so it reuses that
 *  module's update permission rather than inventing a new one. */
const OWNERS: Record<string, { permission: PermissionKey; dir: string }> = {
  CLIENT:      { permission: "client.update",      dir: "clients" },
  PROJECT:     { permission: "project.update",     dir: "projects" },
  MEASUREMENT: { permission: "measurement.update", dir: "measurements" },
};

const CATEGORIES = new Set(["PHOTO", "DOCUMENT", "DRAWING", "REFERENCE", "SITE_SHOT"]);

const BASE_DIR     = path.join(process.cwd(), "public", "catalog", "files");
const PUBLIC_ROUTE = "/catalog/files";

export async function POST(req: Request) {
  const form      = await req.formData();
  const ownerType = form.get("ownerType");
  const ownerId   = form.get("ownerId");
  const category  = form.get("category");
  const file      = form.get("file");

  if (typeof ownerType !== "string" || !OWNERS[ownerType]) {
    return NextResponse.json({ ok: false, error: "Unknown attachment target." }, { status: 400 });
  }
  const owner = OWNERS[ownerType];

  let ctx;
  try {
    ctx = await devContext();
    requirePermission(ctx, owner.permission);
  } catch {
    return NextResponse.json(
      { ok: false, error: "You don't have permission to attach files here." },
      { status: 403 },
    );
  }

  if (typeof ownerId !== "string" || !ownerId) {
    return NextResponse.json({ ok: false, error: "Missing the record to attach to." }, { status: 400 });
  }
  if (typeof category !== "string" || !CATEGORIES.has(category)) {
    return NextResponse.json({ ok: false, error: "Choose what kind of file this is." }, { status: 400 });
  }
  if (!(file instanceof Blob)) {
    return NextResponse.json({ ok: false, error: "Choose a file to upload." }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json(
      { ok: false, error: "That file type isn't supported — use a JPG, PNG, WEBP or PDF." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: `That file is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is 10MB.` },
      { status: 400 },
    );
  }

  // Confirm the target exists AND belongs to this tenant before writing a
  // byte — orgPrisma pins the org, so a foreign id simply is not found.
  const db = orgPrisma(ctx.orgId);
  const exists = await recordExists(db, ownerType, ownerId);
  if (!exists) {
    return NextResponse.json({ ok: false, error: "That record no longer exists." }, { status: 404 });
  }

  const dir    = path.join(BASE_DIR, owner.dir);
  const stored = `${ownerId}-${randomUUID()}.${ext}`;
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, stored), Buffer.from(await file.arrayBuffer()));

  const originalName = file instanceof File && file.name ? file.name : `upload.${ext}`;
  const row = await db.document.create({
    data: {
      organizationId: ctx.orgId,
      ownerType,
      ownerId,
      category,
      fileKey:      `${PUBLIC_ROUTE}/${owner.dir}/${stored}`,
      fileName:     originalName,
      mimeType:     file.type,
      sizeBytes:    file.size,
      uploadedById: ctx.userId,
    },
    select: { id: true, fileKey: true, fileName: true },
  });

  return NextResponse.json({ ok: true, id: row.id, url: row.fileKey, name: row.fileName });
}

type Db = ReturnType<typeof orgPrisma>;

async function recordExists(db: Db, ownerType: string, id: string): Promise<boolean> {
  const sel = { id: true } as const;
  if (ownerType === "CLIENT")      return !!(await db.client.findUnique({ where: { id }, select: sel }));
  if (ownerType === "PROJECT")     return !!(await db.project.findUnique({ where: { id }, select: sel }));
  if (ownerType === "MEASUREMENT") return !!(await db.measurement.findUnique({ where: { id }, select: sel }));
  return false;
}

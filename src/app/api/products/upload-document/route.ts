// Brand PDFs, sample photographs and room shots, attached to a design.
//
// Owner instruction 2026-08-27: "I will upload those documents where we
// can see the items and samples of the wallpaper, curtains etc. So the
// product catalog should be designed even better, by which the user
// feels it is the best way to present their product."
//
// POST multipart/form-data:
//   - `designId` (text)  — the design these belong to
//   - `category` (text)  — SAMPLE | BROCHURE | ROOM_SHOT | SPEC
//   - `file`     (blob)  — jpg|png|webp|pdf, <=10MB
//
// Storage mirrors upload-image: the Coolify `catalog-assets` volume
// mounted under public/catalog, so a file is reachable immediately with
// no redeploy. Rows go in `Document`, which is already polymorphic
// (ownerType + ownerId) — no schema change needed for this.

import { NextResponse } from "next/server";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { orgPrisma } from "@/kernel/db/rls";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 10MB: brand brochures are routinely 4-6MB and a 5MB cap rejected real
// files the owner needed to upload.
const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  "image/jpeg":      "jpg",
  "image/jpg":       "jpg",
  "image/png":       "png",
  "image/webp":      "webp",
  "application/pdf": "pdf",
};

const CATEGORIES = new Set(["SAMPLE", "BROCHURE", "ROOM_SHOT", "SPEC"]);

const UPLOAD_DIR   = path.join(process.cwd(), "public", "catalog", "docs");
const PUBLIC_ROUTE = "/catalog/docs";

export async function POST(req: Request): Promise<NextResponse<{ ok: boolean; id?: string; url?: string; error?: string }>> {
  let ctx;
  try {
    ctx = await devContext();
    requirePermission(ctx, "catalog.attachDocument");
  } catch {
    return NextResponse.json({ ok: false, error: "You don't have permission to attach files to the catalog." }, { status: 401 });
  }

  const form     = await req.formData();
  const designId = form.get("designId");
  const category = form.get("category");
  const file     = form.get("file");

  if (typeof designId !== "string" || !designId) {
    return NextResponse.json({ ok: false, error: "Pick a design first." }, { status: 400 });
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

  const db = orgPrisma(ctx.orgId);
  const design = await db.design.findUnique({ where: { id: designId }, select: { id: true } });
  if (!design) return NextResponse.json({ ok: false, error: "Design not found." }, { status: 404 });

  // A random filename, unlike upload-image's deterministic one: a design
  // holds MANY documents, so overwriting by id would let each new upload
  // destroy the last.
  const stored = `${designId}-${randomUUID()}.${ext}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, stored), Buffer.from(await file.arrayBuffer()));

  const originalName = (file instanceof File && file.name) ? file.name : `sample.${ext}`;
  const row = await db.document.create({
    data: {
      organizationId: ctx.orgId,
      ownerType:      "DESIGN",
      ownerId:        designId,
      category,
      fileKey:        `${PUBLIC_ROUTE}/${stored}`,
      fileName:       originalName,
      mimeType:       file.type,
      sizeBytes:      file.size,
      uploadedById:   ctx.userId,
    },
    select: { id: true, fileKey: true },
  });

  return NextResponse.json({ ok: true, id: row.id, url: row.fileKey });
}

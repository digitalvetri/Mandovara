// Colourway image upload / replace endpoint.
//
// POST multipart/form-data:
//   - `colourwayId` (text)  — target SKU
//   - `file`        (blob)  — jpg|png|webp, ≤5MB
//
// Auth via middleware's dev_uid cookie; RBAC checked here (catalog.update).
//
// Storage: writes to `/app/public/catalog/uploads/{colourwayId}.{ext}`,
// which sits on the Coolify `catalog-assets` volume mounted at
// `/app/public/catalog`. Next.js serves everything under `public/` at
// runtime, so the file becomes reachable at `/catalog/uploads/…`
// immediately without a redeploy.
//
// imageKey stored on the Colourway carries a `?v={epoch-ms}` query
// so <img src> refetches after a replace even though the filename is
// unchanged. Any older file for the same colourway (different ext) is
// deleted first so we don't accumulate orphans.

import { NextResponse } from "next/server";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { prisma } from "@/kernel/db/client";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg":  "jpg",
  "image/png":  "png",
  "image/webp": "webp",
};
// Derive from process.cwd() so the same code works locally (Windows /
// macOS repo root) and in Coolify (Dockerfile sets WORKDIR /app, so
// cwd = "/app"). PUBLIC_ROUTE is the URL Next serves this from under
// public/.
const UPLOAD_DIR = path.join(process.cwd(), "public", "catalog", "uploads");
const PUBLIC_ROUTE = "/catalog/uploads";

export async function POST(req: Request): Promise<NextResponse<{ ok: boolean; imageKey?: string; error?: string }>> {
  let ctx;
  try {
    ctx = await devContext();
    requirePermission(ctx, "catalog.update");
  } catch {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const colourwayId = form.get("colourwayId");
  const file        = form.get("file");
  if (typeof colourwayId !== "string" || !colourwayId) {
    return NextResponse.json({ ok: false, error: "colourwayId is required" }, { status: 400 });
  }
  if (!(file instanceof Blob)) {
    return NextResponse.json({ ok: false, error: "file is required" }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json(
      { ok: false, error: `Unsupported file type ${file.type}. Use JPG, PNG or WebP.` },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 5 MB.` },
      { status: 413 },
    );
  }

  // Confirm the SKU belongs to the caller's org (scoping via prisma extension
  // isn't wired for raw prisma here — do the check explicitly).
  const cw = await prisma.colourway.findUnique({
    where:  { id: colourwayId },
    select: { id: true, organizationId: true },
  });
  if (!cw || cw.organizationId !== ctx.orgId) {
    return NextResponse.json({ ok: false, error: "Product not found" }, { status: 404 });
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  // Remove any prior file with a different extension so we don't leak.
  for (const otherExt of ["jpg", "png", "webp"]) {
    if (otherExt === ext) continue;
    await fs.rm(path.join(UPLOAD_DIR, `${colourwayId}.${otherExt}`), { force: true });
  }

  const target = path.join(UPLOAD_DIR, `${colourwayId}.${ext}`);
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(target, buf);

  const version  = Date.now();
  const imageKey = `${PUBLIC_ROUTE}/${colourwayId}.${ext}?v=${version}`;

  await prisma.colourway.update({
    where: { id: colourwayId },
    data:  { imageKey },
  });

  return NextResponse.json({ ok: true, imageKey });
}

// DELETE — clear the image for a colourway (removes file, clears imageKey).
export async function DELETE(req: Request): Promise<NextResponse<{ ok: boolean; error?: string }>> {
  let ctx;
  try {
    ctx = await devContext();
    requirePermission(ctx, "catalog.update");
  } catch {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const colourwayId = url.searchParams.get("colourwayId");
  if (!colourwayId) {
    return NextResponse.json({ ok: false, error: "colourwayId is required" }, { status: 400 });
  }
  const cw = await prisma.colourway.findUnique({
    where:  { id: colourwayId },
    select: { id: true, organizationId: true, imageKey: true },
  });
  if (!cw || cw.organizationId !== ctx.orgId) {
    return NextResponse.json({ ok: false, error: "Product not found" }, { status: 404 });
  }

  // Only touch files under the uploads dir — never delete a file supplied
  // by the seed / scp path (paths that don't start with /catalog/uploads/).
  if (cw.imageKey && cw.imageKey.startsWith(PUBLIC_ROUTE + "/")) {
    for (const otherExt of ["jpg", "png", "webp"]) {
      await fs.rm(path.join(UPLOAD_DIR, `${colourwayId}.${otherExt}`), { force: true });
    }
  }

  await prisma.colourway.update({
    where: { id: colourwayId },
    data:  { imageKey: null },
  });

  return NextResponse.json({ ok: true });
}

// Profile picture upload.
//
// Employees showed as coloured initials with no way to change that
// (owner, 2026-08-29). User.avatarKey already existed in the schema and
// nothing wrote to it.
//
// Storage follows the catalog-image route exactly, and writes under
// public/catalog/uploads because that path is a MOUNTED VOLUME in the
// container. Anywhere else under public/ lives inside the image and is
// wiped by the next deploy — the picture would vanish on a Tuesday for
// no reason anyone could explain.

import { NextResponse } from "next/server";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { orgPrisma } from "@/kernel/db/rls";
import { devContext } from "@/lib/dev-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg":  "jpg",
  "image/png":  "png",
  "image/webp": "webp",
};

const UPLOAD_DIR   = path.join(process.cwd(), "public", "catalog", "uploads", "avatars");
const PUBLIC_ROUTE = "/catalog/uploads/avatars";

export async function POST(req: Request): Promise<NextResponse<{ ok: boolean; avatarKey?: string; error?: string }>> {
  let ctx;
  try {
    ctx = await devContext();
  } catch {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ ok: false, error: "Choose an image first." }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json({ ok: false, error: "Use a JPG, PNG or WebP image." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "Image must be under 3 MB." }, { status: 400 });
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  // Named by user id, so re-uploading replaces rather than accumulating
  // orphaned files. The cache-buster is what makes the new one show —
  // the URL is otherwise identical and every browser would keep the old.
  const filename = `${ctx.userId}.${ext}`;
  await fs.writeFile(
    path.join(UPLOAD_DIR, filename),
    Buffer.from(await file.arrayBuffer()),
  );

  const avatarKey = `${PUBLIC_ROUTE}/${filename}?v=${Date.now()}`;
  await orgPrisma(ctx.orgId).user.update({
    where: { id: ctx.userId },
    data:  { avatarKey },
  });

  return NextResponse.json({ ok: true, avatarKey });
}

export async function DELETE(): Promise<NextResponse<{ ok: boolean; error?: string }>> {
  let ctx;
  try {
    ctx = await devContext();
  } catch {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  // The file is left on disk deliberately: it is named by user id, so
  // the next upload overwrites it, and deleting is the one operation
  // that cannot be undone if the row update then fails.
  await orgPrisma(ctx.orgId).user.update({
    where: { id: ctx.userId },
    data:  { avatarKey: null },
  });
  return NextResponse.json({ ok: true });
}

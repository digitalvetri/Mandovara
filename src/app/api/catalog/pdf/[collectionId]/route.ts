// Serves a collection's catalog PDF off disk.
// Mirrors the pattern from /catalog/uploads/[filename]/route.ts for runtime-written files.

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { devContext } from "@/lib/dev-context";
import { can } from "@/kernel/rbac/guard";
import { scoped } from "@/kernel/db/scoped";

export const dynamic = "force-dynamic";

const PDFS_DIR = existsSync("/app/public/catalog/pdfs")
  ? "/app/public/catalog/pdfs"
  : path.resolve("public", "catalog", "pdfs");

const SAFE_KEY = /^[a-zA-Z0-9_-]+\.pdf$/;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ collectionId: string }> },
): Promise<Response> {
  const ctx = await devContext();
  if (!can(ctx, "catalog.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { collectionId } = await params;
  if (!collectionId || !/^[a-zA-Z0-9_-]+$/.test(collectionId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const col = await scoped(ctx).collection.findUnique({
    where: { id: collectionId },
    select: { catalogPdfKey: true },
  });

  if (!col?.catalogPdfKey || !SAFE_KEY.test(col.catalogPdfKey)) {
    return NextResponse.json({ error: "No PDF uploaded" }, { status: 404 });
  }

  const filepath = path.join(PDFS_DIR, col.catalogPdfKey);
  try {
    const buf = await readFile(filepath);
    const body = new Uint8Array(buf.byteLength);
    body.set(buf);
    return new Response(body, {
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control":       "private, max-age=300",
        "Content-Length":      String(buf.byteLength),
      },
    });
  } catch {
    return NextResponse.json({ error: "PDF not found on disk" }, { status: 404 });
  }
}

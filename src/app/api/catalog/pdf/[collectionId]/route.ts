// Serves a collection's catalog PDF off disk.
//
// Streams the file with HTTP Range support — the browser fetches only the
// bytes it needs to render the current page (typically ~500KB for page 1),
// so a 100MB catalog opens in about a second instead of downloading the
// whole file up-front. Repeat opens hit the browser cache via ETag/304.

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { Readable } from "node:stream";
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
  req: Request,
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
  let s;
  try {
    s = await stat(filepath);
  } catch {
    return NextResponse.json({ error: "PDF not found on disk" }, { status: 404 });
  }
  if (!s.isFile()) {
    return NextResponse.json({ error: "PDF not a file" }, { status: 404 });
  }

  const total = s.size;
  // ETag from mtime + size — cheap, changes only when the PDF is replaced.
  const etag  = `"${Math.floor(s.mtimeMs).toString(36)}-${total.toString(36)}"`;

  // If the browser already has this exact version cached, skip the transfer.
  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        "Cache-Control": "private, max-age=3600",
        "ETag":          etag,
      },
    });
  }

  const commonHeaders: Record<string, string> = {
    "Content-Type":        "application/pdf",
    "Content-Disposition": "inline",
    // Advertise range support — required for pdf.js / Chrome's built-in
    // viewer to fetch only the pages the user is looking at.
    "Accept-Ranges":       "bytes",
    "Cache-Control":       "private, max-age=3600, immutable",
    "ETag":                etag,
  };

  const rangeHeader = req.headers.get("range");
  if (rangeHeader) {
    // Only single-range bytes=<start>-<end?> is honoured. Multi-range and
    // suffix-ranges are rare in PDF viewers and fall through to the full-file
    // path.
    const m = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader);
    if (m) {
      const start = Number(m[1]);
      const end   = m[2] ? Number(m[2]) : total - 1;
      if (start > end || start >= total) {
        return new Response(null, {
          status: 416,
          headers: {
            "Content-Range": `bytes */${total}`,
            "Accept-Ranges": "bytes",
          },
        });
      }
      const clampedEnd = Math.min(end, total - 1);
      const chunkSize  = clampedEnd - start + 1;
      const stream     = createReadStream(filepath, { start, end: clampedEnd });
      return new Response(
        Readable.toWeb(stream) as unknown as BodyInit,
        {
          status: 206,
          headers: {
            ...commonHeaders,
            "Content-Length": String(chunkSize),
            "Content-Range":  `bytes ${start}-${clampedEnd}/${total}`,
          },
        },
      );
    }
  }

  // Full-file streaming path.
  const stream = createReadStream(filepath);
  return new Response(
    Readable.toWeb(stream) as unknown as BodyInit,
    {
      headers: {
        ...commonHeaders,
        "Content-Length": String(total),
      },
    },
  );
}

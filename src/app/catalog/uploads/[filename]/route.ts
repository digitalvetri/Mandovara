// Serves catalog swatch/rug images off disk.
//
// Next.js `output: "standalone"` traces the `public/` folder at build
// time — files added later (by prod-reset-catalog.mjs writing into the
// mounted volume) don't show up in the trace and get 404'd by the
// built-in static handler. This route reads the file directly from
// /app/public/catalog/uploads at request time, so anything the reset
// script (or a future upload) drops there is servable immediately
// with no container restart or rebuild.
//
// Path is env-aware so local dev (cwd = repo root) still works.

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UPLOADS_DIR = existsSync("/app/public/catalog/uploads")
  ? "/app/public/catalog/uploads"
  : path.resolve("public", "catalog", "uploads");

// Guard against path-traversal and non-image types — only serve
// cuid-shaped filenames with the four extensions we ever write.
const FILENAME_RE = /^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/i;

const CONTENT_TYPE: Record<string, string> = {
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  png:  "image/png",
  webp: "image/webp",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> },
): Promise<Response> {
  const { filename } = await params;
  if (!FILENAME_RE.test(filename)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }
  const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
  const filepath = path.join(UPLOADS_DIR, filename);

  try {
    const buf = await readFile(filepath);
    // Copy Buffer into a fresh Uint8Array so TypeScript's BodyInit
    // signature is happy (Buffer is not directly assignable in some
    // versions of @types/node vs undici types).
    const body = new Uint8Array(buf.byteLength);
    body.set(buf);
    return new Response(body, {
      headers: {
        "Content-Type":  CONTENT_TYPE[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=3600, must-revalidate",
        "Content-Length": String(buf.byteLength),
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

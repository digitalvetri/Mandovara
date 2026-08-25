// Runtime path constants for catalog PDF storage.
//
// Extracted from pdf-actions.ts because a "use server" file can only
// export async functions — a plain string const trips
// "A 'use server' file can only export async functions, found string".
// Both pdf-actions.ts and brand-actions.ts import PDFS_DIR from here.

import { existsSync } from "node:fs";
import path from "node:path";

// `/app` reliably indicates the Docker runtime; local dev falls back to
// the repo-relative path. The pdfs subfolder is not committed (public/catalog
// is gitignored) so it may not exist at container boot — every write path
// mkdirs first.
export const PDFS_DIR = existsSync("/app")
  ? "/app/public/catalog/pdfs"
  : path.resolve("public", "catalog", "pdfs");

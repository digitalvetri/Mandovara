// Client-side photo compression before the outbox stores it.
//
// Spec §7: "target ≤300KB, longest edge 1600px. A 4MB photo will never
// sync on a site connection." A camera on a ₹9,000 Android easily
// produces 4–8MB JPEGs; without this, the outbox becomes unusable.
//
// Uses <canvas> so it works in every mobile browser without any
// extra dependency. Not the most CPU-efficient compressor available
// — but the alternative is dragging in an SDK for a one-off need.

export interface CompressOptions {
  maxEdgePx?:  number;  // default 1600
  targetKB?:   number;  // default 300 — retries at lower quality if exceeded
  mimeType?:   "image/jpeg" | "image/webp";
  minQuality?: number;  // floor, default 0.4 — below this we give up and ship what we have
}

export interface CompressedPhoto {
  blob:      Blob;
  width:     number;
  height:    number;
  bytes:     number;
  qualityUsed: number;
  mimeType:  string;
}

const DEFAULT_MAX_EDGE = 1600;
const DEFAULT_TARGET_KB = 300;
const DEFAULT_MIME = "image/jpeg" as const;
const DEFAULT_MIN_QUALITY = 0.4;

/**
 * Read a File / Blob (typically from an <input type="file" capture>)
 * and return a compressed JPEG/WebP whose bytes are as close to the
 * target as possible without dropping below the quality floor.
 */
export async function compressPhoto(
  input:   Blob,
  options: CompressOptions = {},
): Promise<CompressedPhoto> {
  const maxEdge   = options.maxEdgePx  ?? DEFAULT_MAX_EDGE;
  const targetKB  = options.targetKB   ?? DEFAULT_TARGET_KB;
  const mimeType  = options.mimeType   ?? DEFAULT_MIME;
  const minQ      = options.minQuality ?? DEFAULT_MIN_QUALITY;

  const bitmap = await loadBitmap(input);
  const { width, height } = resizeToLongEdge(bitmap.width, bitmap.height, maxEdge);

  const canvas = getOffscreen(width, height);
  const ctx    = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  // Adaptive quality loop — start at 0.82 and step down by 0.1 until
  // we hit the target size or bottom out. Empirically this converges
  // in ≤4 iterations for phone JPEGs.
  let quality = 0.82;
  let out: Blob = await toBlob(canvas, mimeType, quality);
  while (out.size / 1024 > targetKB && quality > minQ) {
    quality = Math.max(minQ, quality - 0.1);
    out = await toBlob(canvas, mimeType, quality);
  }

  return {
    blob:        out,
    width,
    height,
    bytes:       out.size,
    qualityUsed: quality,
    mimeType,
  };
}

async function loadBitmap(blob: Blob): Promise<ImageBitmap> {
  if (typeof createImageBitmap !== "function") {
    throw new Error("createImageBitmap is not available in this browser.");
  }
  return createImageBitmap(blob);
}

function resizeToLongEdge(w: number, h: number, maxEdge: number): { width: number; height: number } {
  const longest = Math.max(w, h);
  if (longest <= maxEdge) return { width: w, height: h };
  const scale = maxEdge / longest;
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

function getOffscreen(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas === "function") {
    return new OffscreenCanvas(w, h);
  }
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

function toBlob(canvas: HTMLCanvasElement | OffscreenCanvas, type: string, quality: number): Promise<Blob> {
  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type, quality });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob returned null"))),
      type,
      quality,
    );
  });
}

/** Bytes → human-readable string (for the queue banner UI). */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

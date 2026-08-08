"use client";

// SketchOverlay — freehand annotation over a measurement photo.
//
// TRACK-B-CRAFT.md §5.3: "Give them a freehand canvas over the photo,
// saved as an image on the MeasurementItem. Pointer events, undo,
// clear, three stroke widths. Do not over-build it; nobody wants
// layers."
//
// Implementation notes:
//   - Canvas draws at native image resolution (not display resolution)
//     so a downstream re-open doesn't blur.
//   - Strokes are stored as {points[], widthPx} tuples so undo can
//     redraw from scratch — simplest reversible model.
//   - Pointer events (Pointer API) handle mouse, touch and stylus in
//     one path; no separate touchstart/mousedown branches.
//   - On save the image + strokes are flattened to a single JPEG data
//     URL — the spec is explicit that we do not want layered storage.

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Undo2, Trash2, X, Check } from "lucide-react";

interface Point { x: number; y: number }
interface Stroke { points: Point[]; widthPx: number; color: string }

// Three stroke widths @ native pixels on the source image. Round numbers
// so an estimator drawing on a 4-inch phone still sees a clear difference.
const STROKE_WIDTHS = [
  { key: "S", label: "Thin",   px:  3 },
  { key: "M", label: "Medium", px:  6 },
  { key: "L", label: "Thick",  px: 12 },
] as const;

// Bright red for maximum contrast against any wall/window photo.
// Sketch strokes are informational — they read better than gold here.
const STROKE_COLOR = "#DC2626";

interface Props {
  photoDataUrl: string;
  onSave:   (compositedDataUrl: string) => void;
  onCancel: () => void;
}

export function SketchOverlay({ photoDataUrl, onSave, onCancel }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement | null>(null);
  const imageRef   = useRef<HTMLImageElement | null>(null);
  const [strokes, setStrokes]     = useState<Stroke[]>([]);
  const [widthKey, setWidthKey]   = useState<(typeof STROKE_WIDTHS)[number]["key"]>("M");
  const [dragging, setDragging]   = useState(false);
  const drawingRef                = useRef<Stroke | null>(null);
  const [ready, setReady]         = useState(false);

  // ── 1. Load the source photo and size the canvas to it ────────
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      redraw();
      setReady(true);
    };
    img.src = photoDataUrl;
    // Intentionally NOT depending on `strokes` — the effect below handles that redraw.
  }, [photoDataUrl]);

  // ── 2. Redraw whenever strokes change (undo / clear) ──────────
  useEffect(() => {
    if (ready) redraw();
  }, [strokes, ready]);

  function redraw() {
    const canvas = canvasRef.current;
    const img    = imageRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const s of strokes) drawStroke(ctx, s);
  }

  function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
    if (s.points.length < 1) return;
    ctx.strokeStyle = s.color;
    ctx.lineCap    = "round";
    ctx.lineJoin   = "round";
    ctx.lineWidth  = s.widthPx;
    ctx.beginPath();
    ctx.moveTo(s.points[0]!.x, s.points[0]!.y);
    for (let i = 1; i < s.points.length; i++) {
      ctx.lineTo(s.points[i]!.x, s.points[i]!.y);
    }
    // Handle a single-tap dot: draw a filled circle so it's visible.
    if (s.points.length === 1) {
      ctx.arc(s.points[0]!.x, s.points[0]!.y, s.widthPx / 2, 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.fill();
    } else {
      ctx.stroke();
    }
  }

  // ── 3. Pointer events → coordinates on the source image ──────
  function eventToPoint(e: PointerEvent<HTMLCanvasElement>): Point | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    // Map CSS coords → canvas (native) coords.
    const x = ((e.clientX - rect.left) / rect.width)  * canvas.width;
    const y = ((e.clientY - rect.top)  / rect.height) * canvas.height;
    return { x, y };
  }

  function onPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    if (!ready) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = eventToPoint(e);
    if (!p) return;
    const widthPx = STROKE_WIDTHS.find((w) => w.key === widthKey)!.px;
    drawingRef.current = { points: [p], widthPx, color: STROKE_COLOR };
    setDragging(true);
    // Draw the starting dot immediately for tactile feedback.
    const ctx = canvasRef.current!.getContext("2d");
    if (ctx) drawStroke(ctx, drawingRef.current);
  }

  function onPointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (!dragging || !drawingRef.current) return;
    const p = eventToPoint(e);
    if (!p) return;
    drawingRef.current.points.push(p);
    // Incremental — draw just the new segment for smoothness.
    const ctx = canvasRef.current!.getContext("2d");
    if (!ctx) return;
    const s   = drawingRef.current;
    const n   = s.points.length;
    const a   = s.points[n - 2]!;
    const b   = s.points[n - 1]!;
    ctx.strokeStyle = s.color;
    ctx.lineCap    = "round";
    ctx.lineJoin   = "round";
    ctx.lineWidth  = s.widthPx;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  function onPointerUp(e: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setStrokes((prev) => [...prev, drawingRef.current!]);
    drawingRef.current = null;
    setDragging(false);
  }

  function undo() {
    setStrokes((prev) => prev.slice(0, -1));
  }
  function clearAll() {
    if (strokes.length === 0) return;
    if (!confirm("Clear all strokes? This cannot be undone.")) return;
    setStrokes([]);
  }

  function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // JPEG q=0.85 keeps the annotations crisp while staying under a
    // sensible size for localStorage today / Prisma when it lands.
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    onSave(dataUrl);
  }

  // ── 4. Render — full-screen modal ───────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-sm flex items-center justify-center p-3"
      role="dialog"
      aria-modal="true"
      aria-label="Sketch on photo"
    >
      <div className="w-full max-w-[900px] max-h-[92vh] rounded-[14px] bg-surface border border-rule flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-rule flex items-center justify-between gap-3">
          <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
            Sketch — {strokes.length} stroke{strokes.length !== 1 ? "s" : ""}
          </div>
          <div className="flex items-center gap-2">
            {/* Stroke widths */}
            <div className="flex items-center gap-1 mr-3">
              {STROKE_WIDTHS.map((w) => (
                <button
                  key={w.key}
                  type="button"
                  onClick={() => setWidthKey(w.key)}
                  title={w.label}
                  aria-label={`${w.label} stroke`}
                  aria-pressed={widthKey === w.key}
                  className={`h-[30px] w-[30px] grid place-items-center rounded-[6px] border transition-colors ${
                    widthKey === w.key
                      ? "bg-accent/12 border-accent"
                      : "bg-white/60 border-rule hover:bg-surface-hover"
                  }`}
                >
                  <span
                    className="rounded-full bg-text"
                    style={{ height: w.px, width: w.px, backgroundColor: STROKE_COLOR }}
                  />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={undo}
              disabled={strokes.length === 0}
              className="inline-flex items-center gap-1 h-[30px] px-3 rounded-[6px] bg-white/60 border border-rule text-[11.5px] text-text disabled:opacity-40 hover:bg-surface-hover"
            >
              <Undo2 size={12} /> Undo
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={strokes.length === 0}
              className="inline-flex items-center gap-1 h-[30px] px-3 rounded-[6px] bg-white/60 border border-rule text-[11.5px] text-text disabled:opacity-40 hover:bg-surface-hover"
            >
              <Trash2 size={12} /> Clear
            </button>
          </div>
        </div>

        {/* Canvas — scaled to fit width, aspect preserved */}
        <div className="flex-1 overflow-auto bg-ink/40 p-3 flex items-center justify-center">
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="max-w-full max-h-[75vh] touch-none rounded-[8px] shadow-lg cursor-crosshair"
            style={{ backgroundColor: "#111" }}
          />
        </div>

        {/* Actions */}
        <div className="px-4 py-3 border-t border-rule flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1 h-[34px] px-3 rounded-[6px] text-[12px] text-text-dim hover:text-text hover:bg-surface-hover transition-colors"
          >
            <X size={12} /> Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="inline-flex items-center gap-1 h-[34px] px-4 rounded-[6px] bg-accent text-white text-[12.5px] font-medium hover:bg-accent-hover transition-colors"
          >
            <Check size={12} /> Save sketch
          </button>
        </div>
      </div>
    </div>
  );
}

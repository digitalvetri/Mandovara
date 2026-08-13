"use client";

// §5.4 Sketch canvas. Freehand over a blank canvas — no layers,
// no shapes, no text. Executives draw bay windows, pillars, false-
// ceiling steps. Anything richer is time taken from the offline
// queue (spec §5.4 explicit).
//
// Pointer events so it works on touch and mouse. Undo and clear.
// Saved as a data URL — the outbox drain uploads it later.

import { useEffect, useRef, useState } from "react";
import { PenTool, Undo2, Trash2, Check } from "lucide-react";
import { StepShell } from "./StepShell";

interface SketchStepProps {
  hasSketch:  boolean;
  onCaptured: (key: string) => void;
  onSkip:     () => void;
  onBack:     () => void;
  onNext:     () => void;
}

type Point = { x: number; y: number };
type Stroke = { points: Point[]; width: number };

export function SketchStep({ hasSketch, onCaptured, onSkip, onBack, onNext }: SketchStepProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const drawingRef = useRef<Stroke | null>(null);
  const [width, setWidth] = useState<number>(3);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    redraw();
  }, []);

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>): void {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawingRef.current = { points: [pointFromEvent(e)], width };
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>): void {
    if (!drawingRef.current) return;
    drawingRef.current.points.push(pointFromEvent(e));
    setDirty(true);
    // Fast path — draw just the new segment
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const s = drawingRef.current;
    const a = s.points[s.points.length - 2];
    const b = s.points[s.points.length - 1];
    if (!a || !b) return;
    ctx.strokeStyle = "#E8CB6C";
    ctx.lineWidth   = s.width;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  function onPointerUp(): void {
    if (!drawingRef.current) return;
    strokesRef.current.push(drawingRef.current);
    drawingRef.current = null;
  }

  function undo(): void {
    strokesRef.current.pop();
    redraw();
    setDirty(strokesRef.current.length > 0);
  }

  function clear(): void {
    strokesRef.current = [];
    redraw();
    setDirty(false);
    onCaptured("");
  }

  function redraw(): void {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of strokesRef.current) drawStroke(ctx, s);
  }

  function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke): void {
    if (s.points.length < 2) return;
    ctx.strokeStyle = "#E8CB6C";
    ctx.lineWidth   = s.width;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.beginPath();
    ctx.moveTo(s.points[0]!.x, s.points[0]!.y);
    for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i]!.x, s.points[i]!.y);
    ctx.stroke();
  }

  function save(): void {
    const canvas = canvasRef.current;
    if (!canvas || !dirty) { onNext(); return; }
    const url = canvas.toDataURL("image/png");
    onCaptured(url);
    onNext();
  }

  return (
    <StepShell
      title="Sketch (optional)"
      hint="Bay windows, pillars, false-ceiling steps — one quick outline goes a long way for the installer."
      onBack={onBack}
      onNext={dirty ? save : onSkip}
      nextLabel={dirty ? "Save sketch" : (hasSketch ? "Continue" : "Skip")}
    >
      <div className="rounded-[10px] border border-rule bg-surface overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerUp}
          className="block w-full h-[320px] touch-none"
          style={{ background: "repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0 24px, transparent 24px 25px), repeating-linear-gradient(90deg, rgba(255,255,255,0.02) 0 24px, transparent 24px 25px)" }}
        />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="text-[10.5px] uppercase tracking-[0.06em] text-text-dim mr-1">Stroke</div>
        {[2, 3, 5].map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setWidth(w)}
            aria-label={`Stroke ${w}`}
            className={`min-h-[44px] min-w-[44px] grid place-items-center rounded-[8px] border ${
              width === w ? "border-gold bg-gold-tint" : "border-rule"
            }`}
          >
            <PenTool size={12 + w * 2} className="text-text-dim" />
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={strokesRef.current.length === 0}
            className="min-h-[44px] px-3 rounded-[8px] border border-rule text-text-dim disabled:opacity-40 inline-flex items-center gap-1"
          >
            <Undo2 size={14} /> Undo
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={strokesRef.current.length === 0}
            className="min-h-[44px] px-3 rounded-[8px] border border-rule text-text-dim disabled:opacity-40 inline-flex items-center gap-1"
          >
            <Trash2 size={14} /> Clear
          </button>
        </div>
      </div>

      {hasSketch && !dirty && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-solid-tint px-2.5 py-1 text-[11.5px] text-solid-strong">
          <Check size={12} /> Sketch attached
        </div>
      )}
    </StepShell>
  );
}

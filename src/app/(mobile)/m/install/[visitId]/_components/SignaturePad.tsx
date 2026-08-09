"use client";

// Touch + mouse signature capture via a <canvas> and pointer events.
// Outputs a base64 data URL. Not a full art canvas — no undo, no
// pressure-sensitivity — just a legible scribble for site sign-off.

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";

export interface SignaturePadHandle {
  isEmpty: () => boolean;
  toDataURL: () => string;
  clear: () => void;
}

interface Props {
  height?: number;   // css px
  strokeWidth?: number;
  ariaLabel?: string;
}

export const SignaturePad = forwardRef<SignaturePadHandle, Props>(function SignaturePad(
  { height = 160, strokeWidth = 2.5, ariaLabel = "Signature pad" }: Props,
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  // Sync canvas backing store to CSS box on mount + resize. Retina
  // devices otherwise render a blurry 1x bitmap upscaled.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = Math.round(rect.width  * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.lineWidth = strokeWidth;
        ctx.strokeStyle = "#0B1020";
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [strokeWidth]);

  useImperativeHandle(ref, () => ({
    isEmpty: () => empty,
    toDataURL: () => canvasRef.current?.toDataURL("image/png") ?? "",
    clear: () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      setEmpty(true);
    },
  }), [empty]);

  function toLocal(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    lastPt.current = toLocal(e);
    setEmpty(false);
  }
  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !lastPt.current) return;
    const pt = toLocal(e);
    ctx.beginPath();
    ctx.moveTo(lastPt.current.x, lastPt.current.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    lastPt.current = pt;
  }
  function onUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (drawing.current) e.currentTarget.releasePointerCapture(e.pointerId);
    drawing.current = false;
    lastPt.current = null;
  }

  return (
    <canvas
      ref={canvasRef}
      aria-label={ariaLabel}
      role="img"
      data-signature-pad
      className="w-full block bg-white rounded-[8px] border border-rule touch-none select-none"
      style={{ height }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    />
  );
});

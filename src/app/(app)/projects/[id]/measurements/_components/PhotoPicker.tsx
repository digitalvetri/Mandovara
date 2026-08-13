"use client";

import { useRef, useState, useCallback } from "react";
import { ImagePlus, Pen } from "lucide-react";
import { SketchOverlay } from "./SketchOverlay";

export function PhotoPicker({
  value, onChange,
}: { value: string | undefined; onChange: (data: string | undefined) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [sketching, setSketching] = useState(false);

  const compress = useCallback(async (file: File) => {
    const bitmap = await createImageBitmap(file);
    const maxEdge = 1024;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width  * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
    onChange(dataUrl);
  }, [onChange]);

  function pick() { inputRef.current?.click(); }

  return (
    <div>
      <div className="mb-1 text-[10.5px] uppercase tracking-[0.14em] text-text-dim">Photo</div>
      <div className="flex items-center gap-3">
        {value ? (
          <img src={value} alt="" className="h-[64px] w-[64px] rounded-[6px] object-cover border border-rule" />
        ) : (
          <div className="h-[64px] w-[64px] rounded-[6px] border border-dashed border-rule flex items-center justify-center text-text-faint">
            <ImagePlus size={16} />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={pick}
            className="h-[30px] px-3 rounded-[6px] bg-white/60 border border-rule text-[11.5px] text-text hover:bg-surface-hover transition-colors"
          >
            {value ? "Replace photo" : "Add photo"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => setSketching(true)}
              className="inline-flex items-center gap-1 h-[30px] px-3 rounded-[6px] bg-accent/10 border border-accent/40 text-accent text-[11.5px] hover:bg-accent/20 transition-colors"
            >
              <Pen size={11} /> Sketch on photo
            </button>
          )}
          {value && (
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="h-[26px] px-3 rounded-[6px] text-[11px] text-text-dim hover:text-bad text-left"
            >
              Remove
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void compress(f);
            e.target.value = "";
          }}
        />
      </div>
      {sketching && value && (
        <SketchOverlay
          photoDataUrl={value}
          onSave={(dataUrl) => {
            onChange(dataUrl);
            setSketching(false);
          }}
          onCancel={() => setSketching(false)}
        />
      )}
    </div>
  );
}

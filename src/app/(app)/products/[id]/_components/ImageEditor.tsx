"use client";

// Image upload / replace / clear widget for the PDP hero.
//
// Renders as a small overlay button on the hero corner. Clicking opens
// a modal with:
//   - drag-and-drop zone
//   - click-to-select input
//   - live preview of the chosen file (before submit)
//   - "Replace" / "Remove" / "Cancel" actions
//
// Submits via POST/DELETE to /api/products/upload-image, then refreshes
// the route so the server component re-renders with the new imageKey.

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Upload, Trash2, X, Loader2 } from "lucide-react";

interface Props {
  colourwayId: string;
  hasImage:    boolean;
}

const MAX_MB = 5;
const ACCEPT = "image/jpeg,image/png,image/webp";

export function ImageEditor({ colourwayId, hasImage }: Props): React.ReactElement {
  const [open, setOpen]         = useState(false);
  const [file, setFile]         = useState<File | null>(null);
  const [preview, setPreview]   = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef                = useRef<HTMLInputElement | null>(null);
  const router                  = useRouter();

  function reset(): void {
    setFile(null);
    setError(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  }

  function close(): void {
    reset();
    setOpen(false);
  }

  function pickFile(f: File | null): void {
    setError(null);
    if (!f) return;
    if (!ACCEPT.split(",").includes(f.type)) {
      setError(`Use JPG, PNG or WebP. Got ${f.type || "unknown type"}.`);
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`File is ${(f.size / 1024 / 1024).toFixed(1)} MB — max ${MAX_MB} MB.`);
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    pickFile(e.dataTransfer.files[0] ?? null);
  }

  function submit(): void {
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const body = new FormData();
      body.append("colourwayId", colourwayId);
      body.append("file", file);
      const res = await fetch("/api/products/upload-image", { method: "POST", body });
      const json = await res.json() as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Upload failed");
        return;
      }
      close();
      router.refresh();
    });
  }

  function remove(): void {
    setError(null);
    startTransition(async () => {
      const res = await fetch(
        `/api/products/upload-image?colourwayId=${encodeURIComponent(colourwayId)}`,
        { method: "DELETE" },
      );
      const json = await res.json() as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Remove failed");
        return;
      }
      close();
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-ink/80 backdrop-blur-sm text-[11px] uppercase tracking-[0.12em] text-text hover:bg-ink transition-colors"
        title={hasImage ? "Change image" : "Upload image"}
      >
        <Camera size={13} strokeWidth={1.8} />
        {hasImage ? "Change" : "Upload"}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={close}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-sm p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-[14px] bg-surface border border-rule shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-rule">
              <h3 className="font-display text-[18px] font-[520] text-text">
                {hasImage ? "Change product image" : "Upload product image"}
              </h3>
              <button
                type="button"
                onClick={close}
                className="h-8 w-8 flex items-center justify-center rounded-md text-text-dim hover:text-text hover:bg-surface-hover"
                aria-label="Close"
              >
                <X size={16} strokeWidth={1.8} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className="relative flex flex-col items-center justify-center gap-2 min-h-[220px] rounded-[10px] border-2 border-dashed border-rule bg-ink/40 cursor-pointer hover:border-gold/60 hover:bg-ink/60 transition-colors"
              >
                {preview ? (
                  // Preview of the pending file
                  <img src={preview} alt="Preview" className="max-h-[280px] w-full object-contain rounded-[6px]" />
                ) : (
                  <>
                    <Upload size={22} strokeWidth={1.5} className="text-text-dim" />
                    <div className="text-[13px] text-text">Click or drop an image here</div>
                    <div className="text-[11px] text-text-faint">JPG · PNG · WebP · up to {MAX_MB} MB</div>
                  </>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPT}
                  className="sr-only"
                  onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                />
              </div>

              {error && (
                <div className="text-[12px] text-fault bg-fault/10 border border-fault/30 rounded-[6px] px-3 py-2">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-1">
                {hasImage ? (
                  <button
                    type="button"
                    onClick={remove}
                    disabled={pending}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[8px] text-[12.5px] text-fault hover:bg-fault/10 disabled:opacity-50"
                  >
                    <Trash2 size={13} strokeWidth={1.8} />
                    Remove image
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={close}
                    disabled={pending}
                    className="h-9 px-4 rounded-[8px] text-[12.5px] text-text-dim hover:text-text hover:bg-surface-hover disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={!file || pending}
                    className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[8px] bg-gold text-ink text-[12.5px] font-medium hover:bg-gold-strong disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pending ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} strokeWidth={1.8} />}
                    {pending ? "Uploading..." : hasImage ? "Replace" : "Upload"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

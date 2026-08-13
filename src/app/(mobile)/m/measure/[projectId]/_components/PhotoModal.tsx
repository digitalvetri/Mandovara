"use client";

// Camera-first photo capture. Compresses to ≤300KB before it ever
// leaves the browser (spec §7 rule).  Save closes the modal and
// returns the data URL to the item screen.  §13.1: never blocks.

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { compressPhoto, formatBytes } from "@/lib/photo-compress";
import { ModalShell } from "./ModalShell";

interface PhotoModalProps {
  existing?:  string;
  onSave:     (dataUrl: string) => void;
  onClear:    () => void;
  onClose:    () => void;
}

interface Preview {
  dataUrl: string;
  bytes:   number;
  width:   number;
  height:  number;
}

export function PhotoModal({ existing, onSave, onClear, onClose }: PhotoModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const initial: Preview | null = existing
    ? { dataUrl: existing, bytes: 0, width: 0, height: 0 }
    : null;
  const [preview, setPreview] = useState<Preview | null>(initial);
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function onFile(f: File): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      const c = await compressPhoto(f);
      const dataUrl = await blobToDataUrl(c.blob);
      setPreview({ dataUrl, bytes: c.bytes, width: c.width, height: c.height });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Compression failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell
      title="Photo"
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {preview && (
            <button
              type="button"
              onClick={() => { onClear(); onClose(); }}
              className="flex-1 min-h-[44px] rounded-[8px] border border-rule text-text-dim"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => { if (preview) { onSave(preview.dataUrl); onClose(); } else onClose(); }}
            className="flex-[2] min-h-[44px] rounded-[8px] bg-gold text-ink font-medium disabled:opacity-50"
            disabled={busy}
          >
            {preview ? "Save photo" : "Skip"}
          </button>
        </div>
      }
    >
      {preview ? (
        <div>
          <div className="overflow-hidden rounded-[10px]">
            <img src={preview.dataUrl} alt="captured" className="w-full h-auto" />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11.5px] text-text-dim tabular">
            <span>{preview.width || "—"}×{preview.height || "—"}</span>
            <span>{preview.bytes > 0 ? formatBytes(preview.bytes) : "attached"}</span>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-3 w-full min-h-[44px] rounded-[10px] border border-rule text-text-dim inline-flex items-center justify-center gap-1.5"
          >
            <Camera size={14} /> Retake
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full min-h-[240px] rounded-[10px] border-2 border-dashed border-rule flex flex-col items-center justify-center gap-2 text-text-dim hover:text-text hover:border-gold"
        >
          {busy ? <Loader2 size={28} className="animate-spin" /> : <Camera size={28} />}
          <div className="text-[13px]">{busy ? "Compressing…" : "Tap to capture"}</div>
          {!busy && <div className="text-[10.5px]">≤300KB, 1600px longest edge</div>}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
      />

      {error && (
        <div className="mt-2 text-[11.5px] text-fault">{error}</div>
      )}
    </ModalShell>
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("Read failed"));
    r.onload  = () => resolve(String(r.result));
    r.readAsDataURL(blob);
  });
}

"use client";

// Photo capture. Uses the file input's capture=environment hint so a
// browser that offers direct camera access will do so; falls back to
// the gallery on desktop. Compressed to ≤300KB before it goes
// anywhere else — spec §7 rule.
//
// §13.1: the photo is NEVER required. Skip is always available.

import { useRef, useState } from "react";
import { Camera, Check, Loader2 } from "lucide-react";
import { compressPhoto, formatBytes } from "@/lib/photo-compress";
import { StepShell } from "./StepShell";

interface PhotoStepProps {
  hasPhoto:   boolean;
  onCaptured: (key: string) => void;
  onSkip:     () => void;
  onBack:     () => void;
  onNext:     () => void;
}

interface Preview {
  dataUrl: string;
  bytes:   number;
  width:   number;
  height:  number;
}

export function PhotoStep({ hasPhoto, onCaptured, onSkip, onBack, onNext }: PhotoStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function onFile(f: File): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      const compressed = await compressPhoto(f);
      const dataUrl = await blobToDataUrl(compressed.blob);
      setPreview({
        dataUrl,
        bytes:  compressed.bytes,
        width:  compressed.width,
        height: compressed.height,
      });
      // For now we treat the dataUrl as the "photoKey" — the server
      // path will swap this for a Supabase-Storage signed URL when
      // the outbox drains. Storing a data URL locally is fine because
      // the outbox row lives entirely in IndexedDB.
      onCaptured(dataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Compression failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <StepShell
      title="Take a photo"
      hint={hasPhoto ? "Looks good. Retake or continue." : "Not required — skip to sketch if the site is too dark."}
      onBack={onBack}
      onNext={onNext}
      nextLabel={hasPhoto ? "Next" : "Continue without"}
    >
      <div className="rounded-[10px] border border-rule bg-surface p-3">
        {preview ? (
          <div>
            <div className="relative overflow-hidden rounded-[8px]">
              <img src={preview.dataUrl} alt="captured" className="w-full h-auto" />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11.5px] text-text-dim tabular">
              <span>{preview.width}×{preview.height}</span>
              <span>{formatBytes(preview.bytes)}</span>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full min-h-[220px] rounded-[8px] border-2 border-dashed border-rule flex flex-col items-center justify-center gap-2 text-text-dim hover:text-text hover:border-gold"
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
      </div>

      {error && (
        <div className="mt-2 text-[11.5px] text-fault">
          {error}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {preview && (
          <button
            type="button"
            onClick={() => { setPreview(null); onCaptured(""); }}
            className="flex-1 min-h-[44px] rounded-[10px] border border-rule text-text-dim"
          >
            Retake
          </button>
        )}
        <button
          type="button"
          onClick={onSkip}
          className="flex-1 min-h-[44px] rounded-[10px] border border-rule text-text-dim inline-flex items-center justify-center gap-1.5"
        >
          {hasPhoto && <Check size={14} />}
          Skip to sketch
        </button>
      </div>
    </StepShell>
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

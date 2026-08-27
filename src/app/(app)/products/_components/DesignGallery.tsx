"use client";

// The material, not the metadata.
//
// Owner instruction 2026-08-27: the catalog is where Mandovara presents
// what they can supply, and it should be the best possible way to show
// it. A designer standing in a client's living room needs to swipe
// through photographs of actual fabric and wallpaper — a design code and
// a roll width tell that client nothing.
//
// Four kinds of file, each with a different job:
//   SAMPLE    — the material itself, shot close up
//   ROOM_SHOT — it installed somewhere, which is what sells it
//   BROCHURE  — the brand's own PDF, for specs and the full range
//   SPEC      — technical sheets, fire ratings, care instructions

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Upload, Trash2, FileText, Loader2, X } from "lucide-react";
import { deleteDesignDocument } from "@/modules/products/design-documents";
import type { DesignDocument } from "@/modules/products/design-documents";

const CATEGORIES = [
  { value: "SAMPLE",    label: "Sample" },
  { value: "ROOM_SHOT", label: "In a room" },
  { value: "BROCHURE",  label: "Brochure" },
  { value: "SPEC",      label: "Spec sheet" },
] as const;

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label]),
);

export function DesignGallery({
  designId, documents, canEdit,
}: { designId: string; documents: DesignDocument[]; canEdit: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<string>("SAMPLE");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<DesignDocument | null>(null);
  const [pending, start] = useTransition();

  async function upload(file: File): Promise<void> {
    setError(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append("designId", designId);
      body.append("category", category);
      body.append("file", file);
      const res = await fetch("/api/products/upload-document", { method: "POST", body });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) { setError(json.error ?? "Upload failed."); return; }
      router.refresh();
    } catch {
      setError("Upload failed — check your connection and try again.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function remove(id: string): void {
    setError(null);
    start(async () => {
      const res = await deleteDesignDocument(id);
      if (!res.ok) { setError(res.error ?? "Could not remove that file."); return; }
      router.refresh();
    });
  }

  const images = documents.filter((d) => d.isImage);
  const files  = documents.filter((d) => !d.isImage);

  return (
    <section className="overflow-hidden rounded-[14px] border border-rule bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-5 py-3.5">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
          Samples &amp; documents
          {documents.length > 0 && (
            <span className="tabular ml-1.5 text-[10px] text-text-faint">{documents.length}</span>
          )}
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-8 rounded-[7px] border border-rule bg-transparent px-2 text-[11.5px] text-text focus:border-accent focus:outline-none"
              aria-label="What kind of file"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="inline-flex h-8 items-center gap-1.5 rounded-[7px] bg-accent px-3 text-[11.5px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              Add
            </button>
          </div>
        )}
      </div>

      <div className="p-5">
        {documents.length === 0 ? (
          <div className="py-8 text-center">
            <div className="text-[12.5px] text-text-dim">
              No samples uploaded yet.
            </div>
            {canEdit && (
              <div className="mt-1 text-[11.5px] text-text-faint">
                Add close-up shots of the material and photographs of it installed —
                that is what a client decides from.
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {images.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {images.map((d) => (
                  <figure key={d.id} className="group relative overflow-hidden rounded-[10px] border border-rule">
                    <button
                      type="button"
                      onClick={() => setLightbox(d)}
                      className="block w-full"
                      aria-label={`View ${d.fileName}`}
                    >
                      <Image
                        src={d.fileKey}
                        alt={d.fileName}
                        width={400}
                        height={400}
                        className="aspect-square w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                        unoptimized
                      />
                    </button>
                    <figcaption className="flex items-center justify-between gap-1 px-2 py-1.5">
                      <span className="truncate text-[10.5px] text-text-dim">
                        {CATEGORY_LABEL[d.category] ?? d.category}
                      </span>
                      {canEdit && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => remove(d.id)}
                          aria-label={`Remove ${d.fileName}`}
                          className="shrink-0 text-text-faint transition-colors hover:text-bad"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}

            {files.length > 0 && (
              <ul className="space-y-1.5">
                {files.map((d) => (
                  <li key={d.id} className="flex items-center gap-2.5 rounded-[8px] border border-rule px-3 py-2">
                    <FileText size={13} className="shrink-0 text-text-dim" />
                    <a
                      href={d.fileKey}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 truncate text-[12.5px] text-accent hover:underline"
                    >
                      {d.fileName}
                    </a>
                    <span className="tabular shrink-0 text-[10.5px] text-text-faint">
                      {(d.sizeBytes / 1024 / 1024).toFixed(1)}MB
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => remove(d.id)}
                        aria-label={`Remove ${d.fileName}`}
                        className="shrink-0 text-text-faint transition-colors hover:text-bad"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && <div className="mt-3 text-[11.5px] text-bad">{error}</div>}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.fileName}
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Close"
            className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full bg-surface text-text"
          >
            <X size={15} />
          </button>
          <Image
            src={lightbox.fileKey}
            alt={lightbox.fileName}
            width={1400}
            height={1400}
            className="max-h-[88vh] w-auto max-w-full rounded-[12px] object-contain"
            unoptimized
          />
        </div>
      )}
    </section>
  );
}

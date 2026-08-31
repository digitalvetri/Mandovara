"use client";

// Files and photos on a record.
//
// Lives in src/components (not under a route's _components) because it is
// mounted from more than one place — the client page and, next, the project
// and measurement pages. One component, so the three can never drift into
// offering different things.
//
// Images render as a thumbnail grid, everything else as a file row. That
// split is the whole point: a site photo is looked at, a PDF is opened.

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Paperclip, Upload, Loader2, Trash2, FileText, X, Camera } from "lucide-react";
import { deleteAttachment } from "@/modules/documents/actions";
import type { AttachmentRow, DocumentOwnerType } from "@/modules/documents/queries";

const CATEGORY_LABEL: Record<string, string> = {
  PHOTO:     "Photo",
  SITE_SHOT: "Site photo",
  DOCUMENT:  "Document",
  DRAWING:   "Drawing",
  REFERENCE: "Reference",
};

interface Props {
  ownerType: DocumentOwnerType;
  ownerId:   string;
  rows:      AttachmentRow[];
  /** Server-side permission already checked; this only hides the controls. */
  canEdit:   boolean;
  title?:    string;
  hint?:     string;
  /** Preselected in the picker — a site visit wants PHOTO, a client DOCUMENT. */
  defaultCategory?: string;
}

export function AttachmentsCard({
  ownerType, ownerId, rows, canEdit,
  title = "Files & photos",
  hint  = "Drawings, reference shots, signed documents — anything that belongs with this record.",
  defaultCategory = "DOCUMENT",
}: Props) {
  const inputRef  = useRef<HTMLInputElement>(null);
  // A second input, identical but for `capture`. One input cannot be both:
  // with capture set, Android and iOS go straight to the camera and the
  // gallery is unreachable. Two inputs, two buttons, no compromise.
  const cameraRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState(defaultCategory);
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [pending, start]        = useTransition();
  const [lightbox, setLightbox] = useState<AttachmentRow | null>(null);

  async function upload(file: File) {
    setError(null);
    setBusy(true);
    try {
      const body = new FormData();
      body.set("ownerType", ownerType);
      body.set("ownerId", ownerId);
      body.set("category", category);
      body.set("file", file);
      const res  = await fetch("/api/documents/upload", { method: "POST", body });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) { setError(json.error ?? "Could not upload that file."); return; }
      start(() => { window.location.reload(); });
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remove(id: string) {
    setError(null);
    start(async () => {
      const r = await deleteAttachment(id);
      if (!r.ok) { setError(r.error ?? "Could not remove that file."); return; }
      window.location.reload();
    });
  }

  const images = rows.filter((r) => r.isImage);
  const files  = rows.filter((r) => !r.isImage);
  const working = busy || pending;

  return (
    <section className="rounded-[14px] border border-rule bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-rule px-5 py-3.5">
        <div>
          <div className="flex items-center gap-2 text-[13px] font-medium text-text">
            <Paperclip size={14} strokeWidth={1.75} className="text-text-dim" />
            {title}
            {rows.length > 0 && (
              <span className="tabular text-[11px] font-normal text-text-dim">{rows.length}</span>
            )}
          </div>
          <p className="mt-0.5 text-[11.5px] text-text-dim">{hint}</p>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="File type"
              className="h-9 rounded-[8px] border border-rule bg-transparent px-2 text-[12px] text-text outline-none focus:border-accent"
            >
              {Object.entries(CATEGORY_LABEL).map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
            {/* Camera first on a handset — a measurer standing at a window
                wants the lens, not a file browser. Hidden on desktop, where
                there usually isn't one. */}
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={working}
              title="Take a photo"
              className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-rule px-3 text-[12.5px] font-medium text-text-dim transition-colors hover:border-accent hover:text-text disabled:opacity-60 sm:hidden"
            >
              <Camera size={14} strokeWidth={1.9} />
              Photo
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={working}
              className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-accent px-3.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              {working ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} strokeWidth={2.2} />}
              Upload
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
            />
          </div>
        )}
      </div>

      {error && (
        <div className="border-b border-fault/30 bg-fault/5 px-5 py-2.5 text-[11.5px] text-fault">{error}</div>
      )}

      {rows.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <div className="text-[12.5px] text-text-dim">No files yet.</div>
          {canEdit && (
            <p className="mt-1 text-[11px] text-text-faint">
              JPG, PNG, WEBP or PDF, up to 10MB each.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4 p-5">
          {images.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {images.map((r) => (
                <figure key={r.id} className="group relative overflow-hidden rounded-[10px] border border-rule">
                  <button
                    type="button"
                    onClick={() => setLightbox(r)}
                    className="block aspect-[4/3] w-full bg-surface-2"
                    aria-label={`View ${r.fileName}`}
                  >
                    <Image
                      src={r.fileKey}
                      alt={r.fileName}
                      width={320}
                      height={240}
                      unoptimized
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                    />
                  </button>
                  <figcaption className="flex items-center justify-between gap-2 px-2 py-1.5">
                    <span className="truncate text-[10.5px] text-text-dim" title={r.fileName}>
                      {CATEGORY_LABEL[r.category] ?? r.category}
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => remove(r.id)}
                        disabled={working}
                        aria-label={`Remove ${r.fileName}`}
                        className="text-text-faint transition-colors hover:text-fault disabled:opacity-40"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}

          {files.length > 0 && (
            <ul className="divide-y divide-rule/60">
              {files.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2.5">
                  <FileText size={15} strokeWidth={1.7} className="shrink-0 text-text-dim" />
                  <div className="min-w-0 flex-1">
                    <a
                      href={r.fileKey}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-[12.5px] text-accent hover:underline"
                    >
                      {r.fileName}
                    </a>
                    <div className="text-[10.5px] text-text-dim">
                      {CATEGORY_LABEL[r.category] ?? r.category}
                      <span className="mx-1.5 opacity-40">·</span>
                      {formatBytes(r.sizeBytes)}
                      <span className="mx-1.5 opacity-40">·</span>
                      {r.uploadedBy}
                    </div>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => remove(r.id)}
                      disabled={working}
                      aria-label={`Remove ${r.fileName}`}
                      className="shrink-0 text-text-faint transition-colors hover:text-fault disabled:opacity-40"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.fileName}
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Close"
            className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X size={16} />
          </button>
          <Image
            src={lightbox.fileKey}
            alt={lightbox.fileName}
            width={1600}
            height={1200}
            unoptimized
            className="max-h-[85vh] w-auto max-w-full rounded-[12px] object-contain"
          />
        </div>
      )}
    </section>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

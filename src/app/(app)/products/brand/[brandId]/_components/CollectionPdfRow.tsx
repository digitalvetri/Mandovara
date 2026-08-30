"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, Trash2, CheckCircle2, AlertCircle, X, AlertTriangle, EyeOff } from "lucide-react";
import { uploadCollectionPdf, deleteCollection, setCollectionHidden } from "@/modules/catalog/pdf-actions";
import { PdfViewerModal } from "./PdfViewerModal";

const FAMILY_LABELS: Record<string, string> = {
  CURTAIN_FABRIC: "Curtain Fabric", SHEER: "Sheer", LINING: "Lining",
  BLIND: "Blind", WALLPAPER: "Wallpaper", FLOORING: "Flooring",
  CARPET_ROLL: "Carpet Roll", CARPET_TILE: "Carpet Tile",
  UPHOLSTERY_FABRIC: "Upholstery", FOAM_FILLING: "Foam",
  VERTICAL_GARDEN: "Vertical Garden", INTERIOR_FILM: "Interior Film",
  MURAL: "Mural", HARDWARE_TRACK: "Track", HARDWARE_ROD: "Rod",
  MOTOR: "Motor", ACCESSORY: "Accessory", SERVICE: "Service",
};

interface Props {
  collection: {
    id: string;
    name: string;
    family: string;
    seasonYear: number | null;
    catalogPdfKey: string | null;
    _count: { designs: number };
  };
  brandName: string;
  canWrite: boolean;
  canDelete: boolean;
}

export function CollectionPdfRow({ collection: c, brandName, canWrite, canDelete }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, startUpload]   = useTransition();
  const [deleting,  startDelete]   = useTransition();
  const [hiding,    startHide]     = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [hideError,   setHideError]   = useState<string | null>(null);

  const hasPdf       = !!c.catalogPdfKey;
  const hasContent   = c._count.designs > 0;
  const canDestroy   = canDelete;
  const busy         = uploading || deleting || hiding;
  const [uploadError, setUploadError] = useState<string | null>(null);

  function handleHide() {
    setHideError(null);
    startHide(async () => {
      const res = await setCollectionHidden(c.id, true);
      if (!res.ok) setHideError(res.error ?? "Hide failed");
    });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    if (file.size > 200 * 1024 * 1024) {
      setUploadError("PDF must be under 200 MB.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    const fd = new FormData();
    fd.set("collectionId", c.id);
    fd.set("pdf", file);
    startUpload(async () => {
      const res = await uploadCollectionPdf(fd);
      if (fileRef.current) fileRef.current.value = "";
      if (!res.ok) setUploadError(res.error ?? "PDF upload failed.");
    });
  }

  function handleDelete() {
    setDeleteError(null);
    startDelete(async () => {
      const res = await deleteCollection(c.id, { cascade: hasContent });
      if (!res.ok) { setDeleteError(res.error ?? "Delete failed"); return; }
      setConfirmOpen(false);
    });
  }

  const familyLabel = FAMILY_LABELS[c.family] ?? c.family;

  return (
    <div className="flex items-center gap-4 py-3.5 px-4 border-b border-rule last:border-0 hover:bg-ink/20 transition-colors">

      {/* Status dot */}
      <div className="shrink-0">
        {hasPdf
          ? <CheckCircle2 size={16} className="text-solid" />
          : <AlertCircle size={16} className="text-fault/60" />
        }
      </div>

      {/* Collection info */}
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-medium text-text truncate">{c.name}</div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[11px] text-text-dim">{familyLabel}</span>
          {c.seasonYear && (
            <span className="text-[11px] text-text-dim tabular">{c.seasonYear}</span>
          )}
          <span className="text-[11px] text-text-dim">{c._count.designs} designs</span>
        </div>
        {uploadError && (
          <p className="text-[11px] text-fault mt-1 truncate" title={uploadError}>{uploadError}</p>
        )}
      </div>

      {/* PDF status badge */}
      <div className="shrink-0 hidden sm:block">
        {hasPdf
          ? <span className="text-[10.5px] font-medium text-solid bg-solid/10 border border-solid/20 px-2 py-0.5 rounded-[5px]">PDF uploaded</span>
          : <span className="text-[10.5px] font-medium text-fault/80 bg-fault/8 border border-fault/15 px-2 py-0.5 rounded-[5px]">No PDF</span>
        }
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {hasPdf && (
          <PdfViewerModal
            collectionId={c.id}
            collectionName={c.name}
            brandName={brandName}
          />
        )}

        {canWrite && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              aria-label={`Upload PDF for ${c.name}`}
              onChange={handleFileChange}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-[7px] text-[12px] font-medium text-text-dim border border-rule hover:text-accent hover:border-accent/50 disabled:opacity-50 transition-colors shrink-0"
            >
              <Upload size={13} strokeWidth={1.75} />
              {uploading ? "Uploading…" : hasPdf ? "Replace" : "Upload"}
            </button>
          </>
        )}

        {canWrite && (
          <button
            type="button"
            disabled={busy}
            onClick={handleHide}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[7px] text-[12px] font-medium text-text-dim/70 border border-rule hover:text-text hover:border-text/40 disabled:opacity-50 transition-colors shrink-0"
            aria-label={`Hide ${c.name} from product catalog`}
            title="Hide from Product Catalog — stock stays intact"
          >
            <EyeOff size={13} strokeWidth={1.75} />
            {hiding ? "Hiding…" : "Hide"}
          </button>
        )}

        {canDestroy && (
          <button
            type="button"
            disabled={busy}
            onClick={() => { setDeleteError(null); setConfirmOpen(true); }}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[7px] text-[12px] font-medium text-text-dim/70 border border-rule hover:text-fault hover:border-fault/40 disabled:opacity-50 transition-colors shrink-0"
            aria-label={`Delete collection ${c.name}`}
            title="Delete collection"
          >
            <Trash2 size={13} strokeWidth={1.75} />
            Delete
          </button>
        )}
      </div>

      {hideError && (
        <div className="absolute left-4 right-4 -bottom-6 text-[11px] text-fault truncate">{hideError}</div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal aria-label={`Delete ${c.name}`}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => !deleting && setConfirmOpen(false)} />
          <div className="relative w-full max-w-md rounded-[14px] bg-surface border border-rule shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-rule">
              <h3 className="text-[14px] font-semibold text-text">Delete collection?</h3>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={deleting}
                className="h-7 w-7 flex items-center justify-center rounded-[6px] text-text-dim hover:text-text hover:bg-ink/30 disabled:opacity-50 transition-colors"
                aria-label="Cancel"
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-[13px] text-text">
                Delete <span className="font-semibold">{c.name}</span>?
              </p>

              {hasContent && (
                <div className="rounded-[8px] border border-fault/25 bg-fault/8 p-3 flex gap-2.5">
                  <AlertTriangle size={15} strokeWidth={1.75} className="text-fault mt-0.5 shrink-0" />
                  <div className="text-[12px] text-text space-y-1">
                    <div className="font-medium">This will also delete:</div>
                    <ul className="text-text-dim list-disc pl-4">
                      <li>{c._count.designs} design{c._count.designs === 1 ? "" : "s"} + all their colourways, prices and stock balances</li>
                      {hasPdf && <li>The attached catalog PDF</li>}
                    </ul>
                    <div className="text-text-dim pt-1">
                      Refused if any quotation, order, PO, stock move, allocation or sample book references these designs.
                    </div>
                  </div>
                </div>
              )}

              {!hasContent && hasPdf && (
                <p className="text-[12px] text-text-dim">The attached PDF will also be removed.</p>
              )}

              {deleteError && (
                <p className="text-[12px] text-fault">{deleteError}</p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  disabled={deleting}
                  className="h-8 px-4 rounded-[7px] text-[12px] text-text-dim border border-rule hover:bg-ink/20 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="h-8 px-4 rounded-[7px] text-[12px] font-semibold bg-fault text-white hover:bg-fault/85 disabled:opacity-60 transition-colors"
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

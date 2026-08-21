"use client";

import { useRef, useTransition } from "react";
import { Upload, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { uploadCollectionPdf, removeCollectionPdf } from "@/modules/catalog/pdf-actions";
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
}

export function CollectionPdfRow({ collection: c, brandName, canWrite }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();
  const [removing, startRemove] = useTransition();

  const hasPdf   = !!c.catalogPdfKey;
  const busy     = uploading || removing;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("collectionId", c.id);
    fd.set("pdf", file);
    startUpload(async () => {
      await uploadCollectionPdf(fd);
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  function handleRemove() {
    startRemove(async () => { await removeCollectionPdf(c.id); });
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

            {hasPdf && (
              <button
                type="button"
                disabled={busy}
                onClick={handleRemove}
                className="h-8 w-8 flex items-center justify-center rounded-[7px] text-text-dim/60 border border-rule hover:text-fault hover:border-fault/40 disabled:opacity-50 transition-colors shrink-0"
                aria-label={`Remove PDF for ${c.name}`}
              >
                {removing ? (
                  <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                ) : (
                  <Trash2 size={13} strokeWidth={1.75} />
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

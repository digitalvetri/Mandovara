"use client";

import { useState } from "react";
import { X, Download, BookOpen, Loader2 } from "lucide-react";

interface Props {
  collectionId: string;
  collectionName: string;
  brandName: string;
}

export function PdfViewerModal({ collectionId, collectionName, brandName }: Props) {
  const [open, setOpen]     = useState(false);
  const [loaded, setLoaded] = useState(false);

  const pdfUrl = `/api/catalog/pdf/${collectionId}`;

  function openModal() { setLoaded(false); setOpen(true); }
  function closeModal() { setOpen(false); setLoaded(false); }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-[7px] text-[12px] font-medium bg-accent text-ink hover:bg-accent/85 transition-colors shrink-0"
      >
        <BookOpen size={13} strokeWidth={1.75} />
        View PDF
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          role="dialog"
          aria-modal
          aria-label={`Catalog PDF — ${collectionName}`}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={closeModal} />

          <div className="relative flex flex-col w-full h-full max-w-6xl mx-auto my-6 rounded-[16px] overflow-hidden shadow-2xl">

            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4 px-5 py-3.5 bg-sidebar shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <BookOpen size={14} strokeWidth={1.75} className="text-sidebar-text/60 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[13px] font-medium text-sidebar-text truncate block">
                    {collectionName}
                  </span>
                  <span className="text-[11px] text-sidebar-text/50 truncate block">{brandName}</span>
                </div>
                {!loaded && <Loader2 size={13} className="text-sidebar-text/50 animate-spin shrink-0" />}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={pdfUrl}
                  download={`${brandName} — ${collectionName}.pdf`}
                  className="inline-flex items-center gap-1.5 h-8 px-4 rounded-[7px] text-[12px] font-semibold bg-accent text-ink hover:bg-accent/85 transition-colors"
                >
                  <Download size={13} strokeWidth={2.2} />
                  Download
                </a>
                <button
                  type="button"
                  onClick={closeModal}
                  aria-label="Close"
                  className="h-8 w-8 flex items-center justify-center rounded-[7px] text-sidebar-text/60 hover:text-sidebar-text hover:bg-white/10 transition-colors"
                >
                  <X size={15} strokeWidth={2} />
                </button>
              </div>
            </div>

            {/* PDF iframe */}
            <div className="relative flex-1 bg-[#404040] overflow-hidden">
              {!loaded && (
                <div className="absolute inset-0 flex items-center justify-center gap-3 text-[13px] text-white/50">
                  <Loader2 size={18} className="animate-spin" />
                  Loading catalog…
                </div>
              )}
              <iframe
                src={pdfUrl}
                title={`${brandName} — ${collectionName}`}
                className="w-full h-full border-0"
                onLoad={() => setLoaded(true)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

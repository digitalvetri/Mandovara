"use client";

// Flip-through viewer for the supplier's full catalogue PDF.
//
// Opens as a full-screen modal with the browser's built-in PDF
// viewer inside an iframe — that gives native paging, zoom, and
// keyboard nav for free. Esc / backdrop click closes.

import { useEffect, useState } from "react";
import { BookOpen, ExternalLink, X } from "lucide-react";

export function CatalogueViewer({
  pdfKey, designName,
}: {
  pdfKey: string;
  designName: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full inline-flex items-center justify-center gap-2 h-[42px] px-4 rounded-[10px] bg-surface border border-rule text-text hover:bg-surface-hover hover:border-gold/40 transition-colors text-[13px] font-medium"
      >
        <BookOpen size={15} strokeWidth={2} className="text-accent" />
        Browse full catalogue
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-ink/85 backdrop-blur-sm flex flex-col animate-in fade-in duration-150"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-4 px-5 h-[52px] border-b border-rule bg-surface/95">
            <div className="flex items-center gap-3 min-w-0">
              <BookOpen size={16} className="text-accent shrink-0" />
              <div className="font-display text-[15px] font-[540] text-text truncate tracking-[-0.005em]">
                {designName}
              </div>
              <span className="text-[10.5px] uppercase tracking-[0.14em] text-text-faint shrink-0">catalogue</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={pdfKey}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-[30px] px-3 rounded-[6px] border border-rule text-[11.5px] text-text-dim hover:text-text hover:border-rule/80 transition-colors"
              >
                <ExternalLink size={12} />
                Open in tab
              </a>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close catalogue"
                className="h-[30px] w-[30px] grid place-items-center rounded-[6px] border border-rule text-text-dim hover:text-text hover:border-rule/80 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Iframe — browser handles paging, zoom, keyboard nav */}
          <iframe
            src={pdfKey}
            title={`${designName} — full catalogue`}
            className="flex-1 w-full bg-ink"
          />
        </div>
      )}
    </>
  );
}

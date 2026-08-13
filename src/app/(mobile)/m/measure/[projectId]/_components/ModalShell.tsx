"use client";

// Small overlay shell used by the three inline modals in the field
// PWA (room / photo / sketch). Slides in from the bottom, dims the
// backdrop, closes on tap-outside or Escape.

import type { ReactNode } from "react";
import { useEffect } from "react";
import { X } from "lucide-react";

interface ModalShellProps {
  title:    string;
  onClose:  () => void;
  children: ReactNode;
  footer?:  ReactNode;
}

export function ModalShell({ title, onClose, children, footer }: ModalShellProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 bg-ink/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-[480px] max-h-[92vh] flex flex-col bg-surface border border-rule rounded-t-[16px] sm:rounded-[16px] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-rule px-4 py-3">
          <h2 className="text-[15px] font-medium" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 grid place-items-center rounded-[8px] hover:bg-surface-hover"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>
        {footer && (
          <footer className="border-t border-rule px-4 py-3 bg-surface-2/40">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

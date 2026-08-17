"use client";

// Small "?" info popover. Click-to-open (also opens on keyboard focus),
// closes on outside click or Esc. Content is prose-safe — pass a single
// sentence per spec §10 ("?" gives one plain sentence, no jargon").

import { useEffect, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";

interface Props {
  /** One plain sentence. Longer copy is a signal to rewrite, not to expand. */
  content: string;
  /** Visually-hidden label for screen readers describing what the tooltip is about. */
  label?: string;
}

export function InfoTip({ content, label = "More info" }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={wrapRef} className="relative inline-flex items-center align-middle">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={(e) => {
          // The "?" often sits inside a whole-card <Link>; stop the click
          // from bubbling up and navigating.
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex items-center justify-center h-4 w-4 rounded-full text-text-dim hover:text-gold focus:outline-none focus:ring-2 focus:ring-gold/40"
      >
        <HelpCircle size={13} strokeWidth={1.75} />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-30 top-full right-0 mt-1.5 w-64 rounded-[8px] border border-rule bg-surface shadow-xl px-3 py-2 text-[11.5px] text-text leading-relaxed"
        >
          {content}
        </span>
      )}
    </span>
  );
}

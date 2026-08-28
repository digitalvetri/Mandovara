"use client";

// Keeps the full add-item form on the page without it being the first
// thing anyone meets.
//
// The owner's complaint was that entry demanded rooms, surfaces and
// product families from people who only wanted to write down a window.
// The answer is not to delete that form — designers need heading type
// and fullness, and CLAUDE.md's UI rules forbid removing working
// functionality to tidy a screen — so it moves one click down instead.

import { useState } from "react";
import { ChevronDown, ChevronRight, SlidersHorizontal } from "lucide-react";

export function AdvancedEntryDisclosure({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-[10px] border border-rule bg-surface px-4 py-2.5 text-left text-[12.5px] text-text-dim transition-colors hover:bg-surface-2/40 hover:text-text"
        aria-expanded={open}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <SlidersHorizontal size={13} />
        <span>Detailed entry</span>
        <span className="ml-auto text-[11.5px] text-text-faint">
          Rooms, product type, heading and finish
        </span>
      </button>

      {open && <div className="mt-2.5">{children}</div>}
    </div>
  );
}

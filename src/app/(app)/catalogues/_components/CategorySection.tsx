"use client";

// One collapsible section per ProductFamily on /catalogues. Header is
// tappable — the body of names hides by default so the page opens as a
// browsable index rather than a 700-line scroll.

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { CatalogueRow } from "./CatalogueRow";
import type { CatalogueRow as Row } from "@/modules/catalog/catalogues-queries";

interface Props {
  family:    string;
  label:     string;
  rows:      Row[];
  canDelete: boolean;
  defaultOpen?: boolean;
}

export function CategorySection({ label, rows, canDelete, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `cat-section-${label.replace(/\s+/g, "-")}`;

  return (
    <section className="rounded-[14px] bg-surface border border-rule shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full flex items-center justify-between px-5 py-3 border-b border-rule bg-ink/10 hover:bg-ink/20 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <ChevronDown
            size={13}
            strokeWidth={2}
            className={`text-text-dim shrink-0 transition-transform ${open ? "rotate-0" : "-rotate-90"}`}
          />
          <span className="text-[10px] uppercase tracking-[0.18em] text-text-dim font-semibold">
            {label}
          </span>
        </div>
        <span className="text-[11.5px] text-text-dim tabular">
          {rows.length}
        </span>
      </button>

      {open && (
        <ul id={panelId}>
          {rows.map((r) => (
            <CatalogueRow key={r.id} row={r} canDelete={canDelete} />
          ))}
        </ul>
      )}
    </section>
  );
}

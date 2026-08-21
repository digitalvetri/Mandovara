"use client";

// Family pill filter + search input. Family pills come from the server
// (distinct families across the catalog) so the UI only shows the ones
// this org actually uses.

import Link from "next/link";
import type { Route } from "next";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Plus, Search } from "lucide-react";

const FAMILY_LABEL: Record<string, string> = {
  CURTAIN_FABRIC:    "Curtains",
  SHEER:             "Sheer",
  LINING:            "Lining",
  BLIND:             "Blinds",
  WALLPAPER:         "Wallpaper",
  FLOORING:          "Flooring",
  CARPET_ROLL:       "Carpet roll",
  CARPET_TILE:       "Carpet tile",
  RUG:               "Rugs",
  UPHOLSTERY_FABRIC: "Upholstery",
  FOAM_FILLING:      "Foam",
  VERTICAL_GARDEN:   "Vertical garden",
  INTERIOR_FILM:     "Interior film",
  MURAL:             "Mural",
  HARDWARE_TRACK:    "Track",
  HARDWARE_ROD:      "Rod",
  MOTOR:             "Motor",
  ACCESSORY:         "Accessory",
  SERVICE:           "Service",
};

interface Props { families: string[] }

export function InventoryToolbar({ families }: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const params   = useSearchParams();
  const family   = params.get("family") ?? "ALL";
  const [text, setText] = useState(params.get("q") ?? "");

  function pushWith(next: URLSearchParams): void {
    router.push(`${pathname}${next.toString() ? `?${next}` : ""}` as Route);
  }
  function onPill(key: string): void {
    const next = new URLSearchParams(params.toString());
    if (key === "ALL") next.delete("family"); else next.set("family", key);
    next.delete("page");
    pushWith(next);
  }
  function apply(): void {
    const q = text.trim();
    const next = new URLSearchParams(params.toString());
    if (q.length > 0) next.set("q", q); else next.delete("q");
    next.delete("page");
    pushWith(next);
  }

  return (
    <div className="mb-4 space-y-3">
      {/* Add-item button — for now routes to /products (the catalog). SKUs
          live there, not here. Inventory adjusts existing ones. */}
      <div>
        <Link
          href={"/products" as Route}
          className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-surface px-4 py-2 text-[12.5px] font-medium text-text-dim transition-all duration-200 hover:border-gold hover:text-gold hover:-translate-y-0.5"
        >
          <Plus size={12} strokeWidth={2.2} />
          Add item (to catalog)
        </Link>
      </div>

      <div className="rounded-[14px] border border-rule bg-surface p-4">
        {/* Family pills */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Pill active={family === "ALL"} onClick={() => onPill("ALL")}>All</Pill>
          {families.map((f) => (
            <Pill key={f} active={family === f} onClick={() => onPill(f)}>
              {FAMILY_LABEL[f] ?? f}
            </Pill>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 rounded-full border border-rule bg-surface-2 px-3.5 py-2 max-w-[420px]">
          <Search size={13} className="shrink-0 text-text-dim" />
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") apply(); }}
            onBlur={apply}
            placeholder="Search item, colour, brand…"
            className="flex-1 bg-transparent text-[12.5px] text-text placeholder:text-text-dim outline-none"
            aria-label="Search inventory"
          />
        </div>
      </div>
    </div>
  );
}

function Pill({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "h-7 rounded-full px-3 text-[11.5px] font-medium transition-colors",
        active
          ? "bg-solid text-ink"
          : "border border-rule bg-surface text-text-dim hover:text-text",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// Chosen items panel — one card per measurement item on the project's
// latest round, with fixed site dimensions and the picked product.

import { Image as ImageIcon } from "lucide-react";
import type { ProjectChosenItem } from "@/modules/projects/queries";
import { displayDimension } from "@/modules/measurement/units";

const FAMILY_LABEL: Record<string, string> = {
  CURTAIN_FABRIC:    "Curtains",
  SHEER:             "Sheer",
  LINING:            "Lining",
  BLIND:             "Blind",
  WALLPAPER:         "Wallpaper",
  FLOORING:          "Flooring",
  CARPET_ROLL:       "Carpet",
  CARPET_TILE:       "Carpet tiles",
  UPHOLSTERY_FABRIC: "Upholstery",
  VERTICAL_GARDEN:   "Vertical garden",
  INTERIOR_FILM:     "Interior film",
  MURAL:             "Mural",
};

interface Props {
  items: ProjectChosenItem[];
}

export function ChosenItemsPanel({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-[14px] border border-rule bg-surface p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
          Chosen items
        </div>
        <span className="text-[11px] tabular-nums text-text-dim">
          {items.length} item{items.length === 1 ? "" : "s"}
        </span>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((it) => <ItemCard key={it.id} it={it} />)}
      </ul>
    </section>
  );
}

function ItemCard({ it }: { it: ProjectChosenItem }) {
  const family = FAMILY_LABEL[it.family] ?? it.family;
  const hasProduct = it.colourwayId !== null;

  return (
    <li className="flex gap-3 rounded-[12px] border border-rule/70 bg-surface-2/40 p-3">
      {/* Swatch / image */}
      <div className="relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-[8px] border border-rule bg-surface">
        {it.imageKey ? (
          <img
            src={it.imageKey}
            alt={it.colourName ?? "product swatch"}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : it.hex ? (
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ backgroundColor: it.hex }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-text-dim">
            <ImageIcon size={20} />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <div className="truncate text-[13px] font-semibold text-text">{it.label}</div>
          <span className="shrink-0 text-[10px] uppercase tracking-[0.1em] text-text-dim">
            {family}
          </span>
        </div>
        <div className="mt-0.5 truncate text-[11px] text-text-dim">
          {it.roomName}
        </div>

        {/* Fixed measurements */}
        <div className="mt-2 flex items-baseline gap-3 text-[11.5px] tabular-nums text-text-dim">
          <span>
            {/* Shown in the unit it was measured in, not the mm it is
                stored as — the measurement card does the same, and two
                screens quoting different numbers for one window is worse
                than either being inconvenient. */}
            <span className="text-text">{displayDimension(it.widthMm, it.enteredUnit).value}</span>
            <span className="mx-1 text-text-subtle">×</span>
            <span className="text-text">{displayDimension(it.heightMm, it.enteredUnit).value}</span>
            <span className="ml-0.5 text-[9.5px] text-text-subtle">
              {displayDimension(it.widthMm, it.enteredUnit).unit}
            </span>
          </span>
          {it.quantity > 1 && (
            <span className="text-text-subtle">· qty {it.quantity}</span>
          )}
          {it.materialQty && it.materialUnit && (
            <span className="text-text-subtle">
              · <span className="text-text">{trimZeros(it.materialQty)}</span>
              <span className="ml-0.5 text-[9.5px]">{it.materialUnit.toLowerCase()}</span>
            </span>
          )}
        </div>

        {/* Product info — only shown when a colourway is linked */}
        {hasProduct && (
          <div className="mt-2 text-[11.5px] leading-tight">
            <div className="truncate text-text">
              {it.designName} · <span className="text-text-dim">{it.colourName}</span>
            </div>
            {it.brandName && (
              <div className="text-[10.5px] text-text-subtle truncate">
                {it.brandName}
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function trimZeros(s: string): string {
  // "1800.00" → "1800", "1800.50" → "1800.5"
  if (!s.includes(".")) return s;
  return s.replace(/\.?0+$/, "");
}

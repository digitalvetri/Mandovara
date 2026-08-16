// Product card — the workhorse tile on /products.
//
// Anatomy (top → bottom):
//   • 4:5 image well (real image with object-contain OR hex fallback)
//   • dye-lot pin top-right (only when family is dye-lot-sensitive AND stock has a lot)
//   • "NEW" pill top-left (only if Design.createdAt < 7 days)
//   • 4px gold left edge (design system swatch chip — coloured by Colourway.hex)
//   • Fraunces 15/20 name + brand › family caption + mono code
//   • Price with in-stock/out-of-stock dot pill on the right
//
// Hover raises the whole tile to surface-2 and draws the mono code underline L→R.

import Link from "next/link";
import type { Route } from "next";
import { formatINR } from "@/kernel/money/format";
import type { ProductRow } from "@/modules/products/queries";

export function ProductCard({
  row, forProject, itemId,
}: { row: ProductRow; forProject?: string; itemId?: string }) {
  const swatchColour = row.hex ?? "var(--color-gold)";
  const uomShort = row.uom === "METRE" ? "m" : row.uom === "SQFT" ? "sqft" : row.uom === "ROLL" ? "roll" : row.uom === "BOX" ? "box" : row.uom === "PIECE" ? "pc" : row.uom.toLowerCase();
  const qs = new URLSearchParams();
  if (forProject) qs.set("forProject", forProject);
  if (itemId)     qs.set("itemId",     itemId);
  const href = qs.toString().length > 0 ? `/products/${row.id}?${qs.toString()}` : `/products/${row.id}`;

  return (
    <Link
      href={href as Route}
      className="group relative flex flex-col rounded-[14px] border border-rule bg-surface overflow-hidden transition-all duration-200 hover:bg-surface-hover hover:border-rule/80 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
    >
      {/* Image well — fixed 4:5 portrait, image fills uniformly */}
      <div className="relative aspect-[4/5] bg-ink border-b border-rule/60 overflow-hidden">
        {row.imageKey ? (
          <img
            src={row.imageKey}
            alt={row.name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <SwatchFallback name={row.name} code={row.code} hex={row.hex} />
        )}

        {/* NEW pill — top-left */}
        {row.isNew && (
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1 h-[20px] px-2 rounded-full bg-ink/80 backdrop-blur-sm text-[10px] font-medium uppercase tracking-[0.14em] text-accent">
            New
          </div>
        )}

        {/* Dye-lot pin — top-right */}
        {row.dyeLotHint && (
          <div
            className="absolute top-2.5 right-2.5 h-6 min-w-[24px] px-1.5 flex items-center justify-center rounded-full bg-gold text-ink text-[10px] font-semibold tabular tracking-tight shadow-[0_0_0_2px_rgba(11,16,32,0.85)]"
            title={`Dye lot: ${row.dyeLotHint}`}
          >
            {row.dyeLotHint}
          </div>
        )}
      </div>

      {/* Card body — fixed row grid so every card aligns identically */}
      <div className="relative flex flex-col px-4 pt-3.5 pb-3 gap-1">
        {/* 4px gold left edge — the design-system swatch chip */}
        <span
          aria-hidden
          className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-[2px]"
          style={{ backgroundColor: swatchColour }}
        />
        <div className="pl-2 flex flex-col">
          {/* Name — always exactly 2 lines tall */}
          <div className="font-display text-[15px] leading-[20px] font-[460] text-text tracking-[-0.01em] line-clamp-2 h-[40px]">
            {row.name}
          </div>
          {/* Brand · family — always 1 line */}
          <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-text-dim truncate h-[14px] leading-[14px]">
            {row.brand} <span className="text-text-faint">·</span> {row.familyLabel}
          </div>
          {/* Code — always 1 line */}
          <div className="mt-0.5 relative w-fit max-w-full text-[10.5px] tabular text-text-faint h-[14px] leading-[14px] truncate">
            {row.code}
            <span
              aria-hidden
              className="absolute left-0 -bottom-px h-px w-0 bg-gold/70 transition-[width] duration-300 ease-out group-hover:w-full"
            />
          </div>

          {/* Price + stock — pinned row, consistent height */}
          <div className="mt-3 pt-2.5 border-t border-rule/50 flex items-center justify-between gap-2 h-[28px]">
            <div className="tabular flex items-baseline gap-1 min-w-0">
              {row.mrp != null ? (
                <>
                  <span className="text-[14px] font-medium text-text leading-none">
                    {formatINR(row.mrp)}
                  </span>
                  <span className="text-[10.5px] text-text-faint leading-none">/{uomShort}</span>
                </>
              ) : (
                <span className="text-[11.5px] text-text-faint">Price on request</span>
              )}
            </div>
            <StockPill inStock={row.inStock} />
          </div>
        </div>
      </div>
    </Link>
  );
}

// When there is no photograph, don't render a bare beige rectangle —
// paint the swatch colour and cross-hatch it faintly so identical hex
// values in the seed still read as textured chips rather than flat fills.
// The design name and code appear once, in the card body directly below.
function SwatchFallback({ name, hex }: { name: string; code: string; hex: string | null }) {
  const bg = hex ?? "#8792AC";
  const light = isLight(bg);
  const hatch = light ? "rgba(11,16,32,0.07)" : "rgba(255,255,255,0.05)";
  const monogram = initial(name);
  const monogramColour = light ? "rgba(11,16,32,0.14)" : "rgba(255,255,255,0.12)";
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background: `
          repeating-linear-gradient(135deg, ${hatch} 0 1px, transparent 1px 8px),
          ${bg}
        `,
      }}
      aria-label={`${name} swatch`}
    >
      <span
        aria-hidden
        className="font-display font-[500] leading-none select-none"
        style={{ color: monogramColour, fontSize: "88px", letterSpacing: "-0.04em" }}
      >
        {monogram}
      </span>
    </div>
  );
}

function initial(name: string): string {
  const trimmed = name.trim().replace(/^[\d.\s]+/, "");
  const first = trimmed.charAt(0).toUpperCase();
  return first || name.trim().charAt(0).toUpperCase() || "•";
}

function isLight(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.6;
}

function StockPill({ inStock }: { inStock: boolean }) {
  // Only render "IN STOCK" when we know it — silence is honest for
  // out-of-stock or unknown (no fake "OUT OF STOCK" when we simply
  // don't have any stock records).
  if (!inStock) return null;
  return (
    <span className="inline-flex items-center gap-1 h-[18px] px-1.5 rounded-full bg-good/12 text-[9.5px] uppercase tracking-[0.14em] text-good font-medium">
      <span className="h-1.5 w-1.5 rounded-full bg-good" />
      In stock
    </span>
  );
}

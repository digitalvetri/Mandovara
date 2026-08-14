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

export function ProductCard({ row }: { row: ProductRow }) {
  const swatchColour = row.hex ?? "var(--color-gold)";
  const uomShort = row.uom === "METRE" ? "m" : row.uom === "SQFT" ? "sqft" : row.uom === "ROLL" ? "roll" : row.uom === "BOX" ? "box" : row.uom === "PIECE" ? "pc" : row.uom.toLowerCase();

  return (
    <Link
      href={`/products/${row.id}` as Route}
      className="group relative flex flex-col rounded-[14px] border border-rule bg-surface overflow-hidden transition-all duration-200 hover:bg-surface-hover hover:border-rule/80 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
    >
      {/* Image well — 4:5 portrait */}
      <div className="relative aspect-[4/5] bg-ink border-b border-rule/60 overflow-hidden">
        {row.imageKey ? (
          <img
            src={row.imageKey}
            alt={row.name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-contain"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: row.hex ?? "var(--color-surface-hover)" }}
            aria-label={`${row.name} swatch`}
          />
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

      {/* Card body */}
      <div className="relative flex-1 flex flex-col px-4 py-3.5 gap-1">
        {/* 4px gold left edge — the design-system swatch chip */}
        <span
          aria-hidden
          className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-[2px]"
          style={{ backgroundColor: swatchColour }}
        />
        <div className="pl-2 flex-1 flex flex-col">
          <div className="font-display text-[15px] leading-[20px] font-[460] text-text tracking-[-0.01em] line-clamp-2 min-h-[40px]">
            {row.name}
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-text-dim truncate">
            {row.brand} <span className="text-text-faint">·</span> {row.familyLabel}
          </div>
          <div className="mt-0.5 relative inline-block w-fit text-[10.5px] tabular text-text-faint">
            {row.code}
            <span
              aria-hidden
              className="absolute left-0 -bottom-px h-px w-0 bg-gold/70 transition-[width] duration-300 ease-out group-hover:w-full"
            />
          </div>

          {/* Price + stock row */}
          <div className="mt-auto pt-2.5 flex items-baseline justify-between gap-2">
            <div className="tabular">
              {row.mrp != null ? (
                <>
                  <span className="text-[13.5px] font-medium text-text">{formatINR(row.mrp)}</span>
                  <span className="ml-1 text-[10.5px] text-text-faint">/{uomShort}</span>
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

// /products/[id] — PDP for a single Colourway (SKU).
//
// Layout: 55/45 split.
//   Left  — 4:5 hero image (with hex-swatch fallback) framed by four
//           small gold "pin" dots evoking a swatch pinned to a
//           moodboard. Below: variant-strip of sibling colourways.
//   Right — brand › collection eyebrow, Fraunces name, colour+code,
//           prices (retail / MRP / cost — cost RBAC-gated), family-
//           attribute grid, big gold "Add to Quote" button that
//           opens the client-picker at /quotations/quick.
//
// Sample-book + "used in N projects" placeholders sit below the CTA
// but only render when there's real data behind them (§ no-fake-data).

import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Info } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { formatINR } from "@/kernel/money/format";
import { devContext } from "@/lib/dev-context";
import { getProduct } from "@/modules/products/queries";
import { StatusPill } from "../_components/StatusPill";
import { CatalogueViewer } from "./_components/CatalogueViewer";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await devContext();
  const product = await getProduct(ctx, id);
  if (!product) notFound();

  const uomShort = shortUom(product.uom);
  const primaryPrice = product.retail ?? product.mrp;
  const hasDiscount  = product.retail != null && product.mrp != null && product.retail < product.mrp;

  return (
    <>
      <div className="pt-4 pb-2">
        <Link
          href={"/products" as Route}
          className="inline-flex items-center gap-1.5 text-[11.5px] uppercase tracking-[0.14em] text-text-dim hover:text-text transition-colors"
        >
          <ArrowLeft size={13} strokeWidth={2} />
          Back to Catalogue
        </Link>
      </div>

      <Topbar
        title={product.name}
        eyebrow={`${product.brand} › ${product.collection}`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)] gap-8 pb-10">
        {/* ── LEFT: hero + variant strip ──────────────────────── */}
        <div className="space-y-4">
          <HeroImage
            src={product.imageKey}
            hex={product.hex}
            alt={product.name}
            isNew={product.isNew}
            dyeLotHint={product.dyeLotHint}
          />
          {product.siblingColourways.length > 0 && (
            <VariantStrip currentId={product.id} siblings={product.siblingColourways} />
          )}
        </div>

        {/* ── RIGHT: spec panel + CTA ─────────────────────────── */}
        <aside className="space-y-5">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
              {product.brand} <span className="text-text-faint">›</span> {product.collection}
            </div>
            <h2 className="mt-2 font-display text-[30px] leading-[34px] font-[540] text-text tracking-[-0.015em]">
              {product.name}
            </h2>
            {product.colourName && product.colourName !== "Standard" && (
              <div className="mt-1 text-[13px] text-text-dim">Colour: <span className="text-text">{product.colourName}</span></div>
            )}
            <div className="mt-3 flex items-center gap-3">
              <code className="tabular text-[12px] text-text-faint">{product.code}</code>
              <StatusPill status={product.status} />
              {product.isNew && (
                <span className="inline-flex items-center h-[20px] px-2 rounded-full bg-accent/12 text-[10px] font-medium uppercase tracking-[0.14em] text-accent">
                  New
                </span>
              )}
            </div>
          </div>

          {/* Mini spec strip: family · HSN · GST */}
          <div className="grid grid-cols-3 gap-3 rounded-[10px] border border-rule bg-surface/60 px-4 py-3">
            <MiniSpec label="Family" value={product.familyLabel} />
            <MiniSpec label="HSN"    value={product.hsn} mono />
            <MiniSpec label="GST"    value={`${product.gstRate}%`} mono />
          </div>

          {/* Prices */}
          <PriceBlock
            retail={product.retail}
            mrp={product.mrp}
            cost={product.cost}
            uomShort={uomShort}
            hasDiscount={hasDiscount}
          />

          {/* Stock + dye lot signals */}
          <div className="flex flex-wrap gap-2">
            {product.inStock ? (
              <span className="inline-flex items-center gap-1.5 h-[22px] px-2.5 rounded-full bg-good/12 text-[11px] uppercase tracking-[0.1em] text-good">
                <span className="h-1.5 w-1.5 rounded-full bg-good" />
                In stock
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 h-[22px] px-2.5 rounded-full bg-surface border border-rule text-[11px] uppercase tracking-[0.1em] text-text-dim">
                Stock not tracked
              </span>
            )}
            {product.dyeLotHint && (
              <span
                className="inline-flex items-center gap-1.5 h-[22px] px-2.5 rounded-full bg-gold/15 text-[11px] uppercase tracking-[0.1em] text-accent"
                title="Dye-lot-sensitive family"
              >
                Dye lot {product.dyeLotHint}
              </span>
            )}
          </div>

          {/* CTA */}
          <div className="pt-1 space-y-2">
            <Link
              href={"/quotations/quick" as Route}
              className="group inline-flex items-center justify-center gap-2 w-full h-[48px] px-5 rounded-[10px] bg-gold text-ink font-display text-[15px] font-medium tracking-[-0.005em] hover:bg-gold-strong transition-colors"
            >
              Add to Quote
              <ArrowRight size={16} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            {product.catalogPdfKey && (
              <CatalogueViewer pdfKey={product.catalogPdfKey} designName={product.name} />
            )}
            <p className="text-[11px] text-text-faint text-center">
              {product.catalogPdfKey
                ? "Browse every pattern in the supplier's book, then pick and quote."
                : "Picks a client, adds this SKU as a preliminary line."}
            </p>
          </div>

          {/* Family attributes */}
          {product.attributes.length > 0 && (
            <div className="rounded-[14px] bg-surface border border-rule p-5">
              <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">
                Specifications
              </div>
              <dl className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-[12.5px]">
                {product.attributes.map((a) => (
                  <div key={a.key} className="flex items-baseline justify-between gap-3 col-span-2 sm:col-span-1">
                    <dt className="text-text-dim text-[11.5px]">{a.label}</dt>
                    <dd className="text-text text-right tabular">{a.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Read-only banner */}
          <div className="flex items-start gap-2 rounded-[10px] border border-info/30 bg-info/8 px-3 py-2.5 text-[11.5px] text-text-dim">
            <Info size={13} className="shrink-0 mt-[2px] text-info" />
            <span>Read-only for now. Edit via <span className="tabular text-text">scripts/add-catalog-xlsx.ts</span> or the upcoming Colourway editor.</span>
          </div>
        </aside>
      </div>
    </>
  );
}

// ── HERO ────────────────────────────────────────────────────────────

function HeroImage({
  src, hex, alt, isNew, dyeLotHint,
}: {
  src: string | null;
  hex: string | null;
  alt: string;
  isNew: boolean;
  dyeLotHint: string | null;
}) {
  return (
    <div className="relative aspect-[4/5] rounded-[14px] border border-rule bg-ink overflow-hidden">
      {src ? (
        <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-contain" />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: hex ?? "var(--color-surface-hover)" }}
          aria-label={`${alt} swatch`}
        />
      )}
      {/* Four gold "pin" dots at the image corners — signature move. */}
      <Pin position="top-left" />
      <Pin position="top-right" />
      <Pin position="bottom-left" />
      <Pin position="bottom-right" />

      {isNew && (
        <span className="absolute top-3 left-6 inline-flex items-center h-[22px] px-2.5 rounded-full bg-ink/85 backdrop-blur-sm text-[10.5px] font-medium uppercase tracking-[0.14em] text-accent">
          New
        </span>
      )}
      {dyeLotHint && (
        <span
          className="absolute top-3 right-6 h-[26px] min-w-[26px] px-2 inline-flex items-center justify-center rounded-full bg-gold text-ink text-[11px] font-semibold tabular tracking-tight shadow-[0_0_0_2px_rgba(11,16,32,0.85)]"
          title={`Dye lot: ${dyeLotHint}`}
        >
          {dyeLotHint}
        </span>
      )}
    </div>
  );
}

function Pin({ position }: { position: "top-left" | "top-right" | "bottom-left" | "bottom-right" }) {
  const cls =
    position === "top-left"     ? "top-2 left-2"
  : position === "top-right"    ? "top-2 right-2"
  : position === "bottom-left"  ? "bottom-2 left-2"
                                : "bottom-2 right-2";
  return (
    <span
      aria-hidden
      className={`absolute ${cls} h-[5px] w-[5px] rounded-full bg-gold shadow-[0_0_0_1px_rgba(11,16,32,0.9),0_0_6px_rgba(201,162,39,0.35)]`}
    />
  );
}

// ── VARIANTS ───────────────────────────────────────────────────────

function VariantStrip({
  currentId, siblings,
}: {
  currentId: string;
  siblings: { id: string; code: string; colourName: string; hex: string | null; imageKey: string | null }[];
}) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-2">
        Other colourways
      </div>
      <div className="flex flex-wrap gap-2">
        {siblings.map((s) => (
          <Link
            key={s.id}
            href={`/products/${s.id}` as Route}
            title={`${s.colourName} · ${s.code}`}
            className={`relative h-[56px] w-[56px] rounded-[8px] border-2 overflow-hidden transition-all ${s.id === currentId ? "border-gold" : "border-rule hover:border-rule/80"}`}
          >
            {s.imageKey ? (
              <img src={s.imageKey} alt={s.colourName} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0" style={{ background: s.hex ?? "var(--color-surface-hover)" }} />
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── SPECS + PRICES ──────────────────────────────────────────────────

function MiniSpec({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9.5px] uppercase tracking-[0.16em] text-text-faint">{label}</span>
      <span className={`text-[13px] text-text ${mono ? "tabular" : ""}`}>{value}</span>
    </div>
  );
}

function PriceBlock({
  retail, mrp, cost, uomShort, hasDiscount,
}: {
  retail: bigint | null;
  mrp: bigint | null;
  cost: bigint | null;
  uomShort: string;
  hasDiscount: boolean;
}) {
  const primary = retail ?? mrp;
  if (primary == null && cost == null) {
    return (
      <div className="text-[13px] text-text-faint">Price on request.</div>
    );
  }
  return (
    <div className="pb-2">
      {primary != null && (
        <div className="flex items-baseline gap-3">
          <div className="relative">
            <span className="font-display text-[26px] leading-none font-[520] text-text tabular tracking-[-0.01em]">
              {formatINR(primary)}
            </span>
            <span
              aria-hidden
              className="absolute left-0 -bottom-1 h-px w-full bg-gold/60"
            />
          </div>
          <span className="text-[12px] text-text-faint">/ {uomShort}</span>
        </div>
      )}
      <div className="mt-1 flex items-baseline gap-3 tabular text-[11.5px]">
        {hasDiscount && mrp != null && (
          <span className="text-text-faint line-through">MRP {formatINR(mrp)}</span>
        )}
        {retail != null && mrp == null && (
          <span className="text-text-dim uppercase tracking-[0.12em] text-[10.5px]">Retail</span>
        )}
        {cost != null && (
          <span className="text-text-dim">
            <span className="uppercase tracking-[0.12em] text-[10.5px] text-text-faint">Cost</span> {formatINR(cost)}
          </span>
        )}
      </div>
    </div>
  );
}

function shortUom(uom: string): string {
  switch (uom) {
    case "METRE":       return "m";
    case "SQFT":        return "sqft";
    case "SQM":         return "sqm";
    case "ROLL":        return "roll";
    case "BOX":         return "box";
    case "PIECE":       return "pc";
    case "SET":         return "set";
    case "RUNNING_FT":  return "rft";
    default:            return uom.toLowerCase();
  }
}

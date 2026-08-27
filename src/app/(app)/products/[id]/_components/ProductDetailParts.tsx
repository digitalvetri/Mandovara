import Link from "next/link";
import type { Route } from "next";
import { formatINR } from "@/kernel/money/format";

// ── HERO ─────────────────────────────────────────────────────────────────────

export function HeroImage({
  src, hex, alt, isNew, dyeLotHint, editor,
}: {
  src: string | null;
  hex: string | null;
  alt: string;
  isNew: boolean;
  dyeLotHint: string | null;
  editor?: React.ReactNode;
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
          className="absolute top-3 right-6 h-[26px] min-w-[26px] px-2 inline-flex items-center justify-center rounded-full bg-gold text-white text-[11px] font-semibold tabular tracking-tight ring-2 ring-surface"
          title={`Dye lot: ${dyeLotHint}`}
        >
          {dyeLotHint}
        </span>
      )}
      {editor}
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
      className={`absolute ${cls} h-[5px] w-[5px] rounded-full bg-gold ring-1 ring-surface`}
    />
  );
}

// ── VARIANTS ─────────────────────────────────────────────────────────────────

export function VariantStrip({
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

// ── SPECS + PRICES ────────────────────────────────────────────────────────────

export function MiniSpec({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9.5px] uppercase tracking-[0.16em] text-text-faint">{label}</span>
      <span className={`text-[13px] text-text ${mono ? "tabular" : ""}`}>{value}</span>
    </div>
  );
}

export function PriceBlock({
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
    return <div className="text-[13px] text-text-faint">Price on request.</div>;
  }
  return (
    <div className="pb-2">
      {primary != null && (
        <div className="flex items-baseline gap-3">
          <div className="relative">
            <span className="font-display text-[26px] leading-none font-[520] text-text tabular tracking-[-0.01em]">
              {formatINR(primary)}
            </span>
            <span aria-hidden className="absolute left-0 -bottom-1 h-px w-full bg-gold/60" />
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

// Renders the per-size price table (3x5 / 4x6 / …) when a rug or
// similar SKU has multiple size-tier rows. Tiers arrive as
// "SIZE:3x5" — we strip the prefix and show the clean label.
export function SizePriceTable({
  prices, uomShort,
}: {
  prices: { tier: string; amount: bigint }[];
  uomShort: string;
}) {
  const rows = prices
    .filter((p) => p.tier.startsWith("SIZE:"))
    .map((p) => ({ label: p.tier.slice("SIZE:".length), amount: p.amount }));
  if (rows.length === 0) return null;
  return (
    <div className="rounded-[10px] border border-rule bg-surface/60 overflow-hidden">
      <div className="overflow-x-auto px-4 py-2 border-b border-rule text-[10.5px] uppercase tracking-[0.16em] text-text-dim flex items-baseline justify-between">
        <span>Prices per size</span>
        <span className="text-text-faint text-[10px]">₹ / {uomShort}</span>
      </div>
      <table className="min-w-[480px] w-full text-[12.5px]">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-rule/60 last:border-b-0">
              <td className="px-4 py-2 text-text tabular uppercase">{r.label}</td>
              <td className="px-4 py-2 text-right text-text tabular font-medium">{formatINR(r.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function shortUom(uom: string): string {
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

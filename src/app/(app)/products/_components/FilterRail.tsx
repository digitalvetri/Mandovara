"use client";

// Left-hand filter rail on /products.
// Structured like a library card-catalogue drawer: each section has a
// small serif eyebrow + mono count, sections separated by hairline
// dividers. Every filter mirrors a URL param so state survives reload.
//
// Sections:
//   • Search (debounced 180ms)
//   • Category (family — mutually exclusive)
//   • Brand (mutually exclusive; only shown when 2+ brands exist)
//   • Price band (two-input min/max in ₹)
//   • In stock only (toggle)

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Route } from "next";
import { ChevronDown, ChevronUp, Search, SlidersHorizontal, X } from "lucide-react";
import type { BrandOption, CategoryOption, PriceBand } from "@/modules/products/queries";
import { PriceInputs } from "./PriceInputs";

interface Props {
  categories: CategoryOption[];
  brands:     BrandOption[];
  priceBand:  PriceBand;
}

export function FilterRail({ categories, brands, priceBand }: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const params   = useSearchParams();

  const q          = params.get("q") ?? "";
  const categoryId = params.get("categoryId") ?? "ALL";
  const brandId    = params.get("brandId") ?? "ALL";
  const inStock    = params.get("inStock") === "1";
  const priceMin   = params.get("priceMin") ?? "";
  const priceMax   = params.get("priceMax") ?? "";

  const [search, setSearch] = useState(q);
  useEffect(() => setSearch(q), [q]);

  // FIXES-01 §7.1 — collapsible filter block. Search bar stays always
  // visible above; the facets below fold away by default. Auto-open if
  // any filter is currently active so the user can see what's on.
  const activeCount =
    (categoryId !== "ALL"                  ? 1 : 0) +
    (brandId    !== "ALL"                  ? 1 : 0) +
    (priceMin.trim() !== ""                ? 1 : 0) +
    (priceMax.trim() !== ""                ? 1 : 0) +
    (inStock                                ? 1 : 0);
  const [expanded, setExpanded] = useState(activeCount > 0);
  useEffect(() => { if (activeCount > 0) setExpanded(true); }, [activeCount]);

  function clearAll(): void {
    const p = new URLSearchParams();
    // Preserve the search term (it lives in the always-visible bar).
    if (q) p.set("q", q);
    push(p);
  }

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function push(next: URLSearchParams) {
    next.delete("page");
    const s = next.toString();
    router.push((s.length > 0 ? `${pathname}?${s}` : pathname) as Route);
  }
  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value == null || value === "" || value === "ALL") next.delete(key);
    else next.set(key, value);
    push(next);
  }
  function onSearchChange(next: string) {
    setSearch(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const p = new URLSearchParams(params.toString());
      if (next.trim()) p.set("q", next.trim()); else p.delete("q");
      p.delete("page");
      router.replace(`${pathname}?${p.toString()}` as Route);
    }, 180);
  }

  const rupeeMin = Math.floor(Number(priceBand.minPaise) / 100);
  const rupeeMax = Math.ceil(Number(priceBand.maxPaise) / 100);

  return (
    <aside className="w-full lg:w-[240px] shrink-0 lg:sticky lg:top-4 self-start">
      {/* Search */}
      <div className="flex items-center gap-2 h-[38px] px-3 rounded-[8px] bg-surface border border-rule focus-within:border-accent">
        <Search size={14} className="text-text-dim shrink-0" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search catalogue…"
          className="flex-1 bg-transparent text-[12.5px] text-text placeholder:text-text-faint outline-none"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            aria-label="Clear search"
            className="text-text-faint hover:text-text transition-colors"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* FIXES-01 §7.1 — toggle to open/close the facet block. Split
          into two side-by-side buttons so Clear doesn't nest inside
          the toggle (invalid HTML) and doesn't accidentally toggle. */}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex-1 flex items-center justify-between gap-2 h-[34px] px-3 rounded-[8px] bg-surface border border-rule text-[11.5px] text-text-dim hover:text-text hover:border-rule/80 transition-colors"
        >
          <span className="inline-flex items-center gap-1.5">
            <SlidersHorizontal size={12} />
            Filters
            {activeCount > 0 && (
              <span className="ml-1 rounded-full bg-gold-tint px-1.5 py-[1px] text-[10px] font-semibold tabular text-gold">
                {activeCount}
              </span>
            )}
          </span>
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="h-[34px] px-3 rounded-[8px] border border-rule bg-surface text-[10.5px] uppercase tracking-[0.1em] text-text-dim hover:text-fault hover:border-fault/40 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {expanded && (
      <div className="mt-2 rounded-[14px] bg-surface border border-rule overflow-hidden">
        <Section title="Category" count={categories.length}>
          <FilterButton
            active={categoryId === "ALL"}
            label="All categories"
            count={categories.reduce((s, c) => s + c.productCount, 0)}
            onClick={() => setParam("categoryId", null)}
          />
          {categories.map((c) => (
            <FilterButton
              key={c.id}
              active={categoryId === c.id}
              label={c.name}
              count={c.productCount}
              onClick={() => setParam("categoryId", c.id)}
            />
          ))}
        </Section>

        {brands.length >= 2 && (
          <Section title="Brand" count={brands.length}>
            <FilterButton
              active={brandId === "ALL"}
              label="All brands"
              count={brands.reduce((s, b) => s + b.productCount, 0)}
              onClick={() => setParam("brandId", null)}
            />
            {brands.map((b) => (
              <FilterButton
                key={b.id}
                active={brandId === b.id}
                label={b.name}
                count={b.productCount}
                onClick={() => setParam("brandId", b.id)}
              />
            ))}
          </Section>
        )}

        <Section title="Price band" count={null} caption={`₹${rupeeMin.toLocaleString("en-IN")} – ₹${rupeeMax.toLocaleString("en-IN")}`}>
          <PriceInputs
            initialMin={priceMin}
            initialMax={priceMax}
            onApply={(min, max) => {
              const p = new URLSearchParams(params.toString());
              if (min) p.set("priceMin", min); else p.delete("priceMin");
              if (max) p.set("priceMax", max); else p.delete("priceMax");
              push(p);
            }}
          />
        </Section>

        <Section title="Stock" count={null}>
          <label className="flex items-center gap-2.5 px-4 py-2.5 text-[12px] text-text cursor-pointer hover:bg-surface-hover transition-colors">
            <input
              type="checkbox"
              checked={inStock}
              onChange={(e) => setParam("inStock", e.target.checked ? "1" : null)}
              className="h-[14px] w-[14px] accent-accent"
            />
            In stock only
          </label>
        </Section>
      </div>
      )}
    </aside>
  );
}

function Section({
  title, count, caption, children,
}: {
  title: string;
  count: number | null;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-rule/60 last:border-0">
      <div className="px-4 pt-3.5 pb-2 flex items-baseline justify-between">
        <div className="font-display text-[10.5px] uppercase tracking-[0.16em] text-text-dim font-normal">
          {title}
        </div>
        {count != null && (
          <div className="tabular text-[10.5px] text-text-faint">{count}</div>
        )}
        {caption && (
          <div className="tabular text-[10px] text-text-faint">{caption}</div>
        )}
      </div>
      <div className="pb-2">{children}</div>
    </section>
  );
}

function FilterButton({
  active, label, count, onClick,
}: {
  active: boolean;
  label:  string;
  count:  number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-2 px-4 py-1.5 text-[12px] transition-colors ${
        active
          ? "bg-gold/12 text-text"
          : "text-text-dim hover:bg-surface-hover hover:text-text"
      }`}
    >
      <span className="truncate text-left">{label}</span>
      <span className={`tabular text-[10.5px] shrink-0 ${active ? "text-accent" : "text-text-faint"}`}>
        {count}
      </span>
    </button>
  );
}


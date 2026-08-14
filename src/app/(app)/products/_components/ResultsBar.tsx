"use client";

// Sits above the product grid. Shows active-filter chips (with × to
// remove), the "N / total" count in mono, and a right-aligned sort
// selector. Everything is URL-driven so state is shareable.

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { Route } from "next";
import { X, ArrowUpDown } from "lucide-react";
import type { BrandOption, CategoryOption } from "@/modules/products/queries";

interface Chip {
  key:   string;
  label: string;
  paramKey: string;
}

interface Props {
  total:      number;
  page:       number;
  pageSize:   number;
  totalAll:   number;
  categories: CategoryOption[];
  brands:     BrandOption[];
}

const SORT_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "name",       label: "Name A–Z" },
  { value: "recent",     label: "Recently added" },
  { value: "code",       label: "Code" },
  { value: "price_asc",  label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
];

export function ResultsBar({ total, page, pageSize, totalAll, categories, brands }: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const params   = useSearchParams();

  const chips = buildChips(params, categories, brands);

  function removeParam(key: string) {
    const next = new URLSearchParams(params.toString());
    next.delete(key);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}` as Route);
  }
  function clearAll() {
    router.push(pathname as Route);
  }
  function onSort(next: string) {
    const p = new URLSearchParams(params.toString());
    if (next === "name") p.delete("sort");
    else p.set("sort", next);
    p.delete("page");
    router.push(`${pathname}?${p.toString()}` as Route);
  }

  const sort = params.get("sort") ?? "name";
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);
  const rangeLabel = total === totalAll
    ? `${total} ${total === 1 ? "SKU" : "SKUs"}`
    : `${from}–${to} of ${total}`;

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4 min-h-[34px]">
      {/* Active-filter chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => removeParam(c.paramKey)}
              className="group inline-flex items-center gap-1.5 h-[26px] pl-2 pr-1 rounded-full bg-gold/10 border border-gold/25 text-[11px] uppercase tracking-[0.08em] text-accent hover:bg-gold/15 transition-colors"
            >
              {c.label}
              <span className="inline-flex items-center justify-center h-4 w-4 rounded-full text-accent/70 group-hover:text-accent">
                <X size={11} />
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="h-[26px] px-2 text-[10.5px] uppercase tracking-[0.12em] text-text-faint hover:text-text transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Count */}
      <div className="tabular text-[11px] text-text-dim">
        <span className="text-text">{rangeLabel}</span>
        {total !== totalAll && (
          <span className="text-text-faint"> / {totalAll}</span>
        )}
      </div>

      {/* Sort — pushed right */}
      <div className="ml-auto flex items-center gap-2">
        <ArrowUpDown size={12} className="text-text-faint" />
        <label className="text-[10.5px] uppercase tracking-[0.12em] text-text-dim">Sort</label>
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value)}
          className="h-[28px] px-2 pr-6 bg-surface border border-rule rounded-[6px] text-[12px] text-text outline-none focus:border-accent"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function buildChips(
  params: URLSearchParams,
  categories: CategoryOption[],
  brands: BrandOption[],
): Chip[] {
  const out: Chip[] = [];
  const q = params.get("q");
  if (q) out.push({ key: `q:${q}`, label: `“${q}”`, paramKey: "q" });

  const cat = params.get("categoryId");
  if (cat) {
    const match = categories.find((c) => c.id === cat);
    out.push({ key: `cat:${cat}`, label: match?.name ?? cat, paramKey: "categoryId" });
  }
  const brand = params.get("brandId");
  if (brand) {
    const match = brands.find((b) => b.id === brand);
    out.push({ key: `brand:${brand}`, label: match?.name ?? brand, paramKey: "brandId" });
  }
  const priceMin = params.get("priceMin");
  const priceMax = params.get("priceMax");
  if (priceMin || priceMax) {
    const min = priceMin ? `₹${Number(priceMin).toLocaleString("en-IN")}` : "—";
    const max = priceMax ? `₹${Number(priceMax).toLocaleString("en-IN")}` : "—";
    out.push({ key: "price", label: `${min} – ${max}`, paramKey: priceMin ? "priceMin" : "priceMax" });
  }
  const inStock = params.get("inStock");
  if (inStock === "1") out.push({ key: "inStock", label: "In stock", paramKey: "inStock" });

  return out;
}

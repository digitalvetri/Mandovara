"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState, useEffect } from "react";
import { Search } from "lucide-react";

const FAMILIES = [
  ["CURTAIN_FABRIC", "Curtain"],
  ["SHEER", "Sheer"],
  ["LINING", "Lining"],
  ["BLIND", "Blind"],
  ["WALLPAPER", "Wallpaper"],
  ["FLOORING", "Flooring"],
  ["CARPET_ROLL", "Carpet roll"],
  ["CARPET_TILE", "Carpet tile"],
  ["UPHOLSTERY_FABRIC", "Upholstery"],
  ["INTERIOR_FILM", "Film"],
  ["VERTICAL_GARDEN", "V. Garden"],
] as const;

export function BalanceFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const currentFamily = params.get("family") ?? "";
  const currentSearch = params.get("q") ?? "";
  const [search, setSearch] = useState(currentSearch);
  useEffect(() => setSearch(currentSearch), [currentSearch]);

  function push(next: URLSearchParams) {
    startTransition(() => {
      const s = next.toString();
      router.push(s.length > 0 ? `/inventory?${s}` : "/inventory");
    });
  }

  function onFamily(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = new URLSearchParams(params.toString());
    if (e.target.value === "") next.delete("family");
    else next.set("family", e.target.value);
    next.delete("page");
    push(next);
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams(params.toString());
    if (search.trim() === "") next.delete("q");
    else next.set("q", search.trim());
    next.delete("page");
    push(next);
  }

  return (
    <div className="flex items-center gap-3 mb-4">
      <select
        value={currentFamily}
        onChange={onFamily}
        className="h-[32px] px-2 bg-surface border border-rule rounded-[8px] text-[12.5px] outline-none focus:border-gold"
      >
        <option value="">All families</option>
        {FAMILIES.map(([val, label]) => (
          <option key={val} value={val}>{label}</option>
        ))}
      </select>

      <form onSubmit={onSearchSubmit} className="flex-1 max-w-[360px]">
        <label className="flex items-center gap-2 h-[32px] px-3 bg-surface border border-rule rounded-[8px]">
          <Search size={13} strokeWidth={1.75} className="text-text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Colourway code or name"
            className="flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-text-muted"
          />
        </label>
      </form>
    </div>
  );
}

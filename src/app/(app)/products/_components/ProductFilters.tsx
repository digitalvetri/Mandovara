"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState, useEffect } from "react";
import { Search } from "lucide-react";
import type { CategoryOption } from "@/modules/products/queries";

export function ProductFilters({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const currentCat = params.get("categoryId") ?? "ALL";
  const currentSearch = params.get("q") ?? "";
  const [search, setSearch] = useState(currentSearch);
  useEffect(() => setSearch(currentSearch), [currentSearch]);

  function push(next: URLSearchParams) {
    startTransition(() => {
      const s = next.toString();
      router.push(s.length > 0 ? `/products?${s}` : "/products");
    });
  }

  function onCat(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = new URLSearchParams(params.toString());
    if (e.target.value === "ALL") next.delete("categoryId");
    else next.set("categoryId", e.target.value);
    next.delete("page");
    push(next);
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams(params.toString());
    if (search.trim().length === 0) next.delete("q");
    else next.set("q", search.trim());
    next.delete("page");
    push(next);
  }

  return (
    <div className="flex items-center gap-3 mb-4">
      <select
        value={currentCat}
        onChange={onCat}
        className="h-[32px] px-2 bg-surface border border-rule rounded-[8px] text-[12.5px] outline-none focus:border-accent"
      >
        <option value="ALL">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name} ({c.productCount})</option>
        ))}
      </select>

      <form onSubmit={onSearchSubmit} className="flex-1 max-w-[420px]">
        <label className="flex items-center gap-2 h-[32px] px-3 bg-surface border border-rule rounded-[8px]">
          <Search size={13} strokeWidth={1.75} className="text-text-faint" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Code, name, HSN"
            className="flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-text-faint"
          />
        </label>
      </form>
    </div>
  );
}

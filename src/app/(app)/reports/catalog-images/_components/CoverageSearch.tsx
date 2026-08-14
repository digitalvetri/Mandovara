"use client";

// URL-driven search box for the missing-SKU list.
// Same debounced pattern used across the app so search feels native.

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { Search } from "lucide-react";

export function CoverageSearch({ initialValue }: { initialValue: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(initialValue);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setValue(initialValue), [initialValue]);

  function onChange(next: string) {
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const p = new URLSearchParams(params.toString());
      if (next.trim()) p.set("q", next.trim()); else p.delete("q");
      p.delete("page"); // reset paging when the search changes
      const qs = p.toString();
      router.replace((qs ? `/reports/catalog-images?${qs}` : "/reports/catalog-images") as Route);
    }, 180);
  }

  return (
    <div className="mb-4 flex items-center gap-2 h-[40px] px-3 rounded-[8px] bg-ink border border-rule focus-within:border-accent">
      <Search size={14} className="text-text-dim" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Filter by code, design, collection, or brand…"
        className="flex-1 bg-transparent text-[13px] text-text placeholder:text-text-faint outline-none"
      />
    </div>
  );
}

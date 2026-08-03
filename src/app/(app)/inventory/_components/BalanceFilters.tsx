"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState, useEffect } from "react";
import { Search } from "lucide-react";

interface Props { warehouses: { id: string; name: string }[] }

export function BalanceFilters({ warehouses }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const currentWh = params.get("warehouseId") ?? "ALL";
  const onlyLow = params.get("low") === "1";
  const currentSearch = params.get("q") ?? "";
  const [search, setSearch] = useState(currentSearch);
  useEffect(() => setSearch(currentSearch), [currentSearch]);

  function push(next: URLSearchParams) {
    startTransition(() => {
      const s = next.toString();
      router.push(s.length > 0 ? `/inventory?${s}` : "/inventory");
    });
  }
  function onWh(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = new URLSearchParams(params.toString());
    if (e.target.value === "ALL") next.delete("warehouseId");
    else next.set("warehouseId", e.target.value);
    next.delete("page");
    push(next);
  }
  function onLow() {
    const next = new URLSearchParams(params.toString());
    if (onlyLow) next.delete("low");
    else next.set("low", "1");
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
      <select value={currentWh} onChange={onWh}
              className="h-[32px] px-2 bg-surface border border-rule rounded-[8px] text-[12.5px] outline-none focus:border-accent">
        <option value="ALL">All warehouses</option>
        {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>
      <button type="button" onClick={onLow}
              className={[
                "h-[32px] px-3 rounded-[8px] text-[12px] border transition-colors",
                onlyLow ? "bg-bad text-white border-bad" : "bg-surface text-text-dim border-rule hover:text-text",
              ].join(" ")}>
        Below reorder only
      </button>
      <form onSubmit={onSearchSubmit} className="flex-1 max-w-[360px]">
        <label className="flex items-center gap-2 h-[32px] px-3 bg-surface border border-rule rounded-[8px]">
          <Search size={13} strokeWidth={1.75} className="text-text-faint" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
                 placeholder="Code or name"
                 className="flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-text-faint" />
        </label>
      </form>
    </div>
  );
}

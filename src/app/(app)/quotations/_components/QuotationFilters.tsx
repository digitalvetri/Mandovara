"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState, useEffect } from "react";
import { Search, LayoutList, LayoutGrid, ChevronDown } from "lucide-react";

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "PENDING_APPROVAL", label: "Pending Approval" },
  { key: "APPROVED", label: "Approved" },
  { key: "SENT", label: "Sent" },
  { key: "REVISED", label: "Revised" },
  { key: "ACCEPTED", label: "Accepted" },
  { key: "REJECTED", label: "Rejected" },
  { key: "EXPIRED", label: "Expired" },
];

const SORT_OPTIONS = [
  { value: "recent", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "total",  label: "Highest value" },
];

interface QuotationFiltersProps {
  statusCounts: Record<string, number>;
}

export function QuotationFilters({ statusCounts }: QuotationFiltersProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const currentStatus = params.get("status") ?? "ALL";
  const currentSort   = params.get("sort") ?? "recent";
  const currentView   = params.get("view") ?? "list";
  const currentSearch = params.get("q") ?? "";
  const [search, setSearch] = useState(currentSearch);
  useEffect(() => setSearch(currentSearch), [currentSearch]);

  function push(next: URLSearchParams) {
    startTransition(() => {
      const s = next.toString();
      router.push(s.length > 0 ? `/quotations?${s}` : "/quotations");
    });
  }

  function setParam(key: string, value: string, clear?: string[]) {
    const next = new URLSearchParams(params.toString());
    if (value === "" || value === "ALL") next.delete(key);
    else next.set(key, value);
    next.delete("page");
    for (const k of clear ?? []) next.delete(k);
    push(next);
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setParam("q", search.trim());
  }

  const totalCount = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="mb-4 space-y-2.5">
      {/* ── Top row: search + sort + view toggle ──────────────────── */}
      <div className="flex items-center gap-2.5">
        <form onSubmit={onSearchSubmit} className="flex-1 max-w-[400px]">
          <label className="flex items-center gap-2 h-[34px] px-3 bg-surface border border-rule rounded-[8px] focus-within:border-accent transition-colors">
            <Search size={13} strokeWidth={1.75} className="text-text-faint shrink-0" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Number, client name…"
              className="flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-text-faint"
            />
          </label>
        </form>

        {/* Sort */}
        <div className="relative flex items-center">
          <select
            value={currentSort}
            onChange={(e) => setParam("sort", e.target.value)}
            className="h-[34px] pl-3 pr-7 rounded-[8px] bg-surface border border-rule text-[12.5px] text-text-dim appearance-none outline-none hover:border-accent transition-colors cursor-pointer"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2 text-text-dim pointer-events-none" />
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-0.5 border border-rule rounded-[8px] bg-surface p-0.5 ml-auto">
          <button
            type="button"
            title="List view"
            onClick={() => setParam("view", "list")}
            className={[
              "flex items-center justify-center w-7 h-7 rounded-[6px] transition-colors",
              currentView !== "cards" ? "bg-surface-2 text-text" : "text-text-dim hover:text-text",
            ].join(" ")}
          >
            <LayoutList size={14} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            title="Card view"
            onClick={() => setParam("view", "cards")}
            className={[
              "flex items-center justify-center w-7 h-7 rounded-[6px] transition-colors",
              currentView === "cards" ? "bg-surface-2 text-text" : "text-text-dim hover:text-text",
            ].join(" ")}
          >
            <LayoutGrid size={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* ── Status tabs with counts ────────────────────────────────── */}
      <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none">
        {STATUS_TABS.map((tab) => {
          const active = currentStatus === tab.key;
          const count  = tab.key === "ALL" ? totalCount : (statusCounts[tab.key] ?? 0);
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setParam("status", tab.key)}
              className={[
                "flex items-center gap-1.5 h-[30px] px-3 rounded-[6px] text-[12px] whitespace-nowrap transition-colors shrink-0",
                active
                  ? "bg-accent text-white font-medium"
                  : "text-text-dim hover:text-text hover:bg-surface-2",
              ].join(" ")}
            >
              {tab.label}
              <span
                className={[
                  "inline-block min-w-[18px] px-1 text-center text-[10.5px] rounded-[4px] tabular",
                  active ? "bg-white/20 text-white" : "bg-surface-2 text-text-dim",
                ].join(" ")}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

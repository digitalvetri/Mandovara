"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState, useEffect } from "react";
import { Search, ChevronDown } from "lucide-react";

const STATUS_OPTIONS: { key: string; label: string }[] = [
  { key: "ALL",              label: "All Status" },
  { key: "DRAFT",            label: "Draft" },
  { key: "PENDING_APPROVAL", label: "Pending Approval" },
  { key: "APPROVED",         label: "Approved" },
  { key: "SENT",             label: "Sent" },
  { key: "REVISED",          label: "Revised" },
  { key: "ACCEPTED",         label: "Accepted" },
  { key: "REJECTED",         label: "Rejected" },
  { key: "EXPIRED",          label: "Expired" },
];

interface QuotationFiltersProps {
  projectId?: string;
}

export function QuotationFilters({ projectId }: QuotationFiltersProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const currentStatus   = params.get("status")   ?? "ALL";
  const currentSearch   = params.get("q")         ?? "";
  const currentDateFrom = params.get("dateFrom")  ?? "";
  const currentDateTo   = params.get("dateTo")    ?? "";

  const [search, setSearch] = useState(currentSearch);
  useEffect(() => setSearch(currentSearch), [currentSearch]);

  function push(next: URLSearchParams) {
    // Always preserve the project filter when navigating within a project context
    if (projectId) next.set("project", projectId);
    startTransition(() => {
      const s = next.toString();
      router.push(s.length > 0 ? `/quotations?${s}` : "/quotations");
    });
  }

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "" || value === "ALL") next.delete(key);
    else next.set(key, value);
    next.delete("page");
    push(next);
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setParam("q", search.trim());
  }

  function reset() {
    startTransition(() =>
      router.push(projectId ? `/quotations?project=${projectId}` : "/quotations"),
    );
  }

  const hasFilters =
    currentSearch !== "" ||
    currentStatus !== "ALL" ||
    currentDateFrom !== "" ||
    currentDateTo !== "";

  const selectCls =
    "h-[36px] pl-3 pr-7 rounded-[8px] bg-surface border border-rule " +
    "text-[12.5px] text-text-dim appearance-none outline-none " +
    "hover:border-accent/60 focus:border-accent transition-colors cursor-pointer";

  const inputCls =
    "h-[36px] px-3 rounded-[8px] bg-surface border border-rule " +
    "text-[12.5px] text-text-dim outline-none " +
    "hover:border-accent/60 focus:border-accent transition-colors " +
    "[color-scheme:dark]";

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      {/* Search */}
      <form onSubmit={onSearchSubmit} className="flex-1 min-w-[200px] max-w-[320px]">
        <label className="flex items-center gap-2 h-[36px] px-3 bg-surface border border-rule rounded-[8px] focus-within:border-accent transition-colors">
          <Search size={13} strokeWidth={1.75} className="text-text-dim shrink-0" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Number, client name…"
            className="flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-text-dim/50"
          />
        </label>
      </form>

      {/* Status */}
      <div className="relative flex items-center">
        <select
          value={currentStatus}
          onChange={(e) => setParam("status", e.target.value)}
          className={selectCls}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
        <ChevronDown size={12} className="absolute right-2.5 text-text-dim pointer-events-none" />
      </div>

      {/* Date from */}
      <input
        type="date"
        value={currentDateFrom}
        onChange={(e) => setParam("dateFrom", e.target.value)}
        className={inputCls}
        title="From date"
      />

      {/* Date to */}
      <input
        type="date"
        value={currentDateTo}
        onChange={(e) => setParam("dateTo", e.target.value)}
        className={inputCls}
        title="To date"
      />

      {/* Reset */}
      {hasFilters && (
        <button
          type="button"
          onClick={reset}
          className="h-[36px] px-3 rounded-[8px] text-[12.5px] text-text-dim
                     hover:text-text hover:bg-surface-2 transition-colors"
        >
          Reset
        </button>
      )}
    </div>
  );
}

"use client";

// URL-driven filters. Every filter round-trips through search params so the
// view is shareable and back-button-safe (§6.3 rule 3).

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState, useEffect, useCallback } from "react";
import { Search, X } from "lucide-react";
import { LEAD_SOURCE_OPTIONS, LEAD_PRIORITIES } from "@/modules/leads/schema";
import type { SalesUserOption } from "@/modules/leads/queries";

// Only the four sanctioned stages after the 25 Aug 2026 simplification.
// See src/modules/leads/schema.ts ACTIVE_LEAD_STAGES for the rationale.
const STATUS_TABS = [
  { key: "ALL",     label: "All" },
  { key: "NEW",     label: "New" },
  { key: "QUOTED",  label: "Quoted" },
  { key: "WON",     label: "Won" },
  { key: "LOST",    label: "Lost" },
] as const;

const PRIORITY_OPTS = LEAD_PRIORITIES.map((p) => ({
  key: p,
  label: p.charAt(0) + p.slice(1).toLowerCase(),
  cls: p === "HOT" ? "border-fault/50 text-fault hover:bg-fault/10"
     : p === "WARM" ? "border-warn/50 text-warn hover:bg-warn/10"
     : "border-rule text-text-dim hover:bg-surface-hover",
  activeCls: p === "HOT" ? "bg-fault/15 border-fault text-fault"
           : p === "WARM" ? "bg-warn/15 border-warn text-warn"
           : "bg-surface-hover border-rule text-text",
}));

interface Props {
  salesUsers: SalesUserOption[];
  cities: string[];
}

export function LeadFilters({ salesUsers, cities }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const currentStatus   = params.get("status") ?? params.get("stage") ?? "ALL";
  const currentPriority = params.get("priority") ?? "";
  const currentSource   = params.get("source") ?? "";
  const currentOwner    = params.get("ownerId") ?? "";
  const currentCity     = params.get("city") ?? "";
  const currentSearch   = params.get("q") ?? "";

  const [search, setSearch] = useState(currentSearch);
  useEffect(() => setSearch(currentSearch), [currentSearch]);

  const push = useCallback((next: URLSearchParams) => {
    startTransition(() => {
      const s = next.toString();
      router.push(s.length > 0 ? `/leads?${s}` : "/leads");
    });
  }, [router]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value) next.delete(key);
    else next.set(key, value);
    next.delete("page");
    push(next);
  }

  function toggleParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    const current = next.get(key);
    if (current === value) next.delete(key);
    else next.set(key, value);
    next.delete("page");
    push(next);
  }

  function onStatus(key: string) {
    const next = new URLSearchParams(params.toString());
    next.delete("stage");
    if (key === "ALL") next.delete("status");
    else next.set("status", key);
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

  const hasActiveFilters = currentPriority || currentSource || currentOwner || currentCity || currentSearch;

  function clearAll() {
    const next = new URLSearchParams();
    if (params.get("status") || params.get("stage")) {
      const stage = params.get("status") ?? params.get("stage");
      if (stage && stage !== "ALL") next.set("status", stage);
    }
    push(next);
  }

  return (
    <div className="space-y-2 mb-4">
      {/* Status tabs — horizontally scrollable */}
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5 border border-rule rounded-[8px] bg-surface p-0.5 no-scrollbar">
        {STATUS_TABS.map((tab) => {
          const active = currentStatus === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onStatus(tab.key)}
              className={[
                "shrink-0 h-[28px] px-3 rounded-[6px] text-[12px] transition-colors whitespace-nowrap",
                active
                  ? "bg-accent text-white"
                  : "text-text-dim hover:text-text hover:bg-surface-hover",
              ].join(" ")}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Search + secondary filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <form onSubmit={onSearchSubmit} className="flex-1 min-w-[180px] max-w-[300px]">
          <label className="flex items-center gap-2 h-[32px] px-3 bg-surface border border-rule rounded-[8px]">
            <Search size={13} strokeWidth={1.75} className="text-text-faint shrink-0" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, mobile, lead #"
              className="flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-text-faint"
            />
          </label>
        </form>

        {/* Priority toggles */}
        <div className="flex items-center gap-1">
          {PRIORITY_OPTS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => toggleParam("priority", p.key)}
              className={[
                "h-[30px] px-2.5 rounded-[6px] text-[11.5px] font-medium border transition-colors",
                currentPriority === p.key ? p.activeCls : p.cls,
              ].join(" ")}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Source */}
        <select
          value={currentSource}
          onChange={(e) => setParam("source", e.target.value)}
          className="h-[32px] px-2.5 bg-surface border border-rule rounded-[8px] text-[12.5px] text-text-dim outline-none cursor-pointer"
        >
          <option value="">Source</option>
          {LEAD_SOURCE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        {/* Sales exec */}
        {salesUsers.length > 0 && (
          <select
            value={currentOwner}
            onChange={(e) => setParam("ownerId", e.target.value)}
            className="h-[32px] px-2.5 bg-surface border border-rule rounded-[8px] text-[12.5px] text-text-dim outline-none cursor-pointer"
          >
            <option value="">Assigned To</option>
            {salesUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        )}

        {/* City */}
        {cities.length > 0 && (
          <select
            value={currentCity}
            onChange={(e) => setParam("city", e.target.value)}
            className="h-[32px] px-2.5 bg-surface border border-rule rounded-[8px] text-[12.5px] text-text-dim outline-none cursor-pointer"
          >
            <option value="">City</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}

        {/* Clear all */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="flex items-center gap-1 h-[30px] px-2 rounded-[6px] text-[11.5px] text-text-dim hover:text-text hover:bg-surface-hover border border-rule transition-colors"
          >
            <X size={12} />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

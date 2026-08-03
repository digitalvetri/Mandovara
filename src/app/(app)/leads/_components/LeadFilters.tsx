"use client";

// URL-driven filters. Rule 6.4: URL is state — every filter round-trips
// through search params so the view is shareable and back-button-safe.

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState, useEffect } from "react";
import { Search } from "lucide-react";
import { LEAD_STATUSES } from "@/modules/leads/schema";

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "OPEN", label: "Open" },
  { key: "ALL", label: "All" },
  ...LEAD_STATUSES.map((s) => ({ key: s, label: humanise(s) })),
];

export function LeadFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const currentStatus = params.get("status") ?? "OPEN";
  const currentSearch = params.get("q") ?? "";
  const [search, setSearch] = useState(currentSearch);

  useEffect(() => setSearch(currentSearch), [currentSearch]);

  function push(next: URLSearchParams) {
    startTransition(() => {
      const s = next.toString();
      router.push(s.length > 0 ? `/leads?${s}` : "/leads");
    });
  }

  function onStatus(key: string) {
    const next = new URLSearchParams(params.toString());
    if (key === "OPEN") next.delete("status");
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

  return (
    <div className="flex items-center gap-4 mb-4">
      <div className="flex items-center gap-1 border border-rule rounded-[8px] bg-surface p-0.5">
        {STATUS_TABS.map((tab) => {
          const active = currentStatus === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onStatus(tab.key)}
              className={[
                "h-[28px] px-3 rounded-[6px] text-[12px] transition-colors",
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

      <form onSubmit={onSearchSubmit} className="flex-1 max-w-[360px]">
        <label className="flex items-center gap-2 h-[32px] px-3 bg-surface border border-rule rounded-[8px]">
          <Search size={13} strokeWidth={1.75} className="text-text-faint" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, mobile, email, company"
            className="flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-text-faint"
          />
        </label>
      </form>
    </div>
  );
}

function humanise(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

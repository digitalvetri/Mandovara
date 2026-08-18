"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState, useEffect } from "react";
import { Search } from "lucide-react";
import { PROJECT_STATUSES } from "@/modules/projects/schema";

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "OPEN", label: "Open" },
  { key: "ALL",  label: "All" },
  ...PROJECT_STATUSES.map((s) => ({
    key: s, label: s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " "),
  })),
];

export function ProjectFilters() {
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
      router.push(s.length > 0 ? `/projects?${s}` : "/projects");
    });
  }
  function onStatus(key: string) {
    const next = new URLSearchParams(params.toString());
    if (key === "OPEN") next.delete("status"); else next.set("status", key);
    next.delete("page");
    push(next);
  }
  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams(params.toString());
    if (search.trim() === "") next.delete("q"); else next.set("q", search.trim());
    next.delete("page");
    push(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <div className="flex items-center gap-1 border border-rule rounded-[8px] bg-surface p-0.5 max-w-full overflow-x-auto">
        {STATUS_TABS.map((tab) => {
          const active = currentStatus === tab.key;
          return (
            <button key={tab.key} type="button" onClick={() => onStatus(tab.key)}
                    className={[
                      "h-[28px] px-3 rounded-[6px] text-[12px] transition-colors",
                      active ? "bg-accent text-white" : "text-text-dim hover:text-text hover:bg-surface-hover",
                    ].join(" ")}>
              {tab.label}
            </button>
          );
        })}
      </div>
      <form onSubmit={onSearchSubmit} className="w-full sm:w-auto sm:flex-1 sm:max-w-[360px] min-w-0">
        <label className="flex items-center gap-2 h-[32px] px-3 bg-surface border border-rule rounded-[8px] min-w-0">
          <Search size={13} strokeWidth={1.75} className="text-text-faint" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
                 placeholder="Number, name, client"
                 className="flex-1 min-w-0 bg-transparent text-[12.5px] outline-none placeholder:text-text-faint" />
        </label>
      </form>
    </div>
  );
}

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState, useEffect } from "react";
import { Search } from "lucide-react";
import { ORDER_STATUSES } from "@/modules/orders/schema";

const STATUS_LABELS: Record<string, string> = {
  DRAFT:            "Draft",
  CONFIRMED:        "Confirmed",
  PROCUREMENT:      "Procurement",
  MAKE:             "Make",
  READY_TO_INSTALL: "Ready",
  INSTALLING:       "Installing",
  COMPLETED:        "Completed",
  CANCELLED:        "Cancelled",
};

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "OPEN", label: "Open" },
  { key: "ALL",  label: "All" },
  ...ORDER_STATUSES.map((s) => ({
    key: s,
    label: STATUS_LABELS[s] ?? s,
  })),
];

export function OrderFilters() {
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
      router.push(s.length > 0 ? `/orders?${s}` : "/orders");
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
      <div className="flex items-center gap-1 border border-rule rounded-[8px] bg-surface p-0.5 overflow-x-auto">
        {STATUS_TABS.map((tab) => {
          const active = currentStatus === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onStatus(tab.key)}
              className={[
                "h-[28px] px-3 rounded-[6px] text-[12px] whitespace-nowrap transition-colors",
                active ? "bg-gold text-ink" : "text-text-dim hover:text-text hover:bg-surface-hover",
              ].join(" ")}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <form onSubmit={onSearchSubmit} className="flex-1 max-w-[360px]">
        <label className="flex items-center gap-2 h-[32px] px-3 bg-surface border border-rule rounded-[8px]">
          <Search size={13} strokeWidth={1.75} className="text-text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Number, client name"
            className="flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-text-subtle"
          />
        </label>
      </form>
    </div>
  );
}

"use client";

// Pill filters + single search input, mirroring the reference screenshot.
// Filters collapse Mandovara's 11 stages into 4 buckets a Rohit-type user
// actually thinks in: All / Active / Completed / Cancelled. The full
// stage list is still available via URL — this is just the primary UX.

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { Route } from "next";
import { useState } from "react";
import { Search } from "lucide-react";

const PILLS: readonly { key: string; label: string }[] = [
  { key: "ALL",       label: "All" },
  { key: "ACTIVE",    label: "Active" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
];

export function ProjectsToolbar() {
  const router   = useRouter();
  const pathname = usePathname();
  const params   = useSearchParams();
  const current  = params.get("status") ?? params.get("stage") ?? "ALL";
  const [text, setText] = useState(params.get("q") ?? "");

  function pushWith(next: URLSearchParams): void {
    router.push(`${pathname}${next.toString() ? `?${next}` : ""}` as Route);
  }

  function onPill(key: string): void {
    const next = new URLSearchParams(params.toString());
    next.delete("stage");
    if (key === "ALL") next.delete("status"); else next.set("status", key);
    next.delete("page");
    pushWith(next);
  }

  function applySearch(): void {
    const q = text.trim();
    const next = new URLSearchParams(params.toString());
    if (q.length > 0) next.set("q", q); else next.delete("q");
    next.delete("page");
    pushWith(next);
  }

  return (
    <div className="mb-4 space-y-3">
      {/* Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {PILLS.map((p) => {
          const active = current === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onPill(p.key)}
              className={[
                "h-8 rounded-full px-3.5 text-[12.5px] font-medium transition-colors",
                active
                  ? "bg-solid text-ink"
                  : "border border-rule bg-surface text-text-dim hover:text-text",
              ].join(" ")}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="flex max-w-[420px] items-center gap-2 rounded-full border border-rule bg-surface px-4 py-2">
        <Search size={13} className="shrink-0 text-text-dim" />
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") applySearch(); }}
          onBlur={applySearch}
          placeholder="Search client, order no, site…"
          className="flex-1 bg-transparent text-[12.5px] text-text placeholder:text-text-dim outline-none"
          aria-label="Search projects"
        />
      </div>
    </div>
  );
}

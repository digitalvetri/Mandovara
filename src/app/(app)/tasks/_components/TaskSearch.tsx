"use client";

// Search beside the task tabs (owner, 2026-08-29): filter by task title
// or by the client / lead the task is against.
//
// Debounced 300ms and written to the URL, so the tab links keep working
// and a filtered view can be shared or bookmarked. Filtering happens on
// the server beside the tab logic — the page already holds every task
// for this user, so there is nothing to fetch and nothing to paginate.

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { Route } from "next";
import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";

export function TaskSearch() {
  const router   = useRouter();
  const pathname = usePathname();
  const params   = useSearchParams();
  const initial  = params.get("q") ?? "";
  const [text, setText] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setText(initial); }, [initial]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function apply(next: string) {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const q = next.trim();
    const sp = new URLSearchParams(params.toString());
    if (q) sp.set("q", q); else sp.delete("q");
    router.push(`${pathname}${sp.toString() ? `?${sp}` : ""}` as Route);
  }

  function onChange(next: string) {
    setText(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => apply(next), 300);
  }

  return (
    <label className="flex h-[36px] min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-border/60 bg-surface px-3 sm:max-w-[300px]">
      <Search size={13} strokeWidth={1.8} className="shrink-0 text-text-subtle" />
      <input
        type="search"
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") apply(text); }}
        placeholder="Search tasks or client name…"
        aria-label="Search tasks"
        className="min-w-0 flex-1 bg-transparent text-[12.5px] text-text outline-none placeholder:text-text-subtle"
      />
      {text && (
        <button
          type="button"
          onClick={() => { setText(""); apply(""); }}
          aria-label="Clear search"
          className="shrink-0 text-text-subtle transition-colors hover:text-text"
        >
          <X size={12} />
        </button>
      )}
    </label>
  );
}

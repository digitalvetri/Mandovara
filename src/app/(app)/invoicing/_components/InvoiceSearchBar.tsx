"use client";

// The single search input for the invoicing landing page. Keeps existing
// status/sort URL params intact so navigating in from a filter link
// still works after typing a query.
//
// Searches as you type (owner, 2026-08-29: "automatically the livesearch
// should happen"), debounced 300ms so a ten-character query is one
// round trip rather than ten. Enter still applies immediately for
// anyone who types it out of habit, and the pending timer is cleared on
// unmount so a navigation mid-type cannot push a stale query at the
// next page.

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { Route } from "next";
import { Search } from "lucide-react";
import { useState, useEffect, useRef } from "react";

export function InvoiceSearchBar() {
  const router      = useRouter();
  const pathname    = usePathname();
  const params      = useSearchParams();
  const initial = params.get("q") ?? "";
  const [text, setText] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep in step when the query changes from outside — a filter link,
  // or the back button.
  useEffect(() => { setText(initial); }, [initial]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function onChange(next: string): void {
    setText(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => apply(next), 300);
  }

  function apply(next: string): void {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    // Nothing to do if the URL already says this.
    if (next.trim() === initial) return;
    const q = next.trim();
    const sp = new URLSearchParams(params.toString());
    if (q.length > 0) sp.set("q", q); else sp.delete("q");
    sp.delete("page"); // any filter change resets pagination
    router.push(`${pathname}${sp.toString() ? `?${sp}` : ""}` as Route);
  }

  return (
    <div className="mb-3 flex items-center gap-2 rounded-full border border-rule bg-surface px-3.5 py-2 max-w-[380px]">
      <Search size={13} className="text-text-dim shrink-0" />
      <input
        type="search"
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") apply(text); }}
        placeholder="Search invoice no, project or client…"
        className="flex-1 bg-transparent text-[12.5px] text-text placeholder:text-text-dim outline-none"
        aria-label="Search invoices"
      />
    </div>
  );
}

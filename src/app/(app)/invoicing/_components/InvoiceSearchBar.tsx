"use client";

// Single search input for the invoicing landing page. Keeps existing
// status/sort URL params intact so navigating in from a filter link
// still works after typing a query. Debounced by hitting Enter — no
// keystroke-per-request thrash.

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { Route } from "next";
import { Search } from "lucide-react";
import { useState } from "react";

export function InvoiceSearchBar() {
  const router      = useRouter();
  const pathname    = usePathname();
  const params      = useSearchParams();
  const [text, setText] = useState(params.get("q") ?? "");

  function apply(next: string): void {
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
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") apply(text); }}
        onBlur={() => apply(text)}
        placeholder="Search invoice no, project or client…"
        className="flex-1 bg-transparent text-[12.5px] text-text placeholder:text-text-dim outline-none"
        aria-label="Search invoices"
      />
    </div>
  );
}

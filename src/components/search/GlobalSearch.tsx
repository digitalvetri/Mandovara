"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  Search, Loader2, ArrowRight,
  Users, Briefcase, FileText, Send, Receipt, UserPlus, Package, Truck,
} from "lucide-react";
import { searchAll, type SearchHit, type SearchKind } from "@/modules/search/actions";

const KIND_LABEL: Record<SearchKind, string> = {
  client:    "Clients",    project:   "Projects",  quotation: "Quotations",
  order:     "Orders",     invoice:   "Invoices",  lead:      "Leads",
  design:    "Products",   vendor:    "Vendors",
};

const KIND_ICON: Record<SearchKind, React.ElementType> = {
  client: Users, project: Briefcase, quotation: FileText,
  order:  Send,  invoice: Receipt,   lead:      UserPlus,
  design: Package, vendor: Truck,
};

const KIND_ORDER: readonly SearchKind[] = [
  "project", "client", "lead", "quotation", "order", "invoice", "design", "vendor",
];

const QUICK_ACTIONS = [
  { id: "new-lead",    label: "New Lead",    href: "/leads/new",    Icon: UserPlus  },
  { id: "new-client",  label: "New Client",  href: "/clients/new",  Icon: Users     },
  { id: "new-project", label: "New Project", href: "/projects/new", Icon: Briefcase },
];

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery]     = useState("");
  const [open, setOpen]       = useState(false);
  const [hits, setHits]       = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef     = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Ctrl+K / Cmd+K → focus the header search input
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Pointer outside → close dropdown
  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  // Debounced search — fires at ≥2 chars
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setHits([]); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(() => {
      searchAll(query)
        .then(setHits)
        .catch(() => setHits([]))
        .finally(() => setLoading(false));
    }, 180);
    return () => clearTimeout(t);
  }, [query]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href as Route);
  }

  const hasQuery     = query.trim().length >= 2;
  const hasResults   = hits.length > 0;
  const showDropdown = open && hasQuery;

  // Group hits by kind for display
  const grouped = new Map<SearchKind, SearchHit[]>();
  for (const h of hits) {
    const arr = grouped.get(h.kind as SearchKind) ?? [];
    arr.push(h);
    grouped.set(h.kind as SearchKind, arr);
  }

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0 max-w-[440px]">

      {/* ── Search bar ── */}
      <div className={[
        "flex items-center gap-2.5 h-[38px] px-3.5 rounded-[10px] border transition-all",
        // Sits on the dark chrome, so it derives from the sidebar tokens
        // rather than the surface tokens — see .on-chrome in globals.css.
        open
          ? "on-chrome on-chrome-text !border-accent"
          : "on-chrome",
      ].join(" ")}>
        {loading
          ? <Loader2 size={13.5} strokeWidth={1.8} className="shrink-0 text-accent animate-spin" />
          : <Search  size={13.5} strokeWidth={1.8} className="shrink-0 on-chrome-dim" />}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
          }}
          placeholder="Search projects, clients, designs…"
          className="flex-1 bg-transparent text-[12.5px] on-chrome-text placeholder:opacity-70 outline-none"
        />
        {!open && (
          <kbd className="hidden sm:inline-flex items-center text-[9.5px] px-1.5 py-[3px] rounded-[5px] border on-chrome shrink-0">
            Ctrl K
          </kbd>
        )}
      </div>

      {/* ── Dropdown ── */}
      {showDropdown && (
        <div className="absolute top-[calc(100%+6px)] left-0 right-0 z-50 rounded-[12px] bg-surface border border-rule shadow-2xl overflow-hidden">
          <div className="max-h-[60vh] overflow-y-auto">

            {/* No results */}
            {!loading && !hasResults && (
              <div className="py-8 text-center">
                <p className="text-[12.5px] text-text-dim">
                  Nothing matches &ldquo;{query.trim()}&rdquo;
                </p>
                <p className="text-[11.5px] text-text-faint mt-1">
                  Try a name, number, or mobile.
                </p>
              </div>
            )}

            {/* Grouped results */}
            {KIND_ORDER.map((k) => {
              const rows = grouped.get(k);
              if (!rows || rows.length === 0) return null;
              const Icon = KIND_ICON[k];
              return (
                <div key={k}>
                  <div className="px-3 pt-2.5 pb-1 text-[9.5px] uppercase tracking-[0.14em] text-text-faint">
                    {KIND_LABEL[k]}
                  </div>
                  {rows.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => go(h.href)}
                      className="flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-surface-hover transition-colors group"
                    >
                      <Icon size={13} strokeWidth={1.6} className="text-text-dim shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] text-text truncate">{h.title}</div>
                        {h.subtitle && (
                          <div className="text-[11.5px] text-text-dim truncate mt-0.5">{h.subtitle}</div>
                        )}
                      </div>
                      <ArrowRight size={11} className="text-text-faint opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </button>
                  ))}
                </div>
              );
            })}

            {/* Quick actions — shown below results, only while searching */}
            <div className={hasResults ? "border-t border-rule/50 mt-1" : ""}>
              <div className="px-3 pt-2.5 pb-1 text-[9.5px] uppercase tracking-[0.14em] text-text-faint">
                Quick actions
              </div>
              {QUICK_ACTIONS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go(a.href)}
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-surface-hover transition-colors"
                >
                  <a.Icon size={13} strokeWidth={1.6} className="text-text-dim shrink-0" />
                  <span className="text-[13px] text-text-dim">{a.label}</span>
                </button>
              ))}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

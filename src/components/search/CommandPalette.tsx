"use client";

// ⌘K command palette — global jump-to-anything.
//
// TRACK-B-CRAFT.md §6.3.1 and CLAUDE.md §6.3 point 1:
//   "⌘K command palette everywhere — jump to any project, client,
//    design code, quote or invoice; create anything."
//
// Behaviour:
//   - Cmd+K (Mac) / Ctrl+K (anywhere else) opens.
//   - Esc closes. Click outside closes.
//   - ArrowDown / ArrowUp move the highlight, Enter opens.
//   - Empty query shows "Quick actions" (deterministic list of
//     create endpoints); ≥2 chars fires searchAll.
//   - Debounced 180ms so a fast typer doesn't spam the server.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  Search, X,
  Users, Briefcase, FileText, Send, Receipt, UserPlus, Package, Truck, Plus,
} from "lucide-react";
import { searchAll, type SearchHit, type SearchKind } from "@/modules/search/actions";
import { Section, RowButton, groupByKind } from "./CommandPaletteItems";

// Quick actions shown when the query is empty.
interface QuickAction {
  kind:    "action";
  id:      string;
  title:   string;
  href:    string;
  Icon:    typeof Users;
}
const QUICK_ACTIONS: readonly QuickAction[] = [
  { kind: "action", id: "new-lead",    title: "New lead",              href: "/leads/new",             Icon: UserPlus  },
  { kind: "action", id: "new-client",  title: "New client",            href: "/clients/new",           Icon: Users     },
  { kind: "action", id: "new-project", title: "New project",           href: "/projects/new",          Icon: Briefcase },
  { kind: "action", id: "new-product", title: "New product",           href: "/products/new",          Icon: Package   },
  { kind: "action", id: "new-vendor",  title: "New vendor",            href: "/purchase/vendors/new",  Icon: Truck     },
  { kind: "action", id: "measure",     title: "Material Estimator",    href: "/measure",               Icon: Plus      },
];

const KIND_LABEL: Record<SearchKind, string> = {
  client: "Clients", project: "Projects", quotation: "Quotations",
  order: "Orders",   invoice: "Invoices", lead: "Leads",
  design: "Designs", vendor: "Vendors",
};

const KIND_ICON: Record<SearchKind, typeof Users> = {
  client: Users, project: Briefcase, quotation: FileText,
  order:  Send,  invoice: Receipt,   lead: UserPlus,
  design: Package, vendor: Truck,
};

// Order the sections show up in — most-jumped-to first.
const KIND_ORDER: readonly SearchKind[] = [
  "project", "client", "lead", "quotation", "order", "invoice", "design", "vendor",
];

type Row = QuickAction | (SearchHit & { kind: SearchKind });

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen]         = useState(false);
  const [query, setQuery]       = useState("");
  const [hits, setHits]         = useState<SearchHit[]>([]);
  const [loading, setLoading]   = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // ── Global keyboard listener ──────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isCmdK) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // ── Focus input on open + reset on close ──────────────────────
  useEffect(() => {
    if (open) {
      setHighlight(0);
      // Delay one tick so the input exists in the DOM.
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setQuery("");
      setHits([]);
    }
  }, [open]);

  // ── Debounced fetch ───────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (query.trim().length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      searchAll(query)
        .then((res) => {
          setHits(res);
          setHighlight(0);
        })
        .catch(() => setHits([]))
        .finally(() => setLoading(false));
    }, 180);
    return () => clearTimeout(t);
  }, [query, open]);

  // ── Flattened row list (respects section order) ───────────────
  const rows: Row[] = useMemo(() => {
    if (query.trim().length < 2) return [...QUICK_ACTIONS];
    const out: Row[] = [];
    for (const k of KIND_ORDER) {
      const inKind = hits.filter((h) => h.kind === k);
      for (const h of inKind) out.push(h);
    }
    return out;
  }, [hits, query]);

  const goto = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href as Route);
    },
    [router],
  );

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(rows.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[highlight];
      if (row) goto(row.href);
    }
  }

  if (!open) return null;

  // Group hits under section headers for display; keep the flat rows
  // list above as the source of truth for highlight + Enter.
  const grouped = groupByKind(hits);

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/70 backdrop-blur-sm flex items-start justify-center pt-[10vh] p-3"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-[640px] rounded-[14px] bg-surface border border-rule shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 border-b border-rule">
          <Search size={14} className="text-text-dim shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search projects, clients, quotes, invoices, products…"
            className="flex-1 h-[48px] bg-transparent text-[14px] text-text placeholder:text-text-faint outline-none"
          />
          {loading && <div className="text-[10.5px] text-text-dim tabular animate-pulse">Searching…</div>}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-[28px] w-[28px] grid place-items-center rounded-[6px] text-text-dim hover:text-text hover:bg-surface-hover"
            aria-label="Close"
          >
            <X size={13} />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto">
          {query.trim().length < 2 ? (
            <Section title="Quick actions">
              {QUICK_ACTIONS.map((a, i) => (
                <RowButton
                  key={a.id}
                  active={i === highlight}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => goto(a.href)}
                  Icon={a.Icon}
                  title={a.title}
                />
              ))}
            </Section>
          ) : hits.length === 0 && !loading ? (
            <div className="py-12 text-center text-[12.5px] text-text-dim">
              Nothing matches <span className="text-text">&ldquo;{query}&rdquo;</span>.
              <div className="mt-1 text-[11.5px] text-text-faint">Try a name, number, HSN or mobile.</div>
            </div>
          ) : (
            <>
              {KIND_ORDER.map((k) => {
                const rowsInKind = grouped.get(k);
                if (!rowsInKind || rowsInKind.length === 0) return null;
                return (
                  <Section key={k} title={KIND_LABEL[k]}>
                    {rowsInKind.map((h) => {
                      const absIndex = rows.findIndex((r) => r.kind === h.kind && r.id === h.id);
                      const Icon = KIND_ICON[h.kind];
                      return (
                        <RowButton
                          key={`${h.kind}:${h.id}`}
                          active={absIndex === highlight}
                          onMouseEnter={() => setHighlight(absIndex)}
                          onClick={() => goto(h.href)}
                          Icon={Icon}
                          title={h.title}
                          subtitle={h.subtitle}
                        />
                      );
                    })}
                  </Section>
                );
              })}
            </>
          )}
        </div>

        {/* Footer legend */}
        <div className="px-4 py-2 border-t border-rule flex items-center justify-between text-[10.5px] text-text-faint">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1 tabular">↑</kbd> <kbd className="px-1 tabular">↓</kbd> navigate</span>
            <span><kbd className="px-1 tabular">↵</kbd> open</span>
            <span><kbd className="px-1 tabular">esc</kbd> close</span>
          </div>
          <div>{rows.length} result{rows.length !== 1 ? "s" : ""}</div>
        </div>
      </div>
    </div>
  );
}


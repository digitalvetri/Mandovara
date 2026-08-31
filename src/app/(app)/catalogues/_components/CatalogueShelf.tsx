"use client";

// The shelf: every catalogue, whether it is here, and who has it.
//
// The owner's brief was "like library book management … what catalogues are
// with me, and if I give one out I need to mention here". So the page is
// built around that one question. Search and the four filters are the whole
// interface; issuing is one tap from any row, and returning is one tap from
// the row that is out.
//
// Filtering happens in the browser, deliberately. 694 rows is nothing to
// hold in memory, and a studio owner standing at a shelf typing a name
// should not wait for a round trip per keystroke.

import { useMemo, useState, useTransition } from "react";
import { Search, BookOpen, ArrowUpRight, Check, Loader2, AlertTriangle } from "lucide-react";
import { returnCatalogue } from "@/modules/catalog/lending-actions";
import type { CatalogueShelfRow, ShelfCounts } from "@/modules/catalog/lending-queries";
import { FAMILY_LABEL } from "@/modules/catalog/catalogues-queries";
import { IssueDialog } from "./IssueCatalogueDialog";

type Filter = "ALL" | "WITH_ME" | "OUT" | "OVERDUE";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "ALL",     label: "All" },
  { key: "WITH_ME", label: "With me" },
  { key: "OUT",     label: "Given out" },
  { key: "OVERDUE", label: "Overdue" },
];

export function CatalogueShelf({
  rows, counts, canLend,
}: { rows: CatalogueShelfRow[]; counts: ShelfCounts; canLend: boolean }) {
  const [q, setQ]           = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [issuing, setIssuing] = useState<CatalogueShelfRow | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [pending, start]    = useTransition();

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "WITH_ME" && r.loan) return false;
      if (filter === "OUT"     && !r.loan) return false;
      if (filter === "OVERDUE" && r.loan?.daysOverdue == null) return false;
      if (!needle) return true;
      return (
        r.name.toLowerCase().includes(needle) ||
        (r.loan?.holderName.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [rows, q, filter]);

  function handleReturn(row: CatalogueShelfRow) {
    setError(null);
    start(async () => {
      const r = await returnCatalogue(row.id);
      if (!r.ok) setError(r.error ?? "Could not mark it returned.");
    });
  }

  return (
    <div className="space-y-4 pb-10">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Tile label="On the shelf" value={counts.withMe} tone="text-good" />
        <Tile label="Given out"    value={counts.out}     tone="text-info" />
        <Tile label="Overdue"      value={counts.overdue} tone={counts.overdue > 0 ? "text-fault" : "text-text-dim"} />
        <Tile label="Total"        value={counts.total}   tone="text-text" />
      </div>

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a catalogue, or the person who has it…"
            aria-label="Search catalogues"
            className="h-10 w-full rounded-[9px] border border-rule bg-surface pl-9 pr-3 text-[13px] text-text outline-none transition-colors focus:border-accent"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`h-10 rounded-[9px] border px-3.5 text-[12.5px] transition-colors ${
                filter === f.key
                  ? "border-gold bg-gold/12 font-semibold text-gold"
                  : "border-rule text-text-dim hover:text-text"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-[9px] border border-fault/30 bg-fault/5 px-3.5 py-2.5 text-[12px] text-fault">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-[14px] border border-rule bg-surface py-16 text-center">
          <BookOpen size={26} className="mx-auto mb-3 text-text-dim/40" strokeWidth={1.4} />
          <div className="text-[13px] text-text-dim">
            {q.trim() ? `Nothing matching “${q.trim()}”.` : "Nothing in this view."}
          </div>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-[14px] border border-rule bg-surface">
          {visible.map((r, i) => (
            <li
              key={r.id}
              className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5 ${
                i > 0 ? "border-t border-rule/60" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] text-text">{r.name}</div>
                <div className="mt-0.5 text-[11px] text-text-dim">
                  {FAMILY_LABEL[r.family]}
                  {r.loan && (
                    <>
                      <span className="mx-1.5 opacity-40">·</span>
                      <span className={r.loan.daysOverdue !== null ? "text-fault" : ""}>
                        With {r.loan.holderName} since {fmt(r.loan.issuedAt)}
                        {r.loan.dueAt && ` · due ${fmt(r.loan.dueAt)}`}
                        {r.loan.daysOverdue !== null && ` · ${r.loan.daysOverdue}d late`}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <StatusPill loan={r.loan} />

              {canLend && (
                r.loan ? (
                  <button
                    type="button"
                    onClick={() => handleReturn(r)}
                    disabled={pending}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[7px] bg-accent px-3 text-[12px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
                  >
                    {pending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} strokeWidth={2.4} />}
                    Got it back
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setError(null); setIssuing(r); }}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[7px] border border-rule px-3 text-[12px] font-medium text-text-dim transition-colors hover:border-gold hover:text-text"
                  >
                    <ArrowUpRight size={12} strokeWidth={2.2} />
                    Give out
                  </button>
                )
              )}
            </li>
          ))}
        </ul>
      )}

      {issuing && (
        <IssueDialog
          row={issuing}
          onClose={() => setIssuing(null)}
          onError={setError}
        />
      )}
    </div>
  );
}

function StatusPill({ loan }: { loan: CatalogueShelfRow["loan"] }) {
  if (!loan) {
    return <Pill tone="bg-good/12 text-good">With me</Pill>;
  }
  if (loan.daysOverdue !== null) {
    return <Pill tone="bg-fault/12 text-fault">Overdue</Pill>;
  }
  return <Pill tone="bg-info/12 text-info">Given out</Pill>;
}

function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span className={`shrink-0 rounded-[5px] px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.06em] ${tone}`}>
      {children}
    </span>
  );
}

function Tile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-[12px] border border-rule bg-surface px-4 py-3">
      <div className="text-[10.5px] uppercase tracking-[0.12em] text-text-dim">{label}</div>
      <div className={`mt-1 font-display text-[22px] font-semibold tabular-nums leading-none ${tone}`}>{value}</div>
    </div>
  );
}

function fmt(d: Date): string {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

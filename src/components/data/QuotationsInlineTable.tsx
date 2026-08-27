// Small inline table of quotations, reused by /clients/[id] and
// /leads/[id]. Row click routes to /quotations/[id]. Renders an
// empty-state card if there are no rows so the section still looks
// intentional on a fresh install.

import Link from "next/link";
import type { Route } from "next";
import { FileText, Plus } from "lucide-react";
import { formatINR } from "@/kernel/money/format";
import type { QuotationInlineRow } from "@/modules/quotations/queries";

interface QuotationsInlineTableProps {
  rows:  QuotationInlineRow[];
  /** Route for the "New quotation" affordance. When the list is empty
   *  we show a large centered button; otherwise a small chip in the
   *  header. Only one button on the page at a time. */
  newHref?: Route;
  emptyHint?: string;
  /**
   * @deprecated "See all" was removed — the quotations module's own
   * landing page is the canonical list.
   */
  seeAllHref?: Route;
}

export function QuotationsInlineTable({ rows, newHref, emptyHint }: QuotationsInlineTableProps) {
  const hasRows = rows.length > 0;
  return (
    <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
      <div className="flex items-center justify-between px-6 pt-5 pb-3">
        <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-text">
          Quotations
        </div>
        {/* Header chip only when there ARE rows — empty state gets the
             big centered button instead so users don't see two buttons
             at once. */}
        {newHref && hasRows && (
          <Link
            href={newHref}
            className="inline-flex items-center gap-1.5 rounded-full border border-rule px-3.5 py-1.5 text-[11.5px] font-medium text-text-dim hover:border-gold hover:text-gold transition-colors"
          >
            <Plus size={11} strokeWidth={2.2} />
            New quotation
          </Link>
        )}
      </div>

      {!hasRows ? (
        <div className="px-6 pt-4 pb-8 text-center">
          <FileText size={20} className="mx-auto mb-2.5 text-text-faint" />
          <div className="mb-4 text-[13px] text-text-dim">
            {emptyHint ?? "No quotations yet."}
          </div>
          {newHref && (
            <Link
              href={newHref}
              className="inline-flex items-center gap-2 rounded-[10px] bg-gold px-5 py-2.5 text-[13px] font-semibold text-ink hover:bg-gold-strong transition-colors"
            >
              <Plus size={13} strokeWidth={2.4} />
              New quotation
            </Link>
          )}
        </div>
      ) : (
        // Its own scroller: this table is embedded in narrow cards on the
        // client and project pages, where it would otherwise push the
        // whole page sideways on a phone.
        <div className="overflow-x-auto">
        <table className="min-w-[630px] w-full text-[12.5px]">
          <thead className="text-[10.5px] uppercase tracking-[0.06em] text-text-dim">
            <tr>
              <th className="px-6 py-2 text-left font-medium">Number</th>
              <th className="px-3 py-2 text-left font-medium">Project</th>
              <th className="px-3 py-2 text-left font-medium">Date</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium">Lines</th>
              <th className="px-6 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-rule hover:bg-surface-hover">
                <td className="px-6 py-2.5">
                  <Link
                    href={`/quotations/${r.id}` as Route}
                    className="tabular font-medium text-text hover:text-gold"
                  >
                    {shortNumber(r.number)}
                    {r.revision > 0 && (
                      <span className="ml-1 text-[10.5px] text-text-dim">v{r.revision}</span>
                    )}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-text-dim truncate max-w-[220px]">{r.projectName ?? "—"}</td>
                <td className="px-3 py-2.5 tabular text-text-dim">{formatDate(r.date)}</td>
                <td className="px-3 py-2.5"><QuoteStatusPill status={r.status} /></td>
                <td className="px-3 py-2.5 text-right tabular text-text-dim">{r.lineCount}</td>
                <td className="px-6 py-2.5 text-right tabular text-text font-medium">
                  {formatINR(r.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  DRAFT:     "bg-text-dim/12 text-text-dim",
  SENT:      "bg-info/15 text-info",
  VIEWED:    "bg-info/15 text-info",
  ACCEPTED:  "bg-good/12 text-good",
  REJECTED:  "bg-bad/12 text-bad",
  EXPIRED:   "bg-bad/12 text-bad",
  CONVERTED: "bg-good/12 text-good",
  APPROVED:  "bg-good/12 text-good",
  PENDING_APPROVAL: "bg-warn/15 text-warn",
  REVISED:   "bg-warn/15 text-warn",
};

function QuoteStatusPill({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? "bg-text-dim/12 text-text-dim";
  const label = status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
  return (
    <span className={`inline-block text-[10.5px] font-medium tracking-[0.05em] uppercase px-2 py-0.5 rounded-[3px] ${tone}`}>
      {label}
    </span>
  );
}

function shortNumber(n: string): string {
  const parts = n.split("/");
  return parts.length >= 2 ? parts.slice(-1)[0] ?? n : n;
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit", month: "short", year: "2-digit", timeZone: "Asia/Kolkata",
  }).format(d);
}

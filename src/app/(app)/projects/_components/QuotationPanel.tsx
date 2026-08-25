// Quotation panel — the main-column quotation surface on /projects/[id].
// Lists project quotations, offers a project-scoped "Create Quotation"
// button (Fix 2.A — was previously a text link to a filtered list), and
// links out to the latest Order when one exists (Fix 2.D).

import Link from "next/link";
import type { Route } from "next";
import { FileText, ArrowRight, Plus, ShoppingCart } from "lucide-react";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import type { ProjectQuotationsPanelData, ProjectQuotationRow } from "@/modules/projects/queries";
import { SkipQuoteButton } from "./SkipQuoteButton";

interface Props {
  projectId:   string;
  data:        ProjectQuotationsPanelData;
  canCreate:   boolean;
  stage:       string;   // Batch B: needed to decide when "Skip firm quote" is offered.
}

export function QuotationPanel({ projectId, data, canCreate, stage }: Props) {
  const { quotations, latestOrder } = data;
  const hasQuotes = quotations.length > 0;
  // "Skip firm quote" is only meaningful before the project has
  // progressed to Advance Awaited (ORDERED) — after that the flow is
  // already past the quote decision. Also require canCreate since it's
  // effectively a project.update action.
  const canSkip = canCreate
    && !latestOrder
    && ["ENQUIRY", "SITE_VISIT", "MEASUREMENT", "QUOTATION"].includes(stage);

  return (
    <section className="rounded-[14px] border border-rule bg-surface p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
          Quotations
        </div>
        {canCreate && (
          <Link
            href={`/quotations/new?project=${projectId}` as Route}
            className="inline-flex items-center gap-1.5 rounded-[8px] bg-accent px-3 py-1.5 text-[11.5px] font-semibold text-white transition-colors hover:bg-accent/90"
          >
            <Plus size={11} strokeWidth={2.6} />
            Send Firm Quotation
          </Link>
        )}
      </div>

      {/* Accepted-quote indicator. Batch A (25 Aug 2026): reads
          "advance awaited" until the deposit lands. Batch B will
          flip this to "installation in progress" once advance is
          received. Order is an internal record the owner doesn't see. */}
      {latestOrder && (
        <div className="mb-4 flex items-center gap-2 rounded-[10px] border border-solid/25 bg-solid/5 px-3.5 py-2.5 text-[12px]">
          <ShoppingCart size={13} className="text-solid" />
          <span className="font-medium text-text">Quote accepted — advance awaited</span>
        </div>
      )}

      {hasQuotes ? (
        <ul className="space-y-1.5">
          {quotations.slice(0, 6).map((q) => (
            <li key={q.id}><QuotationRow q={q} /></li>
          ))}
        </ul>
      ) : (
        <div className="rounded-[10px] border border-dashed border-rule px-4 py-6 text-center text-[11.5px] text-text-dim">
          {canCreate
            ? <>No quotations yet. Use <span className="text-text">Send Firm Quotation</span> above once measurements are in.</>
            : <>No quotations yet.</>
          }
          {canSkip && (
            <div className="mt-2 flex justify-center">
              <SkipQuoteButton projectId={projectId} />
            </div>
          )}
        </div>
      )}

      {quotations.length > 6 && (
        <div className="mt-3 text-right">
          <Link
            href={`/quotations?project=${projectId}` as Route}
            className="text-[11px] text-text-dim hover:text-text"
          >
            View all {quotations.length} quotations →
          </Link>
        </div>
      )}
    </section>
  );
}

function QuotationRow({ q }: { q: ProjectQuotationRow }) {
  const tone: Record<string, string> = {
    DRAFT:            "text-text-dim",
    PENDING_APPROVAL: "text-info",
    APPROVED:         "text-info",
    SENT:             "text-heat",
    VIEWED:           "text-heat",
    ACCEPTED:         "text-solid",
    REJECTED:         "text-fault",
    REVISED:          "text-text-dim",
    EXPIRED:          "text-fault",
  };
  const label: Record<string, string> = {
    DRAFT:            "Draft",
    PENDING_APPROVAL: "Pending",
    APPROVED:         "Approved",
    SENT:             "Sent",
    VIEWED:           "Viewed",
    ACCEPTED:         "Accepted",
    REJECTED:         "Rejected",
    REVISED:          "Revised",
    EXPIRED:          "Expired",
  };
  const cls = tone[q.status] ?? "text-text-dim";

  return (
    <Link
      href={`/quotations/${q.id}` as Route}
      className="group grid grid-cols-[110px_1fr_120px_100px_16px] items-center gap-3 rounded-[8px] px-3 py-2 text-[12px] hover:bg-surface-2/40"
    >
      <span className="tabular-nums text-text">
        <FileText size={11} className="mr-1.5 inline text-text-dim" />
        {shortNumber(q.number)}
        {q.revision > 0 && <span className="ml-1 text-[10px] text-text-dim">r{q.revision}</span>}
      </span>
      <span className="tabular-nums text-text-dim">{formatDate(q.date)}</span>
      <span className="text-right tabular-nums text-text">{formatINR(q.total)}</span>
      <span className={`text-right text-[10.5px] uppercase tracking-[0.1em] ${cls}`}>
        {label[q.status] ?? q.status}
      </span>
      <ArrowRight size={12} className="opacity-0 text-text-dim group-hover:opacity-100" />
    </Link>
  );
}

function shortNumber(n: string): string {
  const parts = n.split("/");
  return parts[parts.length - 1] ?? n;
}

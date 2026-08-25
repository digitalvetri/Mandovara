import Link from "next/link";
import type { Route } from "next";
import { FileText, Plus } from "lucide-react";
import { formatINR } from "@/kernel/money/format";
import type { QuotationInlineRow } from "@/modules/quotations/queries";

const QT_STATUS_TONE: Record<string, string> = {
  DRAFT:            "bg-text-dim/12 text-text-dim",
  SENT:             "bg-info/15 text-info",
  ACCEPTED:         "bg-solid/12 text-solid",
  REJECTED:         "bg-fault/12 text-fault",
  EXPIRED:          "bg-fault/12 text-fault",
  REVISED:          "bg-heat/15 text-heat",
  PENDING_APPROVAL: "bg-heat/15 text-heat",
};

function QuoteSidebarPill({ status }: { status: string }) {
  const tone = QT_STATUS_TONE[status] ?? "bg-text-dim/12 text-text-dim";
  const label = status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
  return (
    <span className={`shrink-0 inline-block text-[10px] font-medium uppercase tracking-[0.05em] px-2 py-0.5 rounded-[3px] ${tone}`}>
      {label}
    </span>
  );
}

function shortQtNumber(n: string): string {
  const parts = n.split("/");
  return parts.length >= 2 ? (parts.slice(-1)[0] ?? n) : n;
}

export function LeadQuotationsSidebar({
  quotations,
  leadId,
  isConverted,
}: {
  quotations: QuotationInlineRow[];
  leadId: string;
  isConverted: boolean;
}) {
  return (
    <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-rule">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
          Quotations
          {quotations.length > 0 && (
            <span className="ml-1.5 tabular text-[10px] text-text-faint">({quotations.length})</span>
          )}
        </div>
        {!isConverted && (
          // Same builder as the "Send Rough Estimate" button in the top
          // action bar — was pointing at /quotations/new which is a
          // different form. Owner reported the mismatch 25 Aug 2026.
          <Link
            href={`/quotations/quick?leadId=${leadId}` as Route}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
          >
            <Plus size={11} strokeWidth={2.2} />
            New estimate
          </Link>
        )}
      </div>

      {quotations.length === 0 ? (
        <div className="px-5 py-6 text-center">
          <FileText size={18} className="mx-auto mb-2 text-text-faint" />
          <div className="text-[12px] text-text-dim mb-3">No quotations yet.</div>
          {!isConverted && (
            <Link
              href={`/quotations/quick?leadId=${leadId}` as Route}
              className="inline-flex items-center gap-1.5 rounded-[8px] bg-accent px-4 py-1.5 text-[12px] font-medium text-white hover:opacity-90 transition-opacity"
            >
              <Plus size={11} strokeWidth={2.2} />
              Send rough estimate
            </Link>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-rule">
          {quotations.map((q) => (
            <li key={q.id}>
              <Link
                href={`/quotations/${q.id}` as Route}
                className="flex items-center justify-between gap-2 px-5 py-3 hover:bg-surface-2/60 transition-colors"
              >
                <div className="min-w-0">
                  <div className="tabular text-[12.5px] font-medium text-accent">
                    {shortQtNumber(q.number)}
                    {q.revision > 0 && (
                      <span className="ml-1 text-[10px] text-text-faint">v{q.revision}</span>
                    )}
                  </div>
                  <div className="tabular text-[11px] text-text-dim mt-0.5">
                    {formatINR(q.total)}
                  </div>
                </div>
                <QuoteSidebarPill status={q.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

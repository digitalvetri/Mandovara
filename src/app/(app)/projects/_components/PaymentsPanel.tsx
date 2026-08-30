"use client";

// Payments panel — the main-column money surface. Shows invoiced /
// received / outstanding at a glance, flags overdue, lists each invoice
// with its own paid vs outstanding, and offers a "Create invoice" button
// wired to createInvoiceFromOrder (invoices in this business always mint
// from an Order — see /orders/_components/CreateInvoiceButton).
//
// Loader-gated: parent passes null when the user lacks money permissions
// and this component renders nothing at all (Rule 8 — cost / margin
// stripped server-side, never CSS-hidden).

import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import { Receipt, ArrowRight, AlertCircle } from "lucide-react";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import type { ProjectPayments, ProjectPaymentInvoice } from "@/modules/projects/queries";

interface Props {
  payments: ProjectPayments;
  /** Accepted so the caller needs no change; unread since the panel's
   *  own Create invoice button was removed on 2026-08-30. */
  canCreate?: boolean;
}

export function PaymentsPanel({ payments }: Props) {
  // The invoice-creating state that lived here went with the button on
  // 2026-08-30 — see the note further down. createInvoiceFromOrder is
  // untouched and still drives the one-click path on the order page.
  const [error] = useState<string | null>(null);

  const hasInvoices = payments.invoices.length > 0;

  return (
    <section className="rounded-[14px] border border-rule bg-surface p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
          Payments
        </div>
        {/* A third "Create invoice" lived here, gated on there being a
            confirmed order. Removed 2026-08-30: the section header and
            the Quick actions strip both carry one, and three buttons for
            one job — two of them usually hidden — is the confusion the
            owner reported. */}
      </div>

      {/* ── Summary tiles ────────────────────────────────────── */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <SummaryTile
          label="Invoiced"
          value={payments.invoiced}
        />
        <SummaryTile
          label="Received"
          value={payments.received}
          tone="solid"
        />
        <SummaryTile
          label="Outstanding"
          value={payments.outstanding}
          tone={payments.outstanding > 0n ? "fault" : "muted"}
        />
      </div>

      {payments.overdue > 0n && (
        <div className="mb-4 flex items-start gap-2 rounded-[10px] border border-fault/40 bg-fault/5 px-3 py-2 text-[11.5px] leading-relaxed text-fault">
          <AlertCircle size={13} className="mt-[2px] shrink-0" />
          <span>
            {formatINR(payments.overdue)} overdue across {" "}
            {payments.invoices.filter((i) => i.isOverdue).length} invoice(s).
          </span>
        </div>
      )}

      {payments.nextDue && payments.overdue === 0n && (
        <div className="mb-4 flex items-baseline justify-between gap-3 rounded-[10px] border border-rule bg-surface-2 px-3 py-2 text-[11.5px]">
          <span className="text-text-dim">Next due</span>
          <span className="text-text tabular-nums">
            {formatINR(payments.nextDue.outstanding)}
            <span className="mx-2 text-text-subtle">·</span>
            {formatDate(payments.nextDue.dueDate)}
          </span>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-[8px] border border-fault/40 bg-fault/5 px-3 py-2 text-[11.5px] text-fault">
          {error}
        </div>
      )}

      {/* ── Invoices ─────────────────────────────────────────── */}
      {hasInvoices ? (
        <ul className="space-y-1.5">
          {payments.invoices.slice(0, 6).map((inv) => (
            <li key={inv.id}>
              <InvoiceRow inv={inv} />
            </li>
          ))}
        </ul>
      ) : (
        // Both branches used to hinge on hasOrder, and the order-less one
        // said invoices "become available once an order is confirmed".
        // That stopped being true on 2026-08-30 — Create invoice above
        // opens the builder whether or not an order exists — and a panel
        // telling an owner they cannot do the thing the button beside it
        // does is worse than saying nothing.
        <div className="rounded-[10px] border border-dashed border-rule px-4 py-6 text-center text-[11.5px] text-text-dim">
          No invoices yet. Use <span className="text-text">Create invoice</span> above to bill this project.
        </div>
      )}

      {payments.invoices.length > 6 && (
        <div className="mt-3 text-right">
          <Link
            href={"/invoicing" as Route}
            className="text-[11px] text-text-dim hover:text-text"
          >
            View all {payments.invoices.length} invoices →
          </Link>
        </div>
      )}
    </section>
  );
}

function SummaryTile({
  label, value, tone = "default",
}: {
  label: string;
  value: bigint;
  tone?: "default" | "solid" | "fault" | "muted";
}) {
  const cls =
    tone === "solid" ? "text-solid" :
    tone === "fault" ? "text-fault" :
    tone === "muted" ? "text-text-dim" :
                       "text-text";
  return (
    <div className="rounded-[10px] border border-rule bg-surface-2/40 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.14em] text-text-dim">{label}</div>
      <div className={`mt-1 font-display text-[17px] font-semibold tabular-nums ${cls}`}>
        {formatINR(value)}
      </div>
    </div>
  );
}

function InvoiceRow({ inv }: { inv: ProjectPaymentInvoice }) {
  const statusMap: Record<string, string> = {
    DRAFT:            "text-text-dim",
    ISSUED:           "text-info",
    PARTIALLY_PAID:   "text-heat",
    PAID:             "text-solid",
  };
  const statusLabel: Record<string, string> = {
    DRAFT:            "Draft",
    ISSUED:           "Issued",
    PARTIALLY_PAID:   "Part-paid",
    PAID:             "Paid",
  };
  const tone = statusMap[inv.status] ?? "text-text-dim";
  return (
    <Link
      href={`/invoicing/${inv.id}` as Route}
      className="group grid grid-cols-[110px_1fr_120px_100px_16px] items-center gap-3 rounded-[8px] px-3 py-2 text-[12px] hover:bg-surface-2/40"
    >
      <span className="tabular-nums text-text">
        <Receipt size={11} className="mr-1.5 inline text-text-dim" />
        {shortNumber(inv.number)}
      </span>
      <span className="tabular-nums text-text-dim">{formatDate(inv.date)}</span>
      <span className="text-right tabular-nums text-text">
        {formatINR(inv.total)}
      </span>
      <span className={`text-right text-[10.5px] uppercase tracking-[0.1em] ${inv.isOverdue ? "text-fault" : tone}`}>
        {inv.isOverdue ? "Overdue" : (statusLabel[inv.status] ?? inv.status)}
      </span>
      <ArrowRight size={12} className="opacity-0 text-text-dim group-hover:opacity-100" />
    </Link>
  );
}

function shortNumber(n: string): string {
  const parts = n.split("/");
  return parts[parts.length - 1] ?? n;
}

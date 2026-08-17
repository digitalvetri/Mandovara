"use client";

// Chase list — the load-bearing element of /accounts. Renders the top
// N clients to call today, with row actions per docs/ACCOUNTS-PAGE.md §6.
//
// WhatsApp uses a wa.me deep-link with a pre-composed reminder in the
// URL — that works today without a Meta template, and matches how
// small business owners actually message. The click also fires the
// logChaseContact server action so the row drops off the chase list.

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { formatINR } from "@/kernel/money/format";
import { MessageCircle, IndianRupee, Clock, Loader2 } from "lucide-react";
import { logChaseContact } from "@/modules/accounts/chase-actions";
import { PromiseButton } from "./PromiseButton";

export interface ChaseRowUI {
  clientId:              string;
  clientName:            string;
  clientMobile:          string;
  outstanding:           string;      // BigInt paise, stringified for the RSC boundary
  oldestLateDays:        number;
  lastContactedDaysAgo:  number | null;
  activePromiseDate:     string | null;   // ISO date if any
}

interface Props {
  rows:  ReadonlyArray<ChaseRowUI>;
  /** Total number of chaseable clients (so "View all N" is honest). */
  totalCount: number;
  /** Business/showroom name — used in the WhatsApp reminder text. */
  orgName: string;
}

export function ChaseList({ rows, totalCount, orgName }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule px-5 py-8 text-center">
        <div className="text-[13px] text-text mb-1">Nobody to chase today.</div>
        <div className="text-[11.5px] text-text-dim">
          Every open bill is either recent or already promised — nice work.
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-[14px] bg-surface border border-rule overflow-hidden">
      <div className="flex items-baseline justify-between gap-3 px-5 py-3.5 border-b border-rule">
        <div className="flex items-baseline gap-2">
          <span className="text-gold text-[15px] leading-none">⚡</span>
          <h2 className="text-[13.5px] font-medium text-text">Chase these today</h2>
        </div>
        {totalCount > rows.length && (
          <Link
            href={"/accounts?tab=to-collect" as Route}
            className="text-[11.5px] text-accent hover:underline"
          >
            View all {totalCount} →
          </Link>
        )}
      </div>
      <ul className="divide-y divide-rule/60">
        {rows.map((r) => (
          <ChaseRow key={r.clientId} row={r} orgName={orgName} />
        ))}
      </ul>
    </section>
  );
}

// ── One row ───────────────────────────────────────────────────────

function ChaseRow({ row, orgName }: { row: ChaseRowUI; orgName: string }) {
  const [, start] = useTransition();
  const [contactedJustNow, setContactedJustNow] = useState(false);

  const promisedLabel =
    row.activePromiseDate
      ? `⏰ Promised ${formatDayMonth(row.activePromiseDate)}`
      : null;

  const contactLabel =
    contactedJustNow                       ? "Just now" :
    row.lastContactedDaysAgo == null       ? "Never spoken" :
    row.lastContactedDaysAgo === 0         ? "Spoke today" :
    row.lastContactedDaysAgo === 1         ? "Spoke yesterday" :
                                             `Last spoke ${row.lastContactedDaysAgo} days ago`;

  function onWhatsAppClick() {
    // Optimistic: mark "just now" so the UI stops nudging even before the
    // server round-trip. logChaseContact bumps Client.lastContactedAt so
    // the next Overview render drops the row (contact-penalty → 0.3).
    setContactedJustNow(true);
    start(async () => {
      await logChaseContact({ clientId: row.clientId, channel: "WHATSAPP" });
    });
  }

  const outstandingBigInt = BigInt(row.outstanding);
  const waHref = buildWhatsAppLink(row.clientMobile, waMessage(row, orgName, outstandingBigInt));

  return (
    <li className="px-5 py-4">
      {/* Row 1 — name + amount */}
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <div className="text-[13.5px] text-text truncate min-w-0">{row.clientName}</div>
        <div className="tabular-nums text-[14.5px] text-text font-medium whitespace-nowrap">
          {formatINR(outstandingBigInt)}
        </div>
      </div>
      {/* Row 2 — days-late + last-contact / promise */}
      <div className="flex items-baseline justify-between gap-3 text-[11.5px] text-text-dim mb-3">
        <div className="tabular-nums">
          {row.oldestLateDays > 0
            ? <span className={row.oldestLateDays > 60 ? "text-bad" : "text-warn"}>{row.oldestLateDays} days late</span>
            : "Due today"}
          <span className="mx-1.5 opacity-40">·</span>
          {contactLabel}
        </div>
        {promisedLabel && (
          <span className="text-warn tabular-nums whitespace-nowrap">{promisedLabel}</span>
        )}
      </div>
      {/* Row 3 — actions */}
      <div className="grid grid-cols-3 gap-2">
        <a
          href={waHref}
          target="_blank"
          rel="noreferrer"
          onClick={onWhatsAppClick}
          className="inline-flex items-center justify-center gap-1.5 h-11 rounded-[10px] bg-solid/10 border border-solid/30 text-solid text-[12.5px] font-medium hover:bg-solid/15 transition-colors"
        >
          <MessageCircle size={14} strokeWidth={2} />
          WhatsApp
        </a>
        <Link
          href={`/accounts/new?clientId=${row.clientId}` as Route}
          className="inline-flex items-center justify-center gap-1.5 h-11 rounded-[10px] bg-gold text-ink text-[12.5px] font-semibold hover:bg-gold-strong transition-colors"
        >
          <IndianRupee size={13} strokeWidth={2.4} />
          Got paid
        </Link>
        <PromiseButton clientId={row.clientId} clientName={row.clientName}>
          <span className="inline-flex items-center justify-center gap-1.5 h-11 w-full rounded-[10px] border border-rule text-text-dim text-[12.5px] font-medium hover:text-text hover:border-text-dim transition-colors">
            <Clock size={13} strokeWidth={2} />
            Promised
          </span>
        </PromiseButton>
      </div>
      {contactedJustNow && (
        <div className="mt-2 flex items-center gap-1.5 text-[10.5px] text-text-dim">
          <Loader2 size={11} className="animate-spin" />
          Marking as contacted…
        </div>
      )}
    </li>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

function formatDayMonth(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

function buildWhatsAppLink(mobile: string, text: string): string {
  // Strip non-digits, ensure country code — Indian mobiles get 91 prefixed.
  const digits = mobile.replace(/\D/g, "");
  const withCountry = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(text)}`;
}

function waMessage(row: ChaseRowUI, orgName: string, outstanding: bigint): string {
  const first = row.clientName.split(" ")[0] ?? "Sir";
  const amt   = formatINR(outstanding);
  const late  = row.oldestLateDays > 0 ? ` (${row.oldestLateDays} days past due)` : "";
  return `Namaste ${first}, this is ${orgName}. A gentle reminder that ${amt} is pending on your account${late}. Kindly let us know when we can expect the payment. Thank you.`;
}

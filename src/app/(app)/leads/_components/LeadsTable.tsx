"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Phone, MessageCircle, ArrowUpRight } from "lucide-react";
import type { LeadRow } from "@/modules/leads/queries";
import { SOURCE_LABEL } from "@/modules/leads/schema";
import { StatusPill } from "./StatusPill";

// ── constants ────────────────────────────────────────────────────

const PRIORITY: Record<string, { cls: string; label: string }> = {
  HOT:  { cls: "bg-fault/12 text-fault border border-fault/25",  label: "Hot"  },
  WARM: { cls: "bg-warn/12 text-warn border border-warn/25",     label: "Warm" },
  COLD: { cls: "bg-surface-2 text-text-dim border border-rule",  label: "Cold" },
};

const SOURCE_DOT: Record<string, string> = {
  INSTAGRAM:          "bg-[#C13584]",
  FACEBOOK:           "bg-[#1877F2]",
  WHATSAPP:           "bg-[#25D366]",
  WEBSITE:            "bg-info",
  GOOGLE:             "bg-[#EA4335]",
  ARCHITECT_REFERRAL: "bg-gold",
  CLIENT_REFERRAL:    "bg-gold",
  WALK_IN:            "bg-text-dim",
  PHONE:              "bg-text-dim",
  EXHIBITION:         "bg-accent",
  ADVERTISEMENT:      "bg-heat",
  OTHER:              "bg-text-dim",
};

// ── helpers ──────────────────────────────────────────────────────

function fmtMobile(m: string): string {
  const d = m.replace(/^\+91/, "").replace(/\D/g, "");
  return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : m.replace("+91", "");
}

function waHref(mobile: string): string {
  const d = mobile.replace(/\D/g, "");
  const num = d.startsWith("91") && d.length === 12 ? d : `91${d.slice(-10)}`;
  return `https://wa.me/${num}`;
}

// ── component ────────────────────────────────────────────────────

export function LeadsTable({
  rows,
  hasActiveFilters,
}: {
  rows: LeadRow[];
  hasActiveFilters?: boolean;
}) {
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule py-20 text-center">
        <p className="text-[14px] text-text mb-1.5">
          {hasActiveFilters ? "No leads match your filters." : "No leads yet."}
        </p>
        <p className="text-[12.5px] text-text-dim">
          {hasActiveFilters ? (
            <>
              <Link href={"/leads" as Route} className="text-accent hover:underline">
                Clear filters
              </Link>{" "}
              to see all leads.
            </>
          ) : (
            <>
              <Link href={"/leads/new" as Route} className="text-accent hover:underline">
                + New Lead
              </Link>{" "}
              to get started.
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[14px] border border-rule overflow-hidden divide-y divide-rule/50">
      {rows.map((r) => {
        const priority  = r.priority ? PRIORITY[r.priority] : null;
        const sourceDot = SOURCE_DOT[r.source];
        const hasOwner  = r.ownerName && r.ownerName !== "—";
        const initial   = hasOwner ? r.ownerName!.charAt(0).toUpperCase() : null;

        return (
          <div
            key={r.id}
            onClick={() => router.push(`/leads/${r.id}` as Route)}
            className="flex items-center gap-5 px-5 py-[18px] bg-surface hover:bg-surface-hover transition-colors cursor-pointer"
          >
            {/* ── Identity + meta ──────────────────────────────── */}
            <div className="flex-1 min-w-0">

              {/* Name · Status · Priority — most important, reads left to right */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[14px] font-semibold text-text leading-snug">
                  {r.name}
                </span>
                <StatusPill status={r.stage} />
                {priority && (
                  <span className={`text-[10px] font-semibold uppercase tracking-[0.07em] px-[7px] py-0.5 rounded-[4px] ${priority.cls}`}>
                    {priority.label}
                  </span>
                )}
              </div>

              {/* Mobile · City · Source — enquiry context only */}
              <div className="flex items-center gap-2 mt-1 text-[12px] text-text-dim leading-tight flex-wrap">
                <span className="font-data tabular tracking-tight">{fmtMobile(r.mobile)}</span>

                {r.city && (
                  <>
                    <Sep />
                    <span>{r.city}</span>
                  </>
                )}

                <Sep />
                <span className="inline-flex items-center gap-1.5">
                  {sourceDot && (
                    <span className={`w-[6px] h-[6px] rounded-full shrink-0 ${sourceDot}`} aria-hidden />
                  )}
                  {SOURCE_LABEL[r.source] ?? r.source}
                </span>
              </div>
            </div>

            {/* ── Assigned sales exec ──────────────────────────── */}
            {initial && (
              <div className="hidden sm:flex items-center gap-2 shrink-0">
                <span className="w-[26px] h-[26px] rounded-full bg-accent/15 text-accent text-[10px] font-bold flex items-center justify-center uppercase select-none">
                  {initial}
                </span>
                <span className="text-[12px] text-text-dim hidden lg:block whitespace-nowrap max-w-[110px] truncate">
                  {r.ownerName}
                </span>
              </div>
            )}

            {/* ── Actions ──────────────────────────────────────── */}
            <div
              className="flex items-center gap-1 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <a
                href={`tel:${r.mobile}`}
                title={`Call ${r.name}`}
                className="w-8 h-8 rounded-full flex items-center justify-center text-text-dim hover:text-text hover:bg-surface-2 transition-colors"
              >
                <Phone size={13} strokeWidth={1.75} />
              </a>
              <a
                href={waHref(r.mobile)}
                target="_blank"
                rel="noreferrer noopener"
                title={`WhatsApp ${r.name}`}
                className="w-8 h-8 rounded-full flex items-center justify-center text-text-dim hover:text-[#25D366] hover:bg-surface-2 transition-colors"
              >
                <MessageCircle size={13} strokeWidth={1.75} />
              </a>
              <Link
                href={`/leads/${r.id}` as Route}
                onClick={(e) => e.stopPropagation()}
                className="ml-1.5 h-8 px-3 rounded-[7px] text-[12px] font-medium border border-rule text-text-dim hover:text-text hover:border-accent/40 hover:bg-surface-2 transition-colors flex items-center gap-1"
              >
                Details
                <ArrowUpRight size={12} strokeWidth={2} />
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Sep() {
  return <span className="text-text-faint/60 select-none">·</span>;
}

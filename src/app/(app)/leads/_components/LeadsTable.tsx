"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  Phone, MessageCircle, ArrowUpRight,
  PencilLine, RefreshCw, BellPlus, UserCheck, Trash2, Users,
} from "lucide-react";
import type { LeadRow } from "@/modules/leads/queries";
import { SOURCE_LABEL } from "@/modules/leads/schema";
import { deleteLead } from "@/modules/leads/actions-part2";
import { MoreMenu, type MenuItem } from "@/components/data/MoreMenu";
import { StatusPill } from "./StatusPill";

// ── accent strip colour per stage ────────────────────────────────
const STAGE_STRIP: Record<string, string> = {
  NEW:           "bg-info",
  CONTACTED:     "bg-heat",
  QUALIFIED:     "bg-accent",
  SITE_VISIT:    "bg-heat",
  QUOTED:        "bg-gold",
  NEGOTIATION:   "bg-gold",
  WON:           "bg-solid",
  LOST:          "bg-fault",
};

// ── priority chip ────────────────────────────────────────────────
const PRIORITY: Record<string, { cls: string; label: string }> = {
  HOT:  { cls: "bg-fault/12 text-fault border border-fault/25",  label: "Hot"  },
  WARM: { cls: "bg-heat/12 text-heat border border-heat/25",     label: "Warm" },
  COLD: { cls: "bg-surface-2 text-text-dim border border-rule",  label: "Cold" },
};

// ── source dot colours ───────────────────────────────────────────
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

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit", month: "short", year: "2-digit",
  }).format(d);
}

function leadMenuItems(r: LeadRow): MenuItem[] {
  const isTerminal = r.stage === "WON" || r.stage === "LOST";
  return [
    { key: "edit",     label: "Edit",             icon: PencilLine, href: `/leads/${r.id}/edit` },
    { key: "status",   label: "Change Status",     icon: RefreshCw,  href: `/leads/${r.id}` },
    { key: "followup", label: "Add Follow-up",     icon: BellPlus,   href: `/leads/${r.id}` },
    ...(!isTerminal
      ? [{ key: "convert", label: "Convert to Client", icon: UserCheck, href: `/leads/${r.id}` } as MenuItem]
      : []),
    {
      key:       "delete",
      label:     "Delete Lead",
      icon:      Trash2,
      danger:    true,
      separator: true,
      confirm:   "Permanently delete this lead? This cannot be undone.",
      onClick:   () => void deleteLead(r.id),
    },
  ];
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
      <div className="overflow-hidden rounded-[12px] border border-rule bg-surface px-6 py-14 text-center">
        <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center">
          <Users size={18} strokeWidth={1.5} className="text-text-dim" />
        </div>
        <div className="text-[14px] font-medium text-text mb-1">
          {hasActiveFilters ? "No leads match your filters." : "No leads yet."}
        </div>
        <div className="text-[12px] text-text-dim">
          {hasActiveFilters ? (
            <>
              <Link href={"/leads" as Route} className="text-accent hover:underline">Clear filters</Link>{" "}
              to see all leads.
            </>
          ) : (
            <>
              <Link href={"/leads/new" as Route} className="text-accent hover:underline">+ New Lead</Link>{" "}
              to get started.
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[12px] border border-rule bg-surface">
      <table className="lg:min-w-[900px] w-full border-collapse">
        <thead>
          <tr className="bg-surface-2 border-b border-rule">
            <th className="w-[5px] p-0" aria-hidden />
            <th className="px-2.5 sm:px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim">Lead</th>
            <th className="px-2.5 sm:px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim hidden sm:table-cell">Mobile</th>
            <th className="px-2.5 sm:px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim hidden md:table-cell">City</th>
            <th className="px-2.5 sm:px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim hidden lg:table-cell">Source</th>
            <th className="px-2.5 sm:px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim">Stage</th>
            <th className="px-2.5 sm:px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim hidden md:table-cell">Priority</th>
            <th className="px-2.5 sm:px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim hidden lg:table-cell">Assigned To</th>
            <th className="px-2.5 sm:px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim hidden lg:table-cell">Added</th>
            <th className="px-2.5 sm:px-4 py-3 text-right text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const priority  = r.priority ? PRIORITY[r.priority] : null;
            const sourceDot = SOURCE_DOT[r.source];
            const strip     = STAGE_STRIP[r.stage] ?? "bg-border";
            const initial   = r.ownerName?.charAt(0).toUpperCase() ?? null;

            return (
              <tr
                key={r.id}
                onClick={() => router.push(`/leads/${r.id}` as Route)}
                className={[
                  "group relative cursor-pointer transition-colors hover:bg-surface-2/60",
                  i > 0 ? "border-t border-rule" : "",
                ].join(" ")}
              >
                {/* Accent strip */}
                <td className="p-0 w-[5px]">
                  <div className={`h-full w-[5px] min-h-[56px] ${strip}`} />
                </td>

                {/* Lead name + number */}
                <td className="px-2.5 sm:px-4 py-3.5 max-w-[200px]">
                  <div className="text-[13px] font-semibold text-text truncate">{r.name}</div>
                  <div className="text-[10.5px] text-text-faint mt-0.5 tabular">{r.number}</div>
                </td>

                {/* Mobile */}
                <td className="px-2.5 sm:px-4 py-3.5 hidden sm:table-cell">
                  <span className="tabular text-[12.5px] text-text-dim">{fmtMobile(r.mobile)}</span>
                </td>

                {/* City */}
                <td className="px-2.5 sm:px-4 py-3.5 text-[12.5px] text-text-dim hidden md:table-cell">
                  {r.city ?? <span className="text-text-faint">—</span>}
                </td>

                {/* Source */}
                <td className="px-2.5 sm:px-4 py-3.5 hidden lg:table-cell">
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] text-text-dim">
                    {sourceDot && (
                      <span className={`w-[6px] h-[6px] rounded-full shrink-0 ${sourceDot}`} aria-hidden />
                    )}
                    {SOURCE_LABEL[r.source] ?? r.source}
                  </span>
                </td>

                {/* Stage */}
                <td className="px-2.5 sm:px-4 py-3.5">
                  <StatusPill status={r.stage} />
                </td>

                {/* Priority */}
                <td className="px-2.5 sm:px-4 py-3.5 hidden md:table-cell">
                  {priority ? (
                    <span className={`text-[10px] font-semibold uppercase tracking-[0.07em] px-[7px] py-0.5 rounded-[4px] ${priority.cls}`}>
                      {priority.label}
                    </span>
                  ) : (
                    <span className="text-text-faint text-[12px]">—</span>
                  )}
                </td>

                {/* Assigned To */}
                <td className="px-2.5 sm:px-4 py-3.5 hidden lg:table-cell">
                  {initial ? (
                    <div className="flex items-center gap-2">
                      <span className="w-[24px] h-[24px] rounded-full bg-accent/15 text-accent text-[10px] font-bold flex items-center justify-center uppercase select-none shrink-0">
                        {initial}
                      </span>
                      <span className="text-[12px] text-text-dim truncate max-w-[110px]">{r.ownerName}</span>
                    </div>
                  ) : (
                    <span className="text-text-faint text-[12px]">—</span>
                  )}
                </td>

                {/* Added date */}
                <td className="px-2.5 sm:px-4 py-3.5 tabular text-[12px] text-text-dim hidden lg:table-cell whitespace-nowrap">
                  {fmtDate(r.createdAt)}
                </td>

                {/* Actions */}
                <td
                  className="px-2.5 sm:px-4 py-3.5 text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="inline-flex items-center gap-1 justify-end">
                    <a
                      href={`tel:${r.mobile}`}
                      title={`Call ${r.name}`}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-text-dim hover:text-text hover:bg-surface-2 transition-colors"
                    >
                      <Phone size={12} strokeWidth={1.75} />
                    </a>
                    <a
                      href={waHref(r.mobile)}
                      target="_blank"
                      rel="noreferrer noopener"
                      title={`WhatsApp ${r.name}`}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-text-dim hover:text-[#25D366] hover:bg-surface-2 transition-colors"
                    >
                      <MessageCircle size={12} strokeWidth={1.75} />
                    </a>
                    <Link
                      href={`/leads/${r.id}` as Route}
                      className="ml-1 h-7 px-2.5 rounded-[7px] text-[11.5px] font-medium border border-rule text-text-dim hover:text-text hover:border-accent/40 hover:bg-surface-2 transition-colors hidden sm:flex items-center gap-1"
                    >
                      Details
                      <ArrowUpRight size={11} strokeWidth={2} />
                    </Link>
                    <MoreMenu items={leadMenuItems(r)} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

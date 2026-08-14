"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import type { LeadRow } from "@/modules/leads/queries";
import { SOURCE_LABEL } from "@/modules/leads/schema";
import { StatusPill } from "./StatusPill";

const PRIORITY_CHIP: Record<string, { cls: string; label: string }> = {
  HOT:  { cls: "bg-fault/15 text-fault",         label: "Hot"  },
  WARM: { cls: "bg-warn/15 text-warn",            label: "Warm" },
  COLD: { cls: "bg-text-dim/12 text-text-dim",   label: "Cold" },
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

export function LeadsTable({ rows, hasActiveFilters }: { rows: LeadRow[]; hasActiveFilters?: boolean }) {
  const router = useRouter();

  const emptyLabel = hasActiveFilters
    ? "No leads match your search or filters."
    : "No leads found.";
  const emptyAction = hasActiveFilters ? (
    <><Link href={"/leads" as Route} className="text-accent hover:underline">Clear filters</Link>{" "}to see all leads.</>
  ) : (
    <><Link href={"/leads/new" as Route} className="text-accent hover:underline">+ New Lead</Link>{" "}to get started.</>
  );

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block rounded-[14px] bg-surface border border-rule overflow-hidden overflow-x-auto">
        <table className="w-full text-[12.5px] min-w-[860px]">
          <thead>
            <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
              <Th>Customer</Th>
              <Th>Mobile</Th>
              <Th>City</Th>
              <Th>Source</Th>
              <Th>Priority</Th>
              <Th>Status</Th>
              <Th>Assigned To</Th>
              <Th align="right">Created</Th>
              <Th align="right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-20 text-center">
                  <div className="text-[14px] text-text mb-2">{emptyLabel}</div>
                  <p className="text-[12px] text-text-dim">{emptyAction}</p>
                </td>
              </tr>
            ) : rows.map((r) => {
              const priority = r.priority ? PRIORITY_CHIP[r.priority] : null;
              const sourceDot = SOURCE_DOT[r.source];
              return (
                <tr
                  key={r.id}
                  onClick={() => router.push(`/leads/${r.id}` as Route)}
                  className="border-b border-rule/60 last:border-0 hover:bg-surface-hover transition-colors cursor-pointer group"
                >
                  {/* Customer */}
                  <Td>
                    <Link
                      href={`/leads/${r.id}` as Route}
                      onClick={(e) => e.stopPropagation()}
                      className="block text-[13.5px] font-semibold text-text hover:text-accent leading-tight"
                    >
                      {r.name}
                    </Link>
                    {r.requirement && (
                      <div className="text-[11px] text-text-dim truncate max-w-[200px] mt-0.5 leading-tight">
                        {r.requirement}
                      </div>
                    )}
                  </Td>

                  {/* Mobile */}
                  <Td>
                    <span className="tabular text-[12.5px] text-text-dim font-data">
                      {r.mobile.replace("+91", "")}
                    </span>
                  </Td>

                  {/* City */}
                  <Td>
                    <span className="text-text-dim">{r.city ?? "—"}</span>
                  </Td>

                  {/* Source */}
                  <Td>
                    <span className="inline-flex items-center gap-1.5">
                      {sourceDot && (
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sourceDot}`} aria-hidden />
                      )}
                      <span className="text-text-dim text-[12px]">
                        {SOURCE_LABEL[r.source] ?? r.source}
                      </span>
                    </span>
                  </Td>

                  {/* Priority */}
                  <Td>
                    {priority ? (
                      <span className={`inline-block text-[10.5px] font-medium tracking-[0.06em] uppercase px-2 py-0.5 rounded-[3px] ${priority.cls}`}>
                        {priority.label}
                      </span>
                    ) : (
                      <span className="text-text-faint">—</span>
                    )}
                  </Td>

                  {/* Status */}
                  <Td><StatusPill status={r.stage} /></Td>

                  {/* Assigned To */}
                  <Td>
                    <span className="inline-flex items-center gap-1.5">
                      {r.ownerName && r.ownerName !== "—" && (
                        <span className="w-5 h-5 rounded-full bg-accent/15 text-accent text-[9px] font-semibold flex items-center justify-center shrink-0 uppercase">
                          {r.ownerName.charAt(0)}
                        </span>
                      )}
                      <span className="text-text-dim text-[12.5px]">{r.ownerName ?? "—"}</span>
                    </span>
                  </Td>

                  {/* Created */}
                  <Td align="right">
                    <span className="tabular text-[12px] text-text-dim">{fmtDate(r.createdAt)}</span>
                  </Td>

                  {/* Actions */}
                  <Td align="right">
                    <div
                      className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link
                        href={`/leads/${r.id}` as Route}
                        className="px-2.5 py-1 rounded-[5px] text-[11.5px] border border-rule text-text-dim hover:text-text hover:bg-surface hover:border-accent/40 transition-colors"
                      >
                        View
                      </Link>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile — empty state or card list */}
      {rows.length === 0 ? (
        <div className="md:hidden rounded-[14px] bg-surface border border-rule py-20 text-center">
          <div className="text-[14px] text-text mb-2">{emptyLabel}</div>
          <p className="text-[12px] text-text-dim">{emptyAction}</p>
        </div>
      ) : (
        <div className="md:hidden space-y-2">
          {rows.map((r) => {
            const priority = r.priority ? PRIORITY_CHIP[r.priority] : null;
            const sourceDot = SOURCE_DOT[r.source];
            return (
              <div
                key={r.id}
                onClick={() => router.push(`/leads/${r.id}` as Route)}
                className="rounded-[12px] bg-surface border border-rule px-4 py-4 cursor-pointer hover:bg-surface-hover transition-colors"
              >
                {/* Name + status */}
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="min-w-0">
                    <div className="font-semibold text-[14px] text-text leading-tight">{r.name}</div>
                    {r.city && (
                      <div className="text-[11.5px] text-text-dim mt-0.5">{r.city}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                    {priority && (
                      <span className={`text-[10px] font-medium uppercase px-1.5 py-0.5 rounded-[3px] ${priority.cls}`}>
                        {priority.label}
                      </span>
                    )}
                    <StatusPill status={r.stage} />
                  </div>
                </div>

                {/* Mobile + source */}
                <div className="flex items-center justify-between text-[12.5px] mb-1.5">
                  <span className="tabular text-text-dim font-data">
                    {r.mobile.replace("+91", "")}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-text-dim">
                    {sourceDot && (
                      <span className={`w-1.5 h-1.5 rounded-full ${sourceDot}`} aria-hidden />
                    )}
                    {SOURCE_LABEL[r.source] ?? r.source}
                  </span>
                </div>

                {/* Owner + created */}
                {r.ownerName && r.ownerName !== "—" && (
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-rule/50">
                    <span className="inline-flex items-center gap-1.5 text-[11.5px] text-text-dim">
                      <span className="w-4 h-4 rounded-full bg-accent/15 text-accent text-[8.5px] font-semibold flex items-center justify-center uppercase">
                        {r.ownerName.charAt(0)}
                      </span>
                      {r.ownerName}
                    </span>
                    <span className="text-[11px] text-text-faint tabular">{fmtDate(r.createdAt)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-4 h-[38px] font-medium whitespace-nowrap ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function Td({
  children, align = "left", className = "",
}: { children: React.ReactNode; align?: "left" | "right"; className?: string }) {
  return (
    <td className={`px-4 py-3.5 ${align === "right" ? "text-right" : "text-left"} ${className}`}>
      {children}
    </td>
  );
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" });
}

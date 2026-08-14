"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import type { LeadRow } from "@/modules/leads/queries";
import { SOURCE_LABEL } from "@/modules/leads/schema";
import { StatusPill } from "./StatusPill";

const PRIORITY_CHIP: Record<string, string> = {
  HOT:  "bg-fault/15 text-fault",
  WARM: "bg-warn/15 text-warn",
  COLD: "bg-text-dim/12 text-text-dim",
};

export function LeadsTable({ rows, hasActiveFilters }: { rows: LeadRow[]; hasActiveFilters?: boolean }) {
  const router = useRouter();

  if (rows.length === 0) {
    if (hasActiveFilters) {
      return (
        <div className="rounded-[14px] bg-surface border border-rule py-16 text-center">
          <div className="text-[14px] text-text mb-2">No leads match your search or filters.</div>
          <p className="text-[12px] text-text-dim">
            <Link href={"/leads" as Route} className="text-accent hover:underline">Clear filters</Link>
            {" "}to see all leads.
          </p>
        </div>
      );
    }
    return (
      <div className="rounded-[14px] bg-surface border border-rule py-16 text-center">
        <div className="text-[14px] text-text mb-2">No leads found.</div>
        <p className="text-[12px] text-text-dim">
          <Link href={"/leads/new" as Route} className="text-accent hover:underline">+ New Lead</Link>
          {" "}to get started.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block rounded-[14px] bg-surface border border-rule overflow-hidden overflow-x-auto">
        <table className="w-full text-[12.5px] min-w-[1100px]">
          <thead>
            <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
              <Th>Customer</Th>
              <Th>Mobile</Th>
              <Th>City</Th>
              <Th>Source</Th>
              <Th>Priority</Th>
              <Th>Status</Th>
              <Th>Assigned To</Th>
              <Th>Last Contacted</Th>
              <Th>Next Follow-up</Th>
              <Th align="right">Created</Th>
              <Th align="right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => router.push(`/leads/${r.id}` as Route)}
                className="border-b border-rule/70 last:border-0 hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <Td>
                  <Link
                    href={`/leads/${r.id}` as Route}
                    onClick={(e) => e.stopPropagation()}
                    className="text-text hover:text-accent font-medium"
                  >
                    {r.name}
                  </Link>
                  {r.requirement && (
                    <div className="text-[11px] text-text-dim truncate max-w-[220px]">{r.requirement}</div>
                  )}
                </Td>
                <Td><span className="tabular">{r.mobile}</span></Td>
                <Td className="text-text-dim">{r.city ?? "—"}</Td>
                <Td className="text-text-dim">{SOURCE_LABEL[r.source] ?? r.source}</Td>
                <Td>
                  {r.priority ? (
                    <span className={`inline-block text-[10.5px] font-medium tracking-[0.06em] uppercase px-2 py-0.5 rounded-[3px] ${PRIORITY_CHIP[r.priority] ?? "bg-text-dim/12 text-text-dim"}`}>
                      {r.priority.charAt(0) + r.priority.slice(1).toLowerCase()}
                    </span>
                  ) : <span className="text-text-dim">—</span>}
                </Td>
                <Td><StatusPill status={r.stage} /></Td>
                <Td className="text-text-dim">{r.ownerName ?? "—"}</Td>
                <Td className={`tabular ${r.lastContactedAt ? "text-text-dim" : "text-text-faint"}`}>
                  {r.lastContactedAt ? fmtDate(r.lastContactedAt) : "—"}
                </Td>
                <Td className={`tabular ${r.nextFollowUpAt && r.nextFollowUpAt < new Date() ? "text-fault" : "text-text-dim"}`}>
                  {r.nextFollowUpAt ? fmtDate(r.nextFollowUpAt) : "—"}
                </Td>
                <Td align="right" className="text-text-dim tabular">{fmtDate(r.createdAt)}</Td>
                <Td align="right">
                  <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <Link
                      href={`/leads/${r.id}` as Route}
                      className="px-2 py-0.5 rounded-[4px] text-[11px] border border-rule text-text-dim hover:text-text hover:bg-surface-hover transition-colors"
                    >
                      View
                    </Link>
                    <Link
                      href={`/leads/${r.id}#edit` as Route}
                      className="px-2 py-0.5 rounded-[4px] text-[11px] border border-rule text-text-dim hover:text-text hover:bg-surface-hover transition-colors"
                    >
                      Edit
                    </Link>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {rows.map((r) => (
          <div
            key={r.id}
            onClick={() => router.push(`/leads/${r.id}` as Route)}
            className="rounded-[12px] bg-surface border border-rule p-4 cursor-pointer hover:bg-surface-hover transition-colors"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <div className="font-medium text-[13.5px]">{r.name}</div>
                {r.city && <div className="text-[11.5px] text-text-dim">{r.city}</div>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {r.priority && (
                  <span className={`text-[10px] font-medium uppercase px-1.5 py-0.5 rounded-[3px] ${PRIORITY_CHIP[r.priority] ?? ""}`}>
                    {r.priority.charAt(0) + r.priority.slice(1).toLowerCase()}
                  </span>
                )}
                <StatusPill status={r.stage} />
              </div>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="tabular text-text-dim">{r.mobile}</span>
              <span className="text-text-dim">{SOURCE_LABEL[r.source] ?? r.source}</span>
            </div>
            {(r.nextFollowUpAt || r.ownerName) && (
              <div className="flex items-center justify-between mt-1.5 text-[11.5px] text-text-dim">
                <span>{r.ownerName ?? ""}</span>
                {r.nextFollowUpAt && (
                  <span className={r.nextFollowUpAt < new Date() ? "text-fault" : ""}>
                    Follow-up: {fmtDate(r.nextFollowUpAt)}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-3 h-[34px] font-medium whitespace-nowrap ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function Td({
  children, align = "left", className = "",
}: { children: React.ReactNode; align?: "left" | "right"; className?: string }) {
  return (
    <td className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"} ${className}`}>
      {children}
    </td>
  );
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" });
}

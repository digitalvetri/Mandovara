"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { formatINR } from "@/kernel/money/format";
import type { LeadRow } from "@/modules/leads/queries";
import { StatusPill } from "./StatusPill";

// Density-first row (~34px tall per §5.6 of the design system).

const SOURCE_LABEL: Record<string, string> = {
  WALK_IN: "Walk-in", PHONE: "Phone", WHATSAPP: "WhatsApp", WEBSITE: "Website",
  INSTAGRAM: "Instagram", ARCHITECT_REFERRAL: "Architect Ref.", CLIENT_REFERRAL: "Client Ref.",
  EXHIBITION: "Exhibition", OTHER: "Other",
};

export function LeadsTable({ rows }: { rows: LeadRow[] }) {
  const router = useRouter();
  if (rows.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule py-16 text-center">
        <div className="text-[14px] text-text mb-2">No leads match this filter.</div>
        <p className="text-[12px] text-text-dim">
          Clear the filter, adjust your search, or{" "}
          <Link href={"/leads/new" as Route} className="text-accent hover:underline">create a new lead</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
            <Th>Name</Th>
            <Th>Mobile</Th>
            <Th>Email</Th>
            <Th>Source</Th>
            <Th>Status</Th>
            <Th align="right">Expected</Th>
            <Th align="right">Created</Th>
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
                {/* Keep the <Link> for keyboard nav and screen readers */}
                <Link
                  href={`/leads/${r.id}` as Route}
                  onClick={(e) => e.stopPropagation()}
                  className="text-text hover:text-accent"
                >
                  {r.name}
                </Link>
                {r.requirement && (
                  <div className="text-[11px] text-text-dim truncate max-w-[280px]">{r.requirement}</div>
                )}
              </Td>
              <Td><span className="tabular">{r.mobile}</span></Td>
              <Td className="text-text-dim">{r.email ?? "—"}</Td>
              <Td className="text-text-dim">{SOURCE_LABEL[r.source] ?? r.source}</Td>
              <Td><StatusPill status={r.stage} /></Td>
              <Td align="right"><span className="tabular text-text">{r.budgetMax ? formatINR(r.budgetMax) : "—"}</span></Td>
              <Td align="right" className="text-text-dim tabular">{formatDate(r.createdAt)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-4 h-[34px] font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function Td({
  children, align = "left", className = "",
}: { children: React.ReactNode; align?: "left" | "right"; className?: string }) {
  return (
    <td className={`px-4 py-2 ${align === "right" ? "text-right" : "text-left"} ${className}`}>
      {children}
    </td>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" });
}

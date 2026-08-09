// /reports/profitability — per-project margin list (§14 Phase 6 gate #4).
//
// Reconciled cost columns (Material + Expenses) are proven equal to
// the underlying ledgers via scripts/smoke-profitability.ts. Revenue
// + commissions are heuristic (client-level, project date window) —
// the schema has no direct Project↔Order link today. The detail
// page labels those columns explicitly so the reader knows what to
// trust.

import Link from "next/link";
import type { Route } from "next";
import { Topbar } from "@/components/layout/Topbar";
import { formatINR } from "@/kernel/money/format";
import { devContext } from "@/lib/dev-context";
import { listProjectProfitability } from "@/modules/reports/profitability";

export const dynamic = "force-dynamic";

export default async function ProfitabilityPage() {
  const ctx = await devContext();
  const rows = await listProjectProfitability(ctx);

  const totals = rows.reduce(
    (t, r) => ({
      revenue:      t.revenue      + r.revenue,
      materialCost: t.materialCost + r.materialCost,
      expenses:     t.expenses     + r.expenses,
      netMargin:    t.netMargin    + r.netMargin,
    }),
    { revenue: 0n, materialCost: 0n, expenses: 0n, netMargin: 0n },
  );
  const overallPct = totals.revenue === 0n
    ? 0
    : Number((totals.netMargin * 10_000n) / totals.revenue) / 100;

  return (
    <>
      <Topbar
        title="Project profitability"
        eyebrow={`${rows.length} project${rows.length === 1 ? "" : "s"} · Material + expenses are reconciled to the ledgers; revenue is heuristic (client + project date window).`}
      />

      <div className="rounded-[14px] bg-surface border border-rule p-5 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Kpi label="Revenue"       value={formatINR(totals.revenue)}      hint="heuristic" />
        <Kpi label="Material cost" value={formatINR(totals.materialCost)} hint="reconciled" />
        <Kpi label="Expenses"      value={formatINR(totals.expenses)}     hint="reconciled" />
        <Kpi label="Net margin"    value={formatINR(totals.netMargin)}    hint={`${overallPct.toFixed(1)}%`} tone={totals.netMargin < 0n ? "bad" : "good"} />
      </div>

      <div className="rounded-[14px] bg-surface border border-rule overflow-hidden pb-10">
        {rows.length === 0 ? (
          <div className="py-14 text-center">
            <div className="text-[14px] text-text mb-1">No projects yet.</div>
            <div className="text-[11.5px] text-text-dim">
              Start a project from a client for it to appear here.
            </div>
          </div>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                <Th>Project</Th>
                <Th>Client</Th>
                <Th align="right">Revenue*</Th>
                <Th align="right">Material</Th>
                <Th align="right">Expenses</Th>
                <Th align="right">Net</Th>
                <Th align="right">Margin</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.projectId} className="border-b border-rule/60 last:border-0 hover:bg-bg/40">
                  <Td>
                    <Link href={`/reports/profitability/${r.projectId}` as Route}
                          className="text-accent hover:underline">
                      {r.projectNumber}
                    </Link>
                    <div className="text-[10.5px] text-text-dim">{r.projectName}</div>
                  </Td>
                  <Td>{r.clientName}</Td>
                  <Td align="right"><span className="tabular text-text-dim">{formatINR(r.revenue)}</span></Td>
                  <Td align="right"><span className="tabular text-text">{formatINR(r.materialCost)}</span></Td>
                  <Td align="right"><span className="tabular text-text">{formatINR(r.expenses)}</span></Td>
                  <Td align="right">
                    <span className={`tabular font-medium ${r.netMargin < 0n ? "text-bad" : "text-good"}`}>
                      {formatINR(r.netMargin)}
                    </span>
                  </Td>
                  <Td align="right">
                    <span className={`tabular text-[11px] ${r.netMargin < 0n ? "text-bad" : "text-text-dim"}`}>
                      {r.revenue === 0n ? "—" : `${r.marginPct.toFixed(1)}%`}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-[10.5px] uppercase tracking-[0.06em] text-text-dim">
                      {r.status.toLowerCase()}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="px-4 py-3 border-t border-rule/60 text-[10.5px] text-text-faint">
          * Revenue attributes all client invoices between the project&apos;s start and end dates.
          The schema does not tie invoices to projects directly — the number is a heuristic, not a reconciled total.
        </div>
      </div>
    </>
  );
}

function Kpi({
  label, value, hint, tone = "default",
}: { label: string; value: string; hint?: string; tone?: "default" | "good" | "bad" }) {
  const toneCls = tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : "text-text";
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim">{label}</div>
      <div className={`font-display text-[24px] font-semibold tabular-nums mt-1 ${toneCls}`}>{value}</div>
      {hint && <div className="text-[10px] text-text-faint mt-0.5">{hint}</div>}
    </div>
  );
}
function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-3 h-[36px] font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}
function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <td className={`px-3 py-3 ${align === "right" ? "text-right" : "text-left"} align-top`}>{children}</td>;
}

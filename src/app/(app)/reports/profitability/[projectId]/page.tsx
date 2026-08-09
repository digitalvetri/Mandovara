// /reports/profitability/[projectId] — per-project breakdown card.
// Reconciled columns explicitly labelled so the reader knows which
// numbers survive audit-to-paisa.

import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import { devContext } from "@/lib/dev-context";
import { computeProjectProfitability } from "@/modules/reports/profitability";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ projectId: string }> }

export default async function ProfitabilityDetailPage({ params }: Props) {
  const { projectId } = await params;
  const ctx = await devContext();
  const p = await computeProjectProfitability(ctx, projectId);
  if (!p) notFound();

  return (
    <>
      <Topbar
        title={p.projectName}
        eyebrow={`${p.projectNumber} · ${p.clientName} · ${p.status.toLowerCase()} · Started ${formatDate(p.startDate)}${p.endDate ? ` · Ended ${formatDate(p.endDate)}` : ""}`}
        actions={
          <Link href={"/reports/profitability" as Route}
                className="h-[30px] px-3 rounded-[6px] text-[11.5px] font-medium bg-surface border border-rule text-text-dim hover:text-text hover:bg-surface-hover">
            ← All projects
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] gap-4 pb-10">
        <div className="rounded-[14px] bg-surface border border-rule p-6">
          <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim mb-4">
            Breakdown
          </div>
          <table className="w-full text-[13px]">
            <tbody>
              <Row
                label="Revenue"
                v={p.revenue}
                hint="heuristic — all client invoices in the project window"
              />
              <Section label="Costs (reconciled to ledgers)" />
              <Row label="Material" v={p.materialCost} sign="−"
                   hint="SUM(MaterialIssue.quantity × rate) for this project · reversals ride as negative qty" />
              <Row label="Expenses" v={p.expenses} sign="−"
                   hint="SUM(APPROVED ProjectExpense.amount) for this project" />
              <Section label="Costs (heuristic)" />
              <Row label="Commissions" v={p.commissions} sign="−"
                   hint="heuristic — architect commissions on this client's orders in window" />
              <Row label="Labour" v={0n} sign="−"
                   hint="not tracked yet — waiting on Phase 7 payroll" />
              <Section label="" />
              <tr className="border-t-2 border-rule">
                <td className="py-3 text-[12px] uppercase tracking-[0.14em] text-text-dim">Net margin</td>
                <td className={`py-3 text-right font-display text-[22px] font-semibold tabular-nums ${p.netMargin < 0n ? "text-bad" : "text-good"}`}>
                  {formatINR(p.netMargin)}
                </td>
              </tr>
              <tr>
                <td className="py-1 text-[10.5px] text-text-faint">Margin %</td>
                <td className={`py-1 text-right tabular text-[12px] ${p.netMargin < 0n ? "text-bad" : "text-text"}`}>
                  {p.revenue === 0n ? "—" : `${p.marginPct.toFixed(2)}%`}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <aside className="space-y-4 h-fit">
          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim mb-3">
              What&apos;s reconciled
            </div>
            <ul className="text-[11.5px] space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-good">✓</span>
                <span><b>Material cost</b> — sum of MaterialIssue rows for this project. Reversals cancel via signed quantity.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-good">✓</span>
                <span><b>Expenses</b> — sum of APPROVED ProjectExpense rows for this project.</span>
              </li>
              <li className="flex items-start gap-2 mt-3">
                <span className="text-heat">≈</span>
                <span><b>Revenue</b> — all client invoices between project start and end. Schema has no Order↔Project link.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-heat">≈</span>
                <span><b>Commissions</b> — same client + window heuristic.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-text-faint">–</span>
                <span><b>Labour</b> — not tracked; Phase 7 payroll surfaces it.</span>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}

function Row({
  label, v, hint, sign,
}: { label: string; v: bigint; hint?: string; sign?: string }) {
  return (
    <tr className="border-b border-rule/40">
      <td className="py-2">
        <div className="text-text">{label}</div>
        {hint && <div className="text-[10.5px] text-text-faint mt-0.5">{hint}</div>}
      </td>
      <td className="py-2 text-right tabular text-text">
        {sign}{formatINR(v)}
      </td>
    </tr>
  );
}
function Section({ label }: { label: string }) {
  if (label === "") return <tr className="h-2" />;
  return (
    <tr className="bg-bg/30">
      <td colSpan={2} className="px-0 pt-3 pb-1 text-[10px] uppercase tracking-[0.14em] text-text-dim">
        {label}
      </td>
    </tr>
  );
}

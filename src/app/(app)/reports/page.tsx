import Link from "next/link";
import type { Route } from "next";
import { Topbar } from "@/components/layout/Topbar";
import { formatINR } from "@/kernel/money/format";
import { devContext } from "@/lib/dev-context";
import { shortNumber } from "@/lib/short-number";
import {
  leadsBySource, invoiceAgeing, topClientsByRevenue, projectMarginTop,
} from "@/modules/reports/queries";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  WEBSITE: "Website", REFERRAL: "Referral", WHATSAPP: "WhatsApp",
  WALK_IN: "Walk-in", EXHIBITION: "Exhibition", COLD_CALL: "Cold call", OTHER: "Other",
};

export default async function ReportsPage() {
  const ctx = await devContext();
  const [leads, ageing, topClients, margins] = await Promise.all([
    leadsBySource(ctx),
    invoiceAgeing(ctx),
    topClientsByRevenue(ctx, 10),
    projectMarginTop(ctx, 10),
  ]);

  const totalAgeingAmount = ageing.reduce((s, b) => s + b.amount, 0n);
  const totalLeads        = leads.reduce((s, r) => s + r.total, 0);
  const totalWon          = leads.reduce((s, r) => s + r.won, 0);
  const overallConversion = totalLeads === 0 ? 0 : totalWon / totalLeads;

  return (
    <>
      <Topbar
        title="Reports"
        eyebrow="Aggregated views across the live data — no export yet, just what's true right now."
      />

      {/* ── Reports index (Phase 8b) ─────────────────────────── */}
      <div className="rounded-[14px] bg-surface border border-rule p-4 mb-4">
        <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim mb-3">
          All reports
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <IndexTile
            href="/reports/profitability" title="Project profitability"
            desc="Revenue minus material + expenses + commissions, per project. Material and expenses reconcile to the ledgers to the paisa."
            badge="reconciled"
          />
          <IndexTile
            href="/architects" title="Architect commissions"
            desc="Referral partners with earned, paid, and outstanding totals + full history."
          />
          <IndexTile
            href="/payroll" title="Payroll runs"
            desc="Monthly runs with per-employee gross / PF / ESI / PT / net. Bank file + payslip PDF from the run detail."
          />
          <IndexTile
            href="/purchase/allocation" title="Dye-lot allocation"
            desc="Open order lines awaiting material with per-lot availability + mixed-lot audit trail."
          />
          <IndexTile
            href="/install" title="Install schedule"
            desc="Crew × day calendar of scheduled + in-progress site visits."
          />
          <IndexTile
            href="/make" title="Make kanban"
            desc="Cut & stitch jobs by status (QUEUED → CUTTING → … → READY)."
          />
        </div>
        <div className="mt-3 text-[10.5px] text-text-faint">
          Dashboards below aggregate across the whole studio · click a tile above for a focused view.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-10">
        {/* ── Leads by source ─────────────────────────────────── */}
        <Card
          title="Leads by source"
          eyebrow="Conversion"
          hero={`${(overallConversion * 100).toFixed(1)}%`}
          heroSub={`${totalWon} of ${totalLeads} won`}
        >
          {leads.length === 0 ? (
            <Empty text="No leads yet." />
          ) : (
            <ul className="divide-y divide-rule/60">
              {leads.map((r) => (
                <li key={r.source} className="py-2 flex items-center gap-3">
                  <div className="w-[110px] text-[12px] text-text">{SOURCE_LABEL[r.source] ?? r.source}</div>
                  <div className="flex-1">
                    <div className="h-[6px] rounded-full bg-rule/60 overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full"
                        style={{ width: `${r.total === 0 ? 0 : (r.won / Math.max(...leads.map((l) => l.total))) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-[80px] text-right tabular text-[11.5px] text-text-dim">
                    <span className="text-text">{r.won}</span>/<span>{r.total}</span>
                  </div>
                  <div className="w-[52px] text-right tabular text-[11.5px] text-text-dim">
                    {(r.conversion * 100).toFixed(0)}%
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* ── Outstanding invoice ageing ──────────────────────── */}
        <Card
          title="Outstanding invoice ageing"
          eyebrow="Total open"
          hero={formatINR(totalAgeingAmount)}
          heroSub={`${ageing.reduce((s, b) => s + b.count, 0)} invoices`}
        >
          {totalAgeingAmount === 0n ? (
            <Empty text="Nothing outstanding — every issued invoice is settled." />
          ) : (
            <ul className="divide-y divide-rule/60">
              {ageing.map((b) => {
                const pct =
                  totalAgeingAmount === 0n
                    ? 0
                    : Number((b.amount * 10_000n) / totalAgeingAmount) / 100;
                const overdue = b.fromDays > 0;
                return (
                  <li key={b.label} className="py-2 flex items-center gap-3">
                    <div className="w-[100px] text-[12px] text-text">{b.label}</div>
                    <div className="flex-1">
                      <div className="h-[6px] rounded-full bg-rule/60 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${overdue ? "bg-bad" : "bg-good"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-[110px] text-right tabular text-[12px] text-text">
                      {b.amount > 0n ? formatINR(b.amount) : "—"}
                    </div>
                    <div className="w-[36px] text-right tabular text-[11px] text-text-dim">
                      {b.count}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* ── Top clients by revenue ──────────────────────────── */}
        <Card
          title="Top clients by revenue"
          eyebrow="Top 10 · all-time (excluding cancelled)"
        >
          {topClients.length === 0 ? (
            <Empty text="No invoices yet." />
          ) : (
            <ul className="divide-y divide-rule/60">
              {topClients.map((c) => (
                <li key={c.clientId} className="py-2 flex items-center gap-3">
                  <Link
                    href={`/clients/${c.clientId}` as Route}
                    className="flex-1 min-w-0 truncate text-[12.5px] text-text hover:text-accent"
                  >
                    {c.name}
                  </Link>
                  <div className="w-[70px] text-right tabular text-[11px] text-text-dim">
                    {c.invoiceCount} inv
                  </div>
                  <div className="w-[120px] text-right tabular text-[12.5px] text-text">
                    {formatINR(c.revenue)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* ── Project margin snapshot ─────────────────────────── */}
        <Card
          title="Project margin snapshot"
          eyebrow="Top 10 by order value · order value − approved expenses"
        >
          {margins.length === 0 ? (
            <Empty text="No projects yet." />
          ) : (
            <ul className="divide-y divide-rule/60">
              {margins.map((p) => {
                const pos = p.margin > 0n;
                return (
                  <li key={p.projectId} className="py-2 flex items-center gap-3">
                    <Link
                      href={`/projects/${p.projectId}` as Route}
                      className="w-[80px] tabular text-[11.5px] text-text hover:text-accent"
                    >
                      {shortNumber(p.number, "P-")}
                    </Link>
                    <div className="flex-1 min-w-0 truncate text-[12px] text-text">{p.name}</div>
                    <div className="w-[110px] text-right tabular text-[11.5px] text-text-dim">
                      {formatINR(p.orderValue)}
                    </div>
                    <div className={`w-[110px] text-right tabular text-[12px] ${pos ? "text-good" : "text-bad"}`}>
                      {formatINR(p.margin)}
                    </div>
                    <div className={`w-[52px] text-right tabular text-[11px] ${pos ? "text-good" : "text-bad"}`}>
                      {(p.marginPct * 100).toFixed(0)}%
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function Card({
  title, eyebrow, hero, heroSub, children,
}: {
  title:    string;
  eyebrow?: string;
  hero?:    string;
  heroSub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[14px] bg-surface border border-rule p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">{title}</div>
        {eyebrow && <div className="text-[10.5px] text-text-faint">{eyebrow}</div>}
      </div>
      {hero && (
        <div className="mb-3 pb-3 border-b border-rule/60">
          <div className="font-display text-[28px] leading-none font-semibold tabular text-text">{hero}</div>
          {heroSub && <div className="mt-1 text-[11px] text-text-dim">{heroSub}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="py-6 text-center text-[12px] text-text-faint">{text}</div>;
}

function IndexTile({
  href, title, desc, badge,
}: { href: string; title: string; desc: string; badge?: string }) {
  return (
    <Link
      href={href as Route}
      className="rounded-[10px] border border-rule bg-bg/40 hover:border-accent/40 hover:bg-bg p-3 block transition-colors"
    >
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <div className="text-[12.5px] font-medium text-text">{title}</div>
        {badge && (
          <span className="text-[9.5px] uppercase tracking-[0.06em] text-good bg-good/[0.10] px-1.5 py-0.5 rounded-[3px]">
            {badge}
          </span>
        )}
      </div>
      <div className="text-[11px] text-text-dim leading-snug">{desc}</div>
    </Link>
  );
}

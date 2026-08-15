import Link from "next/link";
import type { Route } from "next";
import { Topbar } from "@/components/layout/Topbar";
import { formatINR } from "@/kernel/money/format";
import { devContext } from "@/lib/dev-context";
import { shortNumber } from "@/lib/short-number";
import { getReportKpis } from "@/modules/reports/kpi";
import { leadsBySource, invoiceAgeing, topClientsByRevenue, projectMarginTop } from "@/modules/reports/queries";
import { ExportButtons } from "./ExportButtons";
import { DateRangeFilter } from "./_components/DateRangeFilter";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  WALK_IN: "Walk-in", PHONE: "Phone", WHATSAPP: "WhatsApp", WEBSITE: "Website",
  INSTAGRAM: "Instagram", ARCHITECT_REFERRAL: "Architect Ref.", CLIENT_REFERRAL: "Client Ref.",
  EXHIBITION: "Exhibition", OTHER: "Other",
};

interface SP { from?: string; to?: string }

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const p   = await searchParams;
  const ctx = await devContext();
  const from = p.from ? new Date(p.from) : undefined;
  const to   = p.to   ? new Date(`${p.to}T23:59:59`) : undefined;

  const [kpi, leads, ageing, topClients, margins] =
    await Promise.all([
      getReportKpis(ctx, { from, to }),
      leadsBySource(ctx),
      invoiceAgeing(ctx),
      topClientsByRevenue(ctx, 10),
      projectMarginTop(ctx, 10),
    ]);

  const totalLeads      = leads.reduce((s, r) => s + r.total, 0);
  const totalWon        = leads.reduce((s, r) => s + r.won, 0);
  const overallConvPct  = totalLeads === 0 ? "—" : `${((totalWon / totalLeads) * 100).toFixed(1)}%`;
  const totalOutstanding = ageing.reduce((s, b) => s + b.amount, 0n);
  const periodLabel     = from || to
    ? `${p.from ?? "start"} → ${p.to ?? "today"}`
    : "All time";

  return (
    <>
      <Topbar title="Reports" eyebrow={periodLabel} actions={<ExportButtons />} />

      <DateRangeFilter />

      {/* ── KPI cards ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KpiCard label="Revenue" value={formatINR(kpi.revenue)} href="/invoicing" note="ex-GST" />
        <KpiCard label="Collections" value={formatINR(kpi.collections)} href="/accounts" />
        <KpiCard label="Outstanding" value={formatINR(kpi.outstanding)} href={"/invoicing?status=ISSUED" as Route} warn={kpi.outstanding > 0n} />
        <KpiCard label="Active Projects" value={String(kpi.activeProjects)} href="/projects" />
        <KpiCard label="New Leads" value={String(kpi.newLeads)} href="/leads" note={periodLabel} />
        <KpiCard label="Ready to Install" value={String(kpi.readyToInstall)} href={"/orders?status=READY_TO_INSTALL" as Route} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* ── Leads by source ───────────────────────────────────── */}
        <Card title="Leads by source" eyebrow={`Overall ${overallConvPct} conversion`}>
          {leads.length === 0 ? <Empty text="No leads yet." /> : (
            <ul className="divide-y divide-rule/60">
              {leads.map((r) => {
                const maxTotal = Math.max(...leads.map((l) => l.total));
                return (
                  <li key={r.source} className="py-2 flex items-center gap-3">
                    <Link href={`/leads?source=${r.source}` as Route} className="w-[120px] text-[12px] text-text hover:text-accent transition-colors shrink-0">
                      {SOURCE_LABEL[r.source] ?? r.source}
                    </Link>
                    <div className="flex-1">
                      <div className="h-[6px] rounded-full bg-rule/60 overflow-hidden">
                        <div className="h-full bg-accent rounded-full" style={{ width: `${maxTotal === 0 ? 0 : (r.won / maxTotal) * 100}%` }} />
                      </div>
                    </div>
                    <div className="w-[72px] text-right tabular text-[11.5px] text-text-dim shrink-0">
                      <span className="text-text">{r.won}</span>/{r.total}
                    </div>
                    <div className="w-[46px] text-right tabular text-[11.5px] text-text-dim shrink-0">
                      {(r.conversion * 100).toFixed(0)}%
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* ── Invoice ageing ────────────────────────────────────── */}
        <Card title="Outstanding invoice ageing" eyebrow={`Total open · ${formatINR(totalOutstanding)}`}>
          {totalOutstanding === 0n ? <Empty text="Every issued invoice is settled." /> : (
            <ul className="divide-y divide-rule/60">
              {ageing.map((b) => {
                const pct = totalOutstanding === 0n ? 0 : Number((b.amount * 10_000n) / totalOutstanding) / 100;
                return (
                  <li key={b.label} className="py-2 flex items-center gap-3">
                    <Link href={"/invoicing" as Route} className="w-[100px] text-[12px] text-text hover:text-accent transition-colors shrink-0">{b.label}</Link>
                    <div className="flex-1">
                      <div className="h-[6px] rounded-full bg-rule/60 overflow-hidden">
                        <div className={`h-full rounded-full ${b.fromDays > 0 ? "bg-bad" : "bg-good"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="w-[110px] text-right tabular text-[12px] text-text shrink-0">{b.amount > 0n ? formatINR(b.amount) : "—"}</div>
                    <div className="w-[32px] text-right tabular text-[11px] text-text-dim shrink-0">{b.count}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* ── Top clients ───────────────────────────────────────── */}
        <Card title="Top clients by revenue" eyebrow="Top 10 · all time · non-cancelled">
          {topClients.length === 0 ? <Empty text="No invoices yet." /> : (
            <ul className="divide-y divide-rule/60">
              {topClients.map((c) => (
                <li key={c.clientId} className="py-2 flex items-center gap-3">
                  <Link href={`/clients/${c.clientId}` as Route} className="flex-1 min-w-0 truncate text-[12.5px] text-text hover:text-accent transition-colors">
                    {c.name}
                  </Link>
                  <div className="w-[60px] text-right tabular text-[11px] text-text-dim shrink-0">{c.invoiceCount} inv</div>
                  <div className="w-[120px] text-right tabular text-[12.5px] text-text shrink-0">{formatINR(c.revenue)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* ── Project margin snapshot ───────────────────────────── */}
        <Card title="Project margin snapshot" eyebrow="Top 10 by order value · order value − approved expenses">
          {margins.length === 0 ? <Empty text="No projects yet." /> : (
            <ul className="divide-y divide-rule/60">
              {margins.map((prj) => {
                const pos = prj.margin > 0n;
                return (
                  <li key={prj.projectId} className="py-2 flex items-center gap-3">
                    <Link href={`/projects/${prj.projectId}` as Route} className="w-[72px] tabular text-[11.5px] text-text hover:text-accent shrink-0">{shortNumber(prj.number, "P-")}</Link>
                    <div className="flex-1 min-w-0 truncate text-[12px] text-text">{prj.name}</div>
                    <div className="w-[100px] text-right tabular text-[11.5px] text-text-dim shrink-0">{formatINR(prj.orderValue)}</div>
                    <div className={`w-[100px] text-right tabular text-[12px] shrink-0 ${pos ? "text-good" : "text-bad"}`}>{formatINR(prj.margin)}</div>
                    <div className={`w-[46px] text-right tabular text-[11px] shrink-0 ${pos ? "text-good" : "text-bad"}`}>{(prj.marginPct * 100).toFixed(0)}%</div>
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

function KpiCard({ label, value, href, note, warn }: {
  label: string; value: string; href: string; note?: string; warn?: boolean;
}) {
  return (
    <Link
      href={href as Route}
      className="rounded-[12px] bg-surface border border-rule p-4 flex flex-col gap-1 hover:bg-surface-hover hover:border-accent/30 transition-colors group"
    >
      <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">{label}</div>
      <div className={`font-data text-[22px] leading-none tabular font-semibold mt-1 ${warn ? "text-bad" : "text-text"} group-hover:text-accent transition-colors`}>
        {value}
      </div>
      {note && <div className="text-[10px] text-text-faint mt-0.5">{note}</div>}
    </Link>
  );
}

function Card({ title, eyebrow, children }: { title: string; eyebrow?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] bg-surface border border-rule p-5 mb-4">
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">{title}</div>
        {eyebrow && <div className="text-[10.5px] text-text-faint">{eyebrow}</div>}
      </div>
      {children}
    </div>
  );
}


function Empty({ text }: { text: string }) {
  return <div className="py-6 text-center text-[12px] text-text-faint">{text}</div>;
}

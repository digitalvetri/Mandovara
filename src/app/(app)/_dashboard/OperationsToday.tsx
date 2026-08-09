// Operations Today — a live snapshot of the studio's current work.
// Sits under the KPI row on the owner dashboard. Each card links
// to the page where the operator actually acts on that work.

import Link from "next/link";
import type { Route } from "next";
import { Scissors, Wrench, Landmark, IndianRupee } from "lucide-react";
import { formatINR } from "@/kernel/money/format";
import type { OperationsKpi } from "./types";

interface Props { kpi: OperationsKpi }

export function OperationsToday({ kpi }: Props) {
  return (
    <section className="mt-4">
      <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-2">
        Operations Today
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <OpsCard
          href="/make" title="Make jobs" Icon={Scissors}
          value={String(kpi.makeInProgressCount)}
          valueLabel="in progress"
          sub={`${kpi.makeQueuedCount} queued · ${kpi.makeReadyCount} ready`}
        />
        <OpsCard
          href="/install" title="Install this week" Icon={Wrench}
          value={String(kpi.installVisitsThisWeek)}
          valueLabel="visit(s)"
          sub="Scheduled or in progress · next 7 days"
        />
        <OpsCard
          href="/architects" title="Commissions" Icon={Landmark}
          value={formatINR(kpi.commissionsOutstanding)}
          valueLabel="outstanding"
          sub={`${kpi.commissionsCount} unpaid line(s)`}
          tone={kpi.commissionsOutstanding > 0n ? "heat" : "muted"}
        />
        <OpsCard
          href={kpi.latestPayrollRunId ? `/payroll/${kpi.latestPayrollRunId}` : "/payroll"}
          title="Latest payroll" Icon={IndianRupee}
          value={kpi.latestPayrollTotal != null ? formatINR(kpi.latestPayrollTotal) : "—"}
          valueLabel={kpi.latestPayrollStatus?.toLowerCase() ?? "no runs yet"}
          sub={kpi.latestPayrollPeriod ?? "Nothing to run against"}
        />
      </div>
    </section>
  );
}

type LucideIcon = typeof Scissors;

function OpsCard({
  href, title, Icon, value, valueLabel, sub, tone = "muted",
}: {
  href: string; title: string; Icon: LucideIcon;
  value: string; valueLabel: string; sub: string;
  tone?: "muted" | "heat";
}) {
  const valueCls = tone === "heat" ? "text-heat" : "text-text";
  return (
    <Link
      href={href as Route}
      className="rounded-[14px] bg-surface border border-rule p-4 hover:border-accent/40 transition-colors block"
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim">{title}</div>
        <Icon size={13} className="text-text-dim" />
      </div>
      <div className={`mt-2 font-display text-[22px] font-semibold tabular-nums leading-none ${valueCls}`}>
        {value}
      </div>
      <div className="mt-1 text-[10.5px] text-text-dim uppercase tracking-[0.06em]">{valueLabel}</div>
      <div className="mt-1 text-[10.5px] text-text-faint">{sub}</div>
    </Link>
  );
}

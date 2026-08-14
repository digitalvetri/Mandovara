import Link from "next/link";
import type { Route } from "next";
import type { LeadSummaryCounts } from "@/modules/leads/queries";

interface Props { counts: LeadSummaryCounts }

// PDF §6: Total, New, Contacted, Qualified, Follow-up, Won, Lost — clickable to filter.
export function LeadSummaryCards({ counts }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-5">
      <Card href="/leads"             label="Total"      value={counts.total}     />
      <Card href="/leads?status=NEW"       label="New"        value={counts.newLeads}  accent="text-accent" dot="bg-accent" />
      <Card href="/leads?status=CONTACTED" label="Contacted"  value={counts.contacted} accent="text-warn" dot="bg-warn" />
      <Card href="/leads?status=QUALIFIED" label="Qualified"  value={counts.qualified} accent="text-info" dot="bg-info" />
      <Card href="/leads"             label="Follow-up"  value={counts.followUp}  accent="text-gold" dot="bg-gold" />
      <Card href="/leads?status=WON"       label="Won"        value={counts.won}       accent="text-solid" dot="bg-solid" />
      <Card href="/leads?status=LOST"      label="Lost"       value={counts.lost}      accent="text-fault" dot="bg-fault" />
    </div>
  );
}

function Card({
  href, label, value, accent = "text-text", dot,
}: { href: string; label: string; value: number; accent?: string; dot?: string }) {
  return (
    <Link
      href={href as Route}
      className="rounded-[10px] bg-surface border border-rule px-3 py-2.5 hover:border-accent/50 hover:bg-surface-hover transition-colors block"
    >
      <div className="flex items-center gap-1.5 mb-1">
        {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} aria-hidden />}
        <span className="text-[10px] uppercase tracking-[0.12em] text-text-dim truncate">{label}</span>
      </div>
      <div className={`font-data text-[22px] font-semibold tabular-nums leading-none ${accent}`}>
        {value}
      </div>
    </Link>
  );
}

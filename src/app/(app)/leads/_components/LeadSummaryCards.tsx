import Link from "next/link";
import type { Route } from "next";
import type { LeadSummaryCounts } from "@/modules/leads/queries";

interface Props { counts: LeadSummaryCounts }

// Summary cards — one per sanctioned stage after the 25 Aug 2026
// simplification. "New" absorbs contacted / qualified / measurement-scheduled
// (the previously separate cards were noise); "Quoted" absorbs negotiation.
// See src/modules/leads/schema.ts ACTIVE_LEAD_STAGES.
export function LeadSummaryCards({ counts }: Props) {
  // Legacy pre-quote stages roll up into "New" — otherwise leads at those
  // stages disappear from the summary until they're re-saved.
  const newLike = counts.newLeads + counts.contacted + counts.qualified;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-5">
      <Card href="/leads"            label="Total"      value={counts.total}    />
      <Card href="/leads?status=NEW"    label="New"        value={newLike}         accent="text-accent" dot="bg-accent" />
      <Card href="/leads?status=QUOTED" label="Quoted"     value={counts.quoted}   accent="text-info" dot="bg-info" />
      <Card href="/leads?status=WON"    label="Won"        value={counts.won}      accent="text-solid" dot="bg-solid" />
      <Card href="/leads?status=LOST"   label="Lost"       value={counts.lost}     accent="text-fault" dot="bg-fault" />
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

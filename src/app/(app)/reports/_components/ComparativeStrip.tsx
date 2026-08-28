// Month-on-month and week-on-week movement, under the KPI tiles.
//
// A percentage with no direction is a riddle, so each figure carries an
// arrow and a colour, and "no prior data" is stated rather than shown as
// 0% — a studio's first month did not grow by nothing.

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { Comparatives, ComparableKpi, Movement } from "@/modules/reports/comparatives";

const LABEL: Record<ComparableKpi, string> = {
  revenue:     "Revenue",
  collections: "Collections",
  newLeads:    "New leads",
};

export function ComparativeStrip({ data }: { data: Comparatives }) {
  return (
    <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
      <Panel title="This month vs last month" rows={data.month} />
      <Panel title="This week vs last week"   rows={data.week} />
    </div>
  );
}

function Panel({ title, rows }: { title: string; rows: Record<ComparableKpi, Movement> }) {
  const keys = Object.keys(rows) as ComparableKpi[];
  return (
    <div className="rounded-[14px] border border-rule bg-surface p-5">
      <div className="mb-3 text-[10.5px] uppercase tracking-[0.16em] text-text-dim">{title}</div>
      <div className="space-y-2.5">
        {keys.map((k) => <Row key={k} label={LABEL[k]} m={rows[k]} />)}
      </div>
    </div>
  );
}

function Row({ label, m }: { label: string; m: Movement }) {
  if (m.pct === null) {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13.5px] text-text">{label}</span>
        <span className="inline-flex items-center gap-1.5 text-[13px] text-text-dim">
          <Minus size={13} /> No prior data
        </span>
      </div>
    );
  }

  const up   = m.pct > 0;
  const flat = Math.abs(m.pct) < 0.05;
  const tone = flat ? "text-text-dim" : up ? "text-good" : "text-heat";
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13.5px] text-text">{label}</span>
      <span className={`inline-flex items-center gap-1.5 text-[13.5px] font-medium tabular-nums ${tone}`}>
        <Icon size={13} />
        {flat ? "No change" : `${up ? "+" : ""}${m.pct.toFixed(1)}%`}
      </span>
    </div>
  );
}

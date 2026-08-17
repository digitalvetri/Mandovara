"use client";

// Companion donut to PaymentModeChart, but for money going OUT.
// Shows how the last 12 months of outflow splits across Salary /
// Overhead / Project spend.

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatINR } from "@/kernel/money/format";

export interface OutflowSlice {
  kind:   "SALARY" | "EXPENSE" | "PROJECT_EXPENSE";
  label:  string;
  amount: string;  // BigInt paise, stringified
  count:  number;
}

interface Props { slices: OutflowSlice[] }

const KIND_COLOR: Record<OutflowSlice["kind"], string> = {
  SALARY:          "oklch(0.68 0.13 245)",   // deep blue
  EXPENSE:         "oklch(0.72 0.115 25)",   // warm terracotta
  PROJECT_EXPENSE: "oklch(0.72 0.115 85)",   // gold
};

interface RechartsSlice {
  kind:       OutflowSlice["kind"];
  label:      string;
  paise:      number;
  rupees:     number;
  count:      number;
  color:      string;
  pctOfTotal: number;
}

export function OutflowChart({ slices }: Props) {
  const data: RechartsSlice[] = slices.map((s) => ({
    kind:       s.kind,
    label:      s.label,
    paise:      Number(s.amount),
    rupees:     Number(s.amount) / 100,
    count:      s.count,
    color:      KIND_COLOR[s.kind],
    pctOfTotal: 0,
  }));
  const total = data.reduce((sum, d) => sum + d.paise, 0);
  for (const d of data) d.pctOfTotal = total > 0 ? (d.paise / total) : 0;

  const empty = total === 0;

  return (
    <div className="w-full">
      <div className="mb-4">
        <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim mb-0.5">Where money goes</div>
        <div className="font-display text-[24px] font-semibold tabular-nums text-text leading-none">
          {empty ? "—" : `${data.length} categor${data.length === 1 ? "y" : "ies"}`}
        </div>
      </div>

      {empty ? (
        <div className="h-[180px] grid place-items-center text-center text-[12px] text-text-faint px-4">
          Nothing paid out yet.<br />
          Salary + expenses will show here as they land.
        </div>
      ) : (
        <div className="grid grid-cols-[180px_1fr] items-center gap-4">
          <div className="h-[180px] w-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="rupees"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={80}
                  paddingAngle={2}
                  stroke="var(--color-surface)"
                  strokeWidth={2}
                >
                  {data.map((d) => (
                    <Cell key={d.kind} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <ul className="space-y-2">
            {data.map((d) => (
              <li key={d.kind} className="flex items-baseline justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-block w-2.5 h-2.5 rounded-[2px] shrink-0" style={{ background: d.color }} />
                  <span className="text-[12.5px] text-text truncate">{d.label}</span>
                </div>
                <div className="flex items-baseline gap-2 whitespace-nowrap">
                  <span className="text-[11.5px] text-text-dim tabular">
                    {Math.round(d.pctOfTotal * 100)}%
                  </span>
                  <span className="text-[12px] text-text tabular font-medium">
                    {formatINR(BigInt(Math.round(d.paise)))}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface TooltipPayload { payload: RechartsSlice }
function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0]!.payload;
  return (
    <div className="rounded-[8px] bg-surface border border-rule px-3 py-2 shadow-lg">
      <div className="text-[11px] text-text-dim tracking-[0.06em] mb-1">{p.label}</div>
      <div className="text-[13px] text-text tabular">
        {formatINR(BigInt(Math.round(p.paise)))}
      </div>
      <div className="text-[10.5px] text-text-dim tabular mt-0.5">
        {p.count} entr{p.count === 1 ? "y" : "ies"} · {Math.round(p.pctOfTotal * 100)}%
      </div>
    </div>
  );
}

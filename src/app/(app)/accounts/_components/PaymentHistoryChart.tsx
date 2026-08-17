"use client";

// 12-month payment-received bar chart. Data is serialized to strings
// on the server so BigInt can cross the RSC boundary; converted back
// to Number here (safe: paise totals for a month at Indian SME scale
// fit comfortably in a JS Number).

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";
import { formatINR } from "@/kernel/money/format";

export interface HistoryPoint {
  monthKey: string;
  label:    string;
  amount:   string;  // BigInt paise, stringified
  count:    number;
}

interface Props { points: HistoryPoint[] }

interface RechartsPoint {
  monthKey: string;
  label:    string;
  paise:    number;
  rupees:   number;
  count:    number;
  isCurrent: boolean;
}

export function PaymentHistoryChart({ points }: Props) {
  const data: RechartsPoint[] = points.map((p, i) => ({
    monthKey:  p.monthKey,
    label:     p.label,
    paise:     Number(p.amount),
    rupees:    Number(p.amount) / 100,
    count:     p.count,
    isCurrent: i === points.length - 1,
  }));

  const total = data.reduce((s, d) => s + BigInt(Math.round(d.paise)), 0n);
  const bestMonth = data.reduce((max, d) => (d.rupees > max.rupees ? d : max), data[0] ?? { label: "—", rupees: 0 } as RechartsPoint);

  return (
    <div className="w-full">
      {/* Sub-heading strip */}
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim mb-0.5">Last 12 months received</div>
          <div className="font-display text-[24px] font-semibold tabular-nums text-text leading-none">
            {formatINR(total)}
          </div>
        </div>
        {bestMonth.rupees > 0 && (
          <div className="text-right">
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim mb-0.5">Best month</div>
            <div className="text-[13px] text-text tabular">
              {bestMonth.label} · {formatINR(BigInt(Math.round(bestMonth.rupees * 100)))}
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="w-full h-[220px] -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 8, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--color-rule)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--color-text-dim)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--color-rule)" }}
            />
            <YAxis
              tickFormatter={(v: number) => shortRupees(v)}
              tick={{ fill: "var(--color-text-dim)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={54}
            />
            <Tooltip
              cursor={{ fill: "var(--color-surface-hover)" }}
              content={<CustomTooltip />}
            />
            <Bar dataKey="rupees" radius={[4, 4, 0, 0]} maxBarSize={44}>
              {data.map((d) => (
                <Cell
                  key={d.monthKey}
                  fill={d.isCurrent ? "var(--color-gold)" : "var(--color-gold-tint)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Compact rupees for axis labels: 1.2L, 45k, 2.5Cr, etc.
function shortRupees(rupees: number): string {
  if (rupees === 0) return "₹0";
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(1)}Cr`;
  if (rupees >= 100_000)    return `₹${(rupees / 100_000).toFixed(1)}L`;
  if (rupees >= 1_000)      return `₹${(rupees / 1_000).toFixed(0)}k`;
  return `₹${rupees.toFixed(0)}`;
}

// Simple tooltip: "Aug — ₹1,20,000 · 4 payments"
interface TooltipPayload { payload: RechartsPoint }
function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0]!.payload;
  return (
    <div className="rounded-[8px] bg-surface border border-rule px-3 py-2 shadow-lg">
      <div className="text-[11px] text-text-dim tracking-[0.06em] mb-1">{p.label}</div>
      <div className="text-[13px] text-text tabular">
        {formatINR(BigInt(Math.round(p.rupees * 100)))}
      </div>
      <div className="text-[10.5px] text-text-dim tabular mt-0.5">
        {p.count === 0
          ? "no payments"
          : `${p.count} payment${p.count === 1 ? "" : "s"}`}
      </div>
    </div>
  );
}

"use client";

// Donut chart showing what fraction of the last 12 months' receipts
// arrived via each payment mode (UPI, Cash, NEFT, etc.). Reads at a
// glance — the biggest slice is the money's main channel.

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatINR } from "@/kernel/money/format";

export interface ModeSlice {
  mode:   string;
  amount: string;   // BigInt paise, stringified
  count:  number;
}

interface Props { slices: ModeSlice[] }

// Fixed colour per mode so it stays consistent across renders.
// Palette picked to look good against the dark surface + fall back
// gracefully on the light theme.
const MODE_COLOR: Record<string, string> = {
  UPI:    "oklch(0.72 0.115 85)",   // gold — the dominant channel in India
  CASH:   "oklch(0.72 0.115 25)",   // warm terracotta
  NEFT:   "oklch(0.68 0.13 245)",   // deep blue
  RTGS:   "oklch(0.62 0.14 210)",   // teal-blue
  CHEQUE: "oklch(0.66 0.11 155)",   // sage green
  CARD:   "oklch(0.7  0.12 305)",   // muted violet
};
const DEFAULT_COLOR = "oklch(0.55 0.04 265)";

const MODE_LABEL: Record<string, string> = {
  UPI:    "UPI",
  CASH:   "Cash",
  NEFT:   "NEFT (Bank)",
  RTGS:   "RTGS (Bank)",
  CHEQUE: "Cheque",
  CARD:   "Card",
};

interface RechartsSlice {
  mode:      string;
  label:     string;
  paise:     number;
  rupees:    number;
  count:     number;
  color:     string;
  pctOfTotal: number;
}

export function PaymentModeChart({ slices }: Props) {
  const rechartsData: RechartsSlice[] = slices.map((s) => ({
    mode:       s.mode,
    label:      MODE_LABEL[s.mode] ?? s.mode,
    paise:      Number(s.amount),
    rupees:     Number(s.amount) / 100,
    count:      s.count,
    color:      MODE_COLOR[s.mode] ?? DEFAULT_COLOR,
    pctOfTotal: 0,   // filled below
  }));
  const total = rechartsData.reduce((s, d) => s + d.paise, 0);
  for (const d of rechartsData) d.pctOfTotal = total > 0 ? (d.paise / total) : 0;

  const empty = total === 0;

  return (
    <div className="w-full">
      {/* Sub-heading strip */}
      <div className="mb-4">
        <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim mb-0.5">How you're paid</div>
        <div className="font-display text-[24px] font-semibold tabular-nums text-text leading-none">
          {empty ? "—" : `${rechartsData.length} mode${rechartsData.length === 1 ? "" : "s"}`}
        </div>
      </div>

      {empty ? (
        <div className="h-[180px] grid place-items-center text-[12px] text-text-faint">
          No payments yet.
        </div>
      ) : (
        <div className="grid grid-cols-[180px_1fr] items-center gap-4">
          {/* Donut */}
          <div className="h-[180px] w-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={rechartsData}
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
                  {rechartsData.map((d) => (
                    <Cell key={d.mode} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend (rows sorted by amount, biggest first — already sorted server-side) */}
          <ul className="space-y-2">
            {rechartsData.map((d) => (
              <li key={d.mode} className="flex items-baseline justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-[2px] shrink-0"
                    style={{ background: d.color }}
                  />
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
        {p.count} payment{p.count === 1 ? "" : "s"} · {Math.round(p.pctOfTotal * 100)}%
      </div>
    </div>
  );
}

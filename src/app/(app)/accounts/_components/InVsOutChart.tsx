"use client";

// "Money in vs money out" — grouped vertical bars over 12 months per
// docs/ACCOUNTS-PAGE.md §7.1. Green for in, muted for out. Every month
// tappable through to that month's transactions.
//
// Uses Recharts — the trend + seasonality read really needs the
// month-by-month view, and Recharts handles the axis + tooltip work
// that plain HTML would fumble.

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, Legend,
} from "recharts";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { formatINR } from "@/kernel/money/format";
import { InfoTip } from "@/components/ui/Tooltip";

export interface InOutPoint {
  monthKey: string;
  label:    string;
  moneyIn:  string;   // BigInt paise
  moneyOut: string;   // BigInt paise
}

interface Props { points: InOutPoint[] }

interface RechartsPoint {
  monthKey: string;
  label:    string;
  in:       number;
  out:      number;
  net:      number;
}

export function InVsOutChart({ points }: Props) {
  const router = useRouter();

  const data: RechartsPoint[] = points.map((p) => {
    const inN  = Number(BigInt(p.moneyIn))  / 100;
    const outN = Number(BigInt(p.moneyOut)) / 100;
    return { monthKey: p.monthKey, label: p.label, in: inN, out: outN, net: inN - outN };
  });

  const totalIn  = points.reduce((s, p) => s + BigInt(p.moneyIn),  0n);
  const totalOut = points.reduce((s, p) => s + BigInt(p.moneyOut), 0n);
  const empty = totalIn === 0n && totalOut === 0n;

  return (
    <section className="rounded-[14px] bg-surface border border-rule p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim mb-0.5">
            Money in vs money out
          </div>
          <div className="font-display text-[22px] font-semibold tabular-nums text-text leading-none">
            {empty ? "—" : `${formatINR(totalIn)} in · ${formatINR(totalOut)} out`}
          </div>
        </div>
        <InfoTip
          label="About Money in vs money out"
          content="12 months of the whole business. Bigger green than muted = you're growing. Tap a month to see every payment in and out for that month."
        />
      </div>

      {empty ? (
        <div className="h-[220px] grid place-items-center text-center text-[12px] text-text-faint">
          No money has moved in or out over the last 12 months yet.
        </div>
      ) : (
        <div className="w-full h-[220px] -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 8, left: 8, bottom: 4 }}
              onClick={(e) => {
                // Recharts' MouseHandlerDataParam types don't include activePayload,
                // but it's there at runtime — cast through unknown to reach it.
                const active = (e as unknown as { activePayload?: { payload?: RechartsPoint }[] })
                  ?.activePayload?.[0]?.payload;
                if (active) {
                  router.push(`/accounts?tab=received&month=${active.monthKey}` as Route);
                }
              }}
            >
              <CartesianGrid strokeDasharray="2 4" stroke="var(--color-rule)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--color-text-dim)", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "var(--color-rule)" }}
              />
              <YAxis
                tickFormatter={shortRupees}
                tick={{ fill: "var(--color-text-dim)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={54}
              />
              <Tooltip cursor={{ fill: "var(--color-surface-hover)" }} content={<InOutTooltip />} />
              <Legend
                iconType="square"
                iconSize={9}
                wrapperStyle={{ fontSize: 11, color: "var(--color-text-dim)", paddingTop: 4 }}
              />
              <Bar dataKey="in"  name="Money in"  radius={[3, 3, 0, 0]} maxBarSize={16} fill="var(--color-solid)">
                {data.map((d) => <Cell key={`in-${d.monthKey}`}  cursor="pointer" />)}
              </Bar>
              <Bar dataKey="out" name="Money out" radius={[3, 3, 0, 0]} maxBarSize={16} fill="var(--color-text-dim)">
                {data.map((d) => <Cell key={`out-${d.monthKey}`} cursor="pointer" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {!empty && (
        <div className="mt-1 text-[10.5px] text-text-dim text-center">
          Tap a month to see every payment in and out for that month.
          <Link
            href={"/accounts?tab=received" as Route}
            className="ml-1 text-accent hover:underline"
          >
            View all →
          </Link>
        </div>
      )}
    </section>
  );
}

function shortRupees(rupees: number): string {
  if (rupees === 0) return "₹0";
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(1)}Cr`;
  if (rupees >= 100_000)    return `₹${(rupees / 100_000).toFixed(1)}L`;
  if (rupees >= 1_000)      return `₹${(rupees / 1_000).toFixed(0)}k`;
  return `₹${rupees.toFixed(0)}`;
}

interface TooltipPayload { payload: RechartsPoint }
function InOutTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0]!.payload;
  return (
    <div className="rounded-[8px] bg-surface border border-rule px-3 py-2 shadow-lg text-[11.5px]">
      <div className="text-text-dim mb-1">{p.label}</div>
      <div className="flex items-baseline justify-between gap-3 mb-0.5">
        <span className="text-solid">In</span>
        <span className="tabular-nums">{formatINR(BigInt(Math.round(p.in * 100)))}</span>
      </div>
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span className="text-text-dim">Out</span>
        <span className="tabular-nums">{formatINR(BigInt(Math.round(p.out * 100)))}</span>
      </div>
      <div className="pt-1 border-t border-rule flex items-baseline justify-between gap-3">
        <span className="text-text-dim">Net</span>
        <span className={`tabular-nums font-medium ${p.net >= 0 ? "text-solid" : "text-bad"}`}>
          {p.net < 0 ? "−" : ""}{formatINR(BigInt(Math.round(Math.abs(p.net) * 100)))}
        </span>
      </div>
    </div>
  );
}

"use client";

// "How people pay you" — one bar per payment mode over the last 12
// months. Answers §7.4's question: are cheques 40% of collections?
// Is cash unusually high?
//
// Plain HTML bars (not Recharts) — one bar per row, width proportional
// to the mode's share of total money in. Each row is a link to the
// Received tab filtered by mode.

import Link from "next/link";
import type { Route } from "next";
import { formatINR } from "@/kernel/money/format";
import { InfoTip } from "@/components/ui/Tooltip";

export interface PayModeSlice {
  mode:   string;   // CASH | UPI | NEFT | RTGS | CHEQUE | CARD
  amount: string;   // BigInt paise, stringified
  count:  number;
}

interface Props { modes: PayModeSlice[] }

// Mode → (label, tone). NEFT + RTGS are grouped as "Bank" in the label
// but kept as separate rows so the filter query stays exact.
const LABEL: Record<string, string> = {
  UPI:    "UPI",
  CASH:   "Cash",
  NEFT:   "Bank transfer (NEFT)",
  RTGS:   "Bank transfer (RTGS)",
  CHEQUE: "Cheque",
  CARD:   "Card",
};
const TONE: Record<string, string> = {
  UPI:    "bg-gold",
  CASH:   "bg-heat",
  NEFT:   "bg-info",
  RTGS:   "bg-info",
  CHEQUE: "bg-solid",
  CARD:   "bg-accent",
};

export function HowPeoplePayBars({ modes }: Props) {
  const nums = modes.map((m) => ({ ...m, n: Number(BigInt(m.amount)) }));
  const total = nums.reduce((s, x) => s + x.n, 0);
  const totalBig = nums.reduce((s, x) => s + BigInt(x.amount), 0n);
  const max = Math.max(1, ...nums.map((n) => n.n));

  return (
    <section className="rounded-[14px] bg-surface border border-rule p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim mb-0.5">
            How people pay you
          </div>
          <div className="font-display text-[22px] font-semibold tabular-nums text-text leading-none">
            {formatINR(totalBig)}
          </div>
        </div>
        <InfoTip
          label="About How people pay you"
          content="Money received this year, split by how each payment came in. Cheques and cash need more handling than UPI or bank transfers."
        />
      </div>

      {total === 0 ? (
        <div className="py-6 text-center text-[12px] text-text-faint">
          No payments received in the last 12 months.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {nums.map((m) => {
            const pct   = total > 0 ? (m.n / total) * 100 : 0;
            const width = (m.n / max) * 100;
            return (
              <li key={m.mode}>
                <Link
                  href={`/accounts?tab=received&mode=${m.mode}` as Route}
                  className="group block"
                >
                  <div className="flex items-baseline justify-between text-[11.5px] mb-1">
                    <span className="text-text truncate">{LABEL[m.mode] ?? m.mode}</span>
                    <span className="tabular-nums whitespace-nowrap">
                      <span className="text-text-dim mr-1.5">{Math.round(pct)}%</span>
                      <span className="text-text font-medium">{formatINR(BigInt(m.amount))}</span>
                    </span>
                  </div>
                  <div className="h-3 rounded-[3px] bg-surface-2 overflow-hidden">
                    <div
                      className={`${TONE[m.mode] ?? "bg-text-dim"} h-full transition-all group-hover:brightness-110`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <div className="mt-0.5 text-[10px] text-text-dim tabular-nums">
                    {m.count} payment{m.count === 1 ? "" : "s"}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

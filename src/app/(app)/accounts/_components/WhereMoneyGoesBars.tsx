"use client";

// Ranked horizontal bars — top 8 expense heads over the last 12 months,
// tail collapsed into "Other". Answers §7.3's "what am I spending on?"
// Not a pie chart (§7.3 rules): humans can't compare pie slices, ranked
// bars are read instantly.

import Link from "next/link";
import type { Route } from "next";
import { formatINR } from "@/kernel/money/format";
import { InfoTip } from "@/components/ui/Tooltip";

export interface ExpenseHeadUI {
  head:   string;
  amount: string;   // BigInt paise, stringified
  count:  number;
}

interface Props { heads: ExpenseHeadUI[] }

const TOP_N = 8;

export function WhereMoneyGoesBars({ heads }: Props) {
  // Collapse tail into "Other" after the first TOP_N heads.
  const top = heads.slice(0, TOP_N);
  const tail = heads.slice(TOP_N);
  const tailSum = tail.reduce((s, h) => s + BigInt(h.amount), 0n);
  const tailCount = tail.reduce((s, h) => s + h.count, 0);
  const ui: ExpenseHeadUI[] = tailCount > 0
    ? [...top, { head: "Other", amount: tailSum.toString(), count: tailCount }]
    : top;

  const nums = ui.map((h) => ({ ...h, n: Number(BigInt(h.amount)) }));
  const total = nums.reduce((s, x) => s + x.n, 0);
  const totalBig = nums.reduce((s, x) => s + BigInt(x.amount), 0n);
  const max = Math.max(1, ...nums.map((n) => n.n));

  return (
    <section className="rounded-[14px] bg-surface border border-rule p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim mb-0.5">
            Where the money goes
          </div>
          <div className="font-display text-[22px] font-semibold tabular-nums text-text leading-none">
            {formatINR(totalBig)}
          </div>
        </div>
        <InfoTip
          label="About Where the money goes"
          content="Everything you spent in the last 12 months, grouped by what it went toward. Ranked biggest first."
        />
      </div>

      {total === 0 ? (
        <div className="py-6 text-center text-[12px] text-text-faint">
          No expenses recorded in the last 12 months.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {nums.map((h) => {
            const pct   = total > 0 ? (h.n / total) * 100 : 0;
            const width = (h.n / max) * 100;
            const isOther = h.head === "Other";
            return (
              <li key={h.head}>
                <Link
                  href={`/accounts?tab=spending&head=${encodeURIComponent(h.head)}` as Route}
                  className="group block"
                >
                  <div className="flex items-baseline justify-between text-[11.5px] mb-1">
                    <span className={isOther ? "text-text-dim italic" : "text-text truncate"}>
                      {h.head}
                    </span>
                    <span className="tabular-nums whitespace-nowrap">
                      <span className="text-text-dim mr-1.5">{Math.round(pct)}%</span>
                      <span className="text-text font-medium">{formatINR(BigInt(h.amount))}</span>
                    </span>
                  </div>
                  <div className="h-3 rounded-[3px] bg-surface-2 overflow-hidden">
                    <div
                      className={`h-full transition-all group-hover:brightness-110 ${isOther ? "bg-text-dim" : "bg-accent"}`}
                      style={{ width: `${width}%` }}
                    />
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

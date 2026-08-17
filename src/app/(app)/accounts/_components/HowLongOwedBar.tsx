"use client";

// One stacked horizontal bar answering "how bad is my outstanding?"
// per docs/ACCOUNTS-PAGE.md §7.2. Four segments: not-yet-due / 0–30
// late / 31–60 late / 60+ late. Each segment is a tappable link that
// takes the user to the To Collect tab filtered to that bucket.
//
// Not a Recharts chart — plain HTML because that's clearer and lets
// each segment be a proper <Link> (accessible, right-clickable,
// keyboard-navigable).

import Link from "next/link";
import type { Route } from "next";
import { formatINR } from "@/kernel/money/format";
import { InfoTip } from "@/components/ui/Tooltip";

export interface HowLongOwedSegment {
  key:    "current" | "d0_30" | "d31_60" | "d60p";
  label:  string;   // "Not yet due", "0–30 late", "31–60 late", "60+ late"
  amount: string;   // BigInt paise, stringified
}

interface Props { segments: HowLongOwedSegment[] }

const TONE: Record<HowLongOwedSegment["key"], string> = {
  current:  "bg-solid",
  d0_30:    "bg-heat",
  d31_60:   "bg-warn",
  d60p:     "bg-fault",
};

export function HowLongOwedBar({ segments }: Props) {
  // Convert to numbers for the width math; keep bigint for formatting.
  const nums = segments.map((s) => ({ ...s, n: Number(BigInt(s.amount)) }));
  const total = nums.reduce((s, x) => s + x.n, 0);
  const totalBig = nums.reduce((s, x) => s + BigInt(x.amount), 0n);

  return (
    <section className="rounded-[14px] bg-surface border border-rule p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim mb-0.5">
            How long they've owed
          </div>
          <div className="font-display text-[22px] font-semibold tabular-nums text-text leading-none">
            {formatINR(totalBig)}
          </div>
        </div>
        <InfoTip
          label="About How long they've owed"
          content="Split of everything currently owed to you by how old the bill is. Bigger red slice = more urgent problem."
        />
      </div>

      {total === 0 ? (
        <div className="py-6 text-center text-[12px] text-text-faint">
          Nobody currently owes you money.
        </div>
      ) : (
        <>
          <div className="flex h-6 rounded-[6px] overflow-hidden bg-surface-2">
            {nums.map((s) => {
              const pct = (s.n / total) * 100;
              if (pct === 0) return null;
              return (
                <Link
                  key={s.key}
                  href={`/accounts?tab=to-collect&bucket=${s.key}` as Route}
                  className={`${TONE[s.key]} hover:brightness-110 transition-all`}
                  style={{ width: `${pct}%` }}
                  title={`${s.label} — ${formatINR(BigInt(s.amount))}`}
                  aria-label={`${s.label}: ${formatINR(BigInt(s.amount))}`}
                />
              );
            })}
          </div>

          <ul className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-[11px]">
            {nums.map((s) => (
              <li key={s.key} className="flex items-baseline gap-1.5 min-w-0">
                <span className={`w-2 h-2 rounded-[2px] shrink-0 ${TONE[s.key]}`} />
                <span className="text-text-dim truncate">{s.label}</span>
                <span className="ml-auto text-text tabular-nums font-medium whitespace-nowrap">
                  {formatINR(BigInt(s.amount))}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

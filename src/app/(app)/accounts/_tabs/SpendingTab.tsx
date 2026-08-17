// "Spending" tab — every outflow row + a period toggle + a
// where-the-money-goes ranked-bar chart for the same period.
// Chart click-through drills into a head filter.

import Link from "next/link";
import type { Route } from "next";
import { devContext } from "@/lib/dev-context";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import { can } from "@/kernel/rbac/guard";
import { loadSpending, type SpendingPeriod } from "@/modules/accounts/spending";
import { WhereMoneyGoesBars, type ExpenseHeadUI } from "../_components/WhereMoneyGoesBars";

interface Props {
  ctx:    Awaited<ReturnType<typeof devContext>>;
  period: SpendingPeriod;
  head?:  string;
}

const KIND_LABEL: Record<string, string> = {
  EXPENSE:         "Overhead",
  PROJECT_EXPENSE: "Project",
  SALARY:          "Salary",
};
const KIND_TONE: Record<string, string> = {
  EXPENSE:         "bg-warn/10 text-warn",
  PROJECT_EXPENSE: "bg-accent/10 text-accent",
  SALARY:          "bg-info/10 text-info",
};

export async function SpendingTab({ ctx, period, head }: Props) {
  if (!can(ctx, "expense.view")) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule px-6 py-14 text-center">
        <div className="text-[13.5px] text-text mb-1.5">You don't have permission to see this.</div>
        <p className="text-[11.5px] text-text-dim">
          Spending is only visible to Owner and Accounts roles.
        </p>
      </div>
    );
  }

  const bundle = await loadSpending(ctx, { period, ...(head && { head }) });

  // Build the ranked-bars chart from the same rows (so drilling in
  // narrows both the list AND the chart).
  const chartHeads = buildChartHeads(bundle.rows);

  return (
    <>
      {/* Header — total + period toggle */}
      <div className="mb-4 flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-text-dim mb-0.5">
            {head ? `Spending on ${head}` : "Spending"}
          </div>
          <div className="font-display text-[26px] font-semibold tabular-nums text-text leading-none">
            {formatINR(bundle.total)}
          </div>
          <div className="mt-1 text-[11.5px] text-text-dim">
            {periodLabel(period)}
            {head && (
              <>
                {" · "}
                <Link
                  href={`/accounts?tab=spending&period=${period}` as Route}
                  className="text-accent hover:underline"
                >
                  Clear head filter ×
                </Link>
              </>
            )}
          </div>
        </div>
        <PeriodChips active={period} head={head} />
      </div>

      {/* Where the money goes — same period as the list */}
      <div className="mb-5">
        <WhereMoneyGoesBars heads={chartHeads} />
      </div>

      {/* Row list */}
      {bundle.rows.length === 0 ? (
        <div className="rounded-[14px] bg-surface border border-rule px-6 py-14 text-center">
          <div className="text-[13.5px] text-text mb-1.5">Nothing spent in this window.</div>
          <p className="text-[11.5px] text-text-dim">
            {head ? `No "${head}" spending in ${periodLabel(period)}.` : `No expenses, project spend or salaries recorded in ${periodLabel(period)}.`}
          </p>
        </div>
      ) : (
        <section className="rounded-[14px] bg-surface border border-rule overflow-hidden">
          <div className="flex items-baseline justify-between gap-3 px-5 py-3 border-b border-rule">
            <div className="text-[13px] font-medium text-text">Every row</div>
            <div className="text-[11px] text-text-dim tabular">
              {bundle.rows.length} row{bundle.rows.length === 1 ? "" : "s"}
            </div>
          </div>
          <ul className="divide-y divide-rule/60">
            {bundle.rows.map((r) => (
              <li key={r.id} className="px-5 py-3.5 flex items-baseline justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium uppercase tracking-[0.06em] ${KIND_TONE[r.kind]}`}>
                      {KIND_LABEL[r.kind]}
                    </span>
                    <div className="text-[13px] text-text truncate">{r.label}</div>
                  </div>
                  <div className="text-[11px] text-text-dim">
                    <span>{r.head}</span>
                    {r.projectName && (
                      <>
                        <span className="mx-1.5 opacity-40">·</span>
                        <span>{r.projectName}</span>
                      </>
                    )}
                    <span className="mx-1.5 opacity-40">·</span>
                    <span className="tabular">{formatDate(r.date)}</span>
                  </div>
                </div>
                <div className="tabular text-[13.5px] text-text font-medium whitespace-nowrap">
                  −{formatINR(r.amount)}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

// ── Chips ────────────────────────────────────────────────────────

function PeriodChips({ active, head }: { active: SpendingPeriod; head?: string }) {
  const items: Array<{ key: SpendingPeriod; label: string }> = [
    { key: "this-month",    label: "This month" },
    { key: "last-3-months", label: "Last 3 months" },
    { key: "this-year",     label: "This year" },
  ];
  const suffix = head ? `&head=${encodeURIComponent(head)}` : "";
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => {
        const isActive = active === it.key;
        return (
          <Link
            key={it.key}
            href={`/accounts?tab=spending&period=${it.key}${suffix}` as Route}
            className={[
              "inline-flex items-center h-8 px-3 rounded-[8px] text-[11.5px] font-medium transition-colors border",
              isActive
                ? "bg-gold/10 border-gold text-text"
                : "border-rule text-text-dim hover:text-text hover:border-text-dim",
            ].join(" ")}
          >
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}

function periodLabel(p: SpendingPeriod): string {
  return p === "this-month" ? "this month" : p === "last-3-months" ? "last 3 months" : "this year";
}

/** Group rows by head → sum → sorted desc, for the chart. */
function buildChartHeads(rows: Array<{ head: string; amount: bigint }>): ExpenseHeadUI[] {
  const m = new Map<string, { amount: bigint; count: number }>();
  for (const r of rows) {
    const cur = m.get(r.head) ?? { amount: 0n, count: 0 };
    cur.amount += r.amount;
    cur.count  += 1;
    m.set(r.head, cur);
  }
  return [...m.entries()]
    .map(([head, v]) => ({ head, amount: v.amount.toString(), count: v.count }))
    .sort((a, b) => (BigInt(b.amount) > BigInt(a.amount) ? 1 : BigInt(b.amount) < BigInt(a.amount) ? -1 : 0));
}

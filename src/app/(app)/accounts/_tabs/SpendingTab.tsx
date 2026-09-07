// "Spending" tab — every outflow row + a period toggle + a
// where-the-money-goes ranked-bar chart for the same period.
// Chart click-through drills into a head filter.

import Link from "next/link";
import type { Route } from "next";
import { devContext } from "@/lib/dev-context";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import { can } from "@/kernel/rbac/guard";
import { loadSpending, type SpendingPeriod, type SpendingApproval } from "@/modules/accounts/spending";
import { WhereMoneyGoesBars, type ExpenseHeadUI } from "../_components/WhereMoneyGoesBars";
import { ModePill } from "../_components/ModePill";
import { DeleteExpenseButton } from "../_components/DeleteExpenseButton";
import {
  NewExpenseSection, NewExpenseButton, NewExpensePanel,
} from "../_components/NewExpenseForm";

interface Props {
  ctx:       Awaited<ReturnType<typeof devContext>>;
  period:    SpendingPeriod;
  head?:     string;
  approval?: SpendingApproval;
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

export async function SpendingTab({ ctx, period, head, approval = "APPROVED" }: Props) {
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

  const bundle = await loadSpending(ctx, { period, approval, ...(head && { head }) });

  // Deleting is for a row that should never have been typed. Salaries
  // are excluded — those come out of a payroll run and are corrected
  // there, not here.
  const canDelete = can(ctx, "expense.delete");

  // Build the ranked-bars chart from the same rows (so drilling in
  // narrows both the list AND the chart).
  const chartHeads = buildChartHeads(bundle.rows);

  return (
    <>
      {/* The trigger sits in the header row; the form renders full-width
          beneath it. Both are inside NewExpenseSection, which owns the
          open state — see NewExpenseForm.tsx for why they are split. */}
      <NewExpenseSection>
      {/* Header — total + period toggle + New expense button */}
      <div className="mb-4 flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-text-dim mb-0.5">
            {approval === "PENDING"
              ? (head ? `Waiting for approval — ${head}` : "Waiting for approval")
              : (head ? `Expenses on ${head}` : "Expenses")}
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
                  href={`/accounts?tab=spending&period=${period}${approval === "PENDING" ? "&approval=PENDING" : ""}` as Route}
                  className="text-accent hover:underline"
                >
                  Clear head filter ×
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PeriodChips active={period} head={head} approval={approval} />
          <ApprovalChips active={approval} head={head} period={period} />
          <NewExpenseButton />
        </div>
      </div>

      <NewExpensePanel />
      </NewExpenseSection>

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
                  {/* How it was paid. Only overhead expenses carry one —
                      project expenses and salaries record no tender — so
                      the row simply omits the pill rather than printing
                      an em dash on two thirds of the list. */}
                  {r.mode && (
                    <div className="mt-1.5">
                      <ModePill mode={r.mode} />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="tabular text-[13.5px] text-text font-medium whitespace-nowrap">
                    −{formatINR(r.amount)}
                  </div>
                  {canDelete && r.kind !== "SALARY" && (
                    <DeleteExpenseButton expenseId={stripKindPrefix(r.id)} label={r.label} />
                  )}
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

function PeriodChips({ active, head, approval }: { active: SpendingPeriod; head?: string; approval: SpendingApproval }) {
  const items: Array<{ key: SpendingPeriod; label: string }> = [
    { key: "this-month",    label: "This month" },
    { key: "last-3-months", label: "Last 3 months" },
    { key: "this-year",     label: "This year" },
  ];
  const suffix = (head ? `&head=${encodeURIComponent(head)}` : "")
    + (approval === "PENDING" ? "&approval=PENDING" : "");
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

/** Approved / Waiting for approval. The Attention strip already links
 *  here with `approval=PENDING`; until now nothing read the parameter,
 *  so an expense awaiting approval had no screen at all — and therefore
 *  no way to be deleted if it was typed by mistake. */
function ApprovalChips({ active, head, period }: { active: SpendingApproval; head?: string; period: SpendingPeriod }) {
  const items: Array<{ key: SpendingApproval; label: string }> = [
    { key: "APPROVED", label: "Approved" },
    { key: "PENDING",  label: "Waiting for approval" },
  ];
  const headSuffix = head ? `&head=${encodeURIComponent(head)}` : "";
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => {
        const isActive = active === it.key;
        const approvalSuffix = it.key === "PENDING" ? "&approval=PENDING" : "";
        return (
          <Link
            key={it.key}
            href={`/accounts?tab=spending&period=${period}${headSuffix}${approvalSuffix}` as Route}
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

/** loadSpending prefixes row ids `exp:` / `prj:` / `pay:` so one list can
 *  carry three tables. The delete action wants the bare id. */
function stripKindPrefix(id: string): string {
  const i = id.indexOf(":");
  return i === -1 ? id : id.slice(i + 1);
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

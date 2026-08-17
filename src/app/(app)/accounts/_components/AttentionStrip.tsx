import Link from "next/link";
import type { Route } from "next";
import { formatINR } from "@/kernel/money/format";
import { AlertCircle, ChevronRight } from "lucide-react";

interface Props {
  chequesPending:    { count: number; amount: string };   // BigInt paise, stringified
  expensesPending:   { count: number; amount: string };
  unmatchedReceipts: { count: number; amount: string };
}

/** Only renders if any of the three counts is > 0. A zero-state
 *  strip is noise — the whole point is to nudge the owner when
 *  something needs a decision. */
export function AttentionStrip({ chequesPending, expensesPending, unmatchedReceipts }: Props) {
  const items: AttentionItem[] = [];

  if (chequesPending.count > 0) items.push({
    key:    "cheques",
    label:  `${chequesPending.count} cheque${chequesPending.count === 1 ? "" : "s"} not yet cleared`,
    amount: chequesPending.amount,
    href:   "/accounts?tab=received&mode=CHEQUE&status=PENDING",
  });
  if (expensesPending.count > 0) items.push({
    key:    "expenses",
    label:  `${expensesPending.count} expense${expensesPending.count === 1 ? "" : "s"} waiting for approval`,
    amount: expensesPending.amount,
    href:   "/accounts?tab=spending&approval=PENDING",
  });
  if (unmatchedReceipts.count > 0) items.push({
    key:    "unmatched",
    label:  `${unmatchedReceipts.count} payment${unmatchedReceipts.count === 1 ? "" : "s"} not matched to any bill`,
    amount: unmatchedReceipts.amount,
    href:   "/accounts?tab=received&unmatched=1",
  });

  if (items.length === 0) return null;

  return (
    <section className="rounded-[14px] bg-surface border border-warn/40 overflow-hidden">
      <div className="px-5 py-3 border-b border-rule flex items-center gap-2">
        <AlertCircle size={14} strokeWidth={1.8} className="text-warn" />
        <div className="text-[12.5px] font-medium text-text">Needs your attention</div>
      </div>
      <ul className="divide-y divide-rule/60">
        {items.map((it) => (
          <li key={it.key}>
            <Link
              href={it.href as Route}
              className="flex items-center gap-3 px-5 py-3 hover:bg-surface-hover transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-warn shrink-0" aria-hidden />
              <span className="flex-1 min-w-0 text-[12.5px] text-text truncate">{it.label}</span>
              <span className="tabular-nums text-[12.5px] text-text font-medium whitespace-nowrap">
                {formatINR(BigInt(it.amount))}
              </span>
              <ChevronRight size={13} className="text-text-dim shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface AttentionItem {
  key:    string;
  label:  string;
  amount: string;
  href:   string;
}

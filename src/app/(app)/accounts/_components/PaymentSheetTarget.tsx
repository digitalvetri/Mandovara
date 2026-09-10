"use client";

// "What is this payment for?"
//
// The single most important question on the payment sheet, and the one the
// old sheet never asked. It offered the client's open bills and nothing
// else, so money taken against an agreed quotation — which is how this
// studio is paid for most of a job's life — went in attached to nothing and
// surfaced in Accounts → Received as "not matched to a bill".
//
// A payment goes against ONE thing: a job, or the client's open bills. Not
// both. A payment that genuinely covers two is two payments, and saying so
// keeps every figure on the money pages traceable to one agreement.

import { formatINR } from "@/kernel/money/format";
import type { OpenProject, PaymentTarget } from "./_receipt-primitives";

interface Props {
  projects:  OpenProject[];
  billCount: number;
  billTotal: bigint;
  value:     PaymentTarget | null;
  onChange:  (t: PaymentTarget) => void;
}

export function PaymentSheetTarget({ projects, billCount, billTotal, value, onChange }: Props) {
  // Nothing to choose between — the caller hides the card entirely.
  if (projects.length === 0 && billCount === 0) return null;

  const isBills = value?.kind === "bills";

  return (
    <div className="rounded-[14px] border border-rule bg-surface p-5">
      <div className="mb-3 text-[11px] uppercase tracking-[0.14em] text-text-dim">
        What is this for?
      </div>

      <div className="space-y-2">
        {projects.map((p) => {
          const active = value?.kind === "project" && value.projectId === p.id;
          return (
            <Option
              key={p.id}
              active={active}
              onClick={() => onChange({ kind: "project", projectId: p.id })}
              title={p.name}
              sub={
                p.quotationNumber
                  ? `Quoted ${formatINR(p.agreedValue)} · ${formatINR(p.received)} received`
                  : `${formatINR(p.agreedValue)} agreed · ${formatINR(p.received)} received`
              }
              amount={formatINR(p.due)}
              amountLabel="still to come"
            />
          );
        })}

        {billCount > 0 && (
          <Option
            active={isBills}
            onClick={() => onChange({ kind: "bills" })}
            title={billCount === 1 ? "An open bill" : `${billCount} open bills`}
            sub="Money against invoices already raised"
            amount={formatINR(billTotal)}
            amountLabel="unpaid"
          />
        )}
      </div>
    </div>
  );
}

function Option({
  active, onClick, title, sub, amount, amountLabel,
}: {
  active: boolean; onClick: () => void;
  title: string; sub: string; amount: string; amountLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "flex w-full items-center gap-3 rounded-[10px] border px-3.5 py-3 text-left transition-colors",
        active
          ? "border-gold bg-gold/10"
          : "border-rule hover:border-text-dim",
      ].join(" ")}
    >
      <span
        aria-hidden
        className={[
          "grid h-4 w-4 shrink-0 place-items-center rounded-full border",
          active ? "border-gold" : "border-rule",
        ].join(" ")}
      >
        {active && <span className="h-2 w-2 rounded-full bg-gold" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] text-text">{title}</span>
        <span className="mt-0.5 block truncate text-[11.5px] tabular text-text-dim">{sub}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-[13px] tabular text-text">{amount}</span>
        <span className="block text-[10.5px] uppercase tracking-[0.1em] text-text-dim">{amountLabel}</span>
      </span>
    </button>
  );
}

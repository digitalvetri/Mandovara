"use client";

import { formatINR } from "@/kernel/money/format";

interface Totals {
  subtotal: bigint;
  gst: bigint;
  total: bigint;
}

interface Props {
  totals: Totals;
  isIntraState: boolean;
  serverError: string | null;
  pending: boolean;
  onSend: () => void;
}

export function QuoteSummaryPanel({ totals, isIntraState, serverError, pending, onSend }: Props) {
  return (
    <aside className="rounded-[14px] bg-surface border border-rule p-5 sm:p-6 h-fit">
      <div className="font-display text-[20px] font-semibold text-text mb-4">Summary</div>

      <dl className="space-y-3 text-[12.5px]">
        <SummaryRow k="Subtotal" v={formatINR(totals.subtotal)} />
        <SummaryRow k={`GST${isIntraState ? "" : " (IGST)"}`} v={formatINR(totals.gst)} />
        <div className="pt-3 mt-2 border-t border-rule flex items-baseline justify-between">
          <dt className="text-text uppercase text-[10.5px] tracking-[0.14em]">Total</dt>
          <dd className="font-display text-[24px] sm:text-[28px] font-semibold text-accent tabular-nums leading-none">
            {formatINR(totals.total)}
          </dd>
        </div>
      </dl>

      {serverError && (
        <div className="mt-3 text-[11.5px] text-bad">{serverError}</div>
      )}

      <button
        type="button"
        onClick={onSend}
        disabled={pending}
        className="mt-5 w-full h-[42px] rounded-[10px] bg-accent text-white text-[13px] font-medium hover:bg-accent-hover disabled:opacity-60 transition-colors"
      >
        {pending ? "Saving…" : "Send Quote to Client"}
      </button>
      <button
        type="button"
        disabled
        className="mt-2 w-full h-[42px] rounded-[10px] bg-transparent border border-rule text-text-dim text-[13px] font-medium hover:bg-surface-hover disabled:opacity-70"
        title="PDF template ships with Session 16"
      >
        Download PDF
      </button>

      <p className="mt-3 text-[10.5px] text-text-faint">
        Numbers here are a live preview. The server re-computes GST per line
        on save so anything you post is audit-safe.
      </p>
    </aside>
  );
}

function SummaryRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-dim text-[12px]">{k}</dt>
      <dd className="text-text text-right tabular font-medium">{v}</dd>
    </div>
  );
}

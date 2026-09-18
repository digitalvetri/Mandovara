"use client";

// "Give discount" on the project's Payment ledger — for when the client
// closes the account for less than the quote (owner, 2026-09-18).
//
// Rendered only for holders of project.discount and only before the job is
// billed; setProjectDiscount / clearProjectDiscount check both again on the
// server. The amount is what the studio lets go, GST included — the same
// kind of figure as "Still to collect".

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgePercent, IndianRupee, Loader2, X } from "lucide-react";
import { formatINR } from "@/kernel/money/format";
import { clearProjectDiscount, setProjectDiscount } from "@/modules/projects/actions-discount";

interface Props {
  projectId: string;
  /** Paise, as strings — BigInt does not cross the server boundary. */
  quoted:    string;
  received:  string;
  discount:  string;
  reason:    string | null;
}

export function SettlementDiscountButton(props: Props) {
  const [open, setOpen] = useState(false);
  const hasDiscount = BigInt(props.discount) > 0n;
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-gold/40 bg-gold/10 px-3 text-[12px] font-medium text-gold transition-colors hover:bg-gold/20"
      >
        <BadgePercent size={12} strokeWidth={2.2} />
        {hasDiscount ? "Discount given" : "Give discount"}
      </button>
      {/* Mounted only while open, so each opening starts from saved values. */}
      {open && <DiscountModal {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function DiscountModal({
  projectId, quoted, received, discount, reason, onClose,
}: Props & { onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const quotedP   = BigInt(quoted);
  const receivedP = BigInt(received);
  const currentP  = BigInt(discount);
  // What is left before any discount — the most that can be let go.
  const leftP     = quotedP - receivedP > 0n ? quotedP - receivedP : 0n;

  const [amount, setAmount] = useState(paiseToRupees(currentP > 0n ? currentP : leftP));
  const [why, setWhy]       = useState(reason ?? "");

  // Preview only. The server parses the amount itself (parseINR, BigInt).
  const typedP = toPaise(amount);
  const after  = typedP == null ? null : leftP - typedP;

  function save(e: React.FormEvent): void {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await setProjectDiscount({ projectId, amount: amount.trim(), reason: why.trim() });
      if (!res.ok) { setError(res.error ?? "Could not save the discount"); return; }
      onClose();
      router.refresh();
    });
  }

  function remove(): void {
    setError(null);
    start(async () => {
      const res = await clearProjectDiscount({ projectId });
      if (!res.ok) { setError(res.error ?? "Could not remove the discount"); return; }
      onClose();
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Discount to close the account"
      onClick={(e) => { e.stopPropagation(); if (!pending) onClose(); }}
      onKeyDown={(e) => { if (e.key === "Escape" && !pending) onClose(); }}
    >
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] space-y-4 rounded-[14px] border border-rule bg-surface p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-display text-[17px] font-semibold text-text">Discount to close the account</div>
            <div className="mt-0.5 text-[12px] text-text-dim">
              The client pays less than the quote and the rest is let go.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-text-dim hover:bg-surface-2"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <dl className="space-y-1.5 rounded-[8px] border border-rule bg-surface-2 px-3 py-2.5 text-[12.5px]">
          <Line k="Quoted"   v={formatINR(quotedP)} />
          <Line k="Received" v={formatINR(receivedP)} />
          <Line k="Left to collect before discount" v={formatINR(leftP)} strong />
        </dl>

        <div>
          <label className="mb-1 block text-[10.5px] uppercase tracking-[0.12em] text-text-dim">
            Discount amount (₹, GST included)
          </label>
          <div className="flex h-[36px] overflow-hidden rounded-[6px] border border-rule bg-surface-2 focus-within:border-gold">
            <span className="flex shrink-0 items-center border-r border-rule px-3">
              <IndianRupee size={12} className="text-text-dim" />
            </span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              autoFocus
              className="flex-1 bg-transparent px-3 text-[13.5px] tabular outline-none"
            />
          </div>
          {after != null && (
            <div className={`mt-1.5 text-[11.5px] ${after < 0n ? "text-fault" : "text-text-dim"}`}>
              {after < 0n
                ? "That is more than is left to collect."
                : after === 0n
                  ? "The account will be closed — nothing left to collect."
                  : `${formatINR(after)} will still be left to collect.`}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-[10.5px] uppercase tracking-[0.12em] text-text-dim">
            Reason
          </label>
          <input
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            maxLength={300}
            placeholder="e.g. Final settlement agreed with client"
            className="h-[34px] w-full rounded-[6px] border border-rule bg-surface-2 px-2.5 text-[12.5px] text-text outline-none focus:border-gold"
          />
        </div>

        <p className="text-[11px] leading-relaxed text-text-dim">
          The invoice raised for this job will bill the discounted amount.
        </p>

        {error && (
          <div className="rounded-[6px] border border-fault/30 bg-fault/10 px-3 py-2 text-[11.5px] text-fault">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <div>
            {currentP > 0n && (
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className="h-[32px] rounded-[7px] px-3 text-[12px] text-fault hover:bg-fault/10 disabled:opacity-50"
              >
                Remove discount
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-[32px] rounded-[7px] border border-rule px-4 text-[12px] text-text-dim hover:border-text-dim"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || !why.trim() || typedP == null || typedP <= 0n}
              className="inline-flex h-[32px] items-center gap-1.5 rounded-[7px] bg-gold px-4 text-[12px] font-semibold text-ink hover:bg-gold-strong disabled:opacity-50"
            >
              {pending && <Loader2 size={12} className="animate-spin" />}
              {currentP > 0n ? "Save discount" : "Give discount"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Line({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-dim">{k}</dt>
      <dd className={`tabular text-right ${strong ? "font-semibold text-text" : "text-text"}`}>{v}</dd>
    </div>
  );
}

/** 741000n → "7410". BigInt arithmetic, no float (CLAUDE.md #8). */
function paiseToRupees(p: bigint): string {
  if (p <= 0n) return "";
  const r = p / 100n;
  const f = p % 100n;
  return f === 0n ? r.toString() : `${r}.${f.toString().padStart(2, "0")}`;
}

/** "7,410.5" → 741050n for the preview line; null when unreadable. String
 *  arithmetic only — the same no-float rule as the server's parseINR. */
function toPaise(s: string): bigint | null {
  const t = s.replace(/[,\s₹]/g, "");
  const m = /^(\d+)(?:\.(\d{0,2}))?$/.exec(t);
  if (!m) return null;
  return BigInt(m[1]!) * 100n + BigInt((m[2] ?? "").padEnd(2, "0") || "0");
}

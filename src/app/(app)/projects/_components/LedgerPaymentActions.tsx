"use client";

// Edit / Delete on a payment row of the project's payment ledger.
//
// Owner request, 2026-10-24: "I need an option for editing the payment
// ledger and also a delete option for wrongly entered details, and this
// should be done only by the admin." Shown only to holders of receipt.edit
// / receipt.delete — the Owner by default — and both server actions check
// the same keys, so hiding the buttons is a courtesy, not the rule.
//
// Delete reuses the two-step control from Client 360, so a payment is
// removed the same way wherever it is removed from.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { parseINR } from "@/kernel/money/format";
import { updateReceipt } from "@/modules/receipts/actions-edit";
import { PAYMENT_MODES } from "@/modules/receipts/schema";
import { DeletePaymentButton } from "../../clients/_components/DeletePaymentButton";

const MODE_LABEL: Record<string, string> = {
  CASH: "Cash", UPI: "UPI", NEFT: "NEFT", RTGS: "RTGS", CHEQUE: "Cheque", CARD: "Card",
};

interface Props {
  id:          string;
  number:      string;
  /** ISO date of the payment. */
  date:        string;
  /** Paise, as a string — BigInt does not cross into a client component. */
  amount:      string;
  mode:        string;
  reference:   string | null;
  bounced:     boolean;
  canEdit:     boolean;
  canDelete:   boolean;
}

/** Paise → "20000" or "20000.50" for the input box. */
function rupeesText(paise: string): string {
  const p = BigInt(paise);
  const r = p / 100n, c = p % 100n;
  return c === 0n ? r.toString() : `${r}.${c.toString().padStart(2, "0")}`;
}

/** ISO → YYYY-MM-DD in India time, for the date input. */
function dateInput(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

const FIELD =
  "w-full h-[36px] rounded-[8px] border border-rule bg-transparent px-3 text-[12.5px] text-text outline-none focus:border-accent";

export function LedgerPaymentActions(p: Props) {
  const router = useRouter();
  const [open, setOpen]         = useState(false);
  const [date, setDate]         = useState(dateInput(p.date));
  const [amount, setAmount]     = useState(rupeesText(p.amount));
  const [mode, setMode]         = useState(p.mode);
  const [reference, setRef]     = useState(p.reference ?? "");
  const [error, setError]       = useState<string | null>(null);
  const [pending, start]        = useTransition();

  if (!p.canEdit && !p.canDelete) return null;

  function openEditor(): void {
    setDate(dateInput(p.date));
    setAmount(rupeesText(p.amount));
    setMode(p.mode);
    setRef(p.reference ?? "");
    setError(null);
    setOpen(true);
  }

  function save(e: React.FormEvent): void {
    e.preventDefault();
    setError(null);
    let paise: bigint;
    try { paise = parseINR(amount); } catch { setError("Enter the amount in rupees, e.g. 20000"); return; }
    if (paise <= 0n) { setError("Amount must be more than zero"); return; }
    start(async () => {
      const res = await updateReceipt({
        id: p.id, date, mode, reference, amount: paise.toString(),
      });
      if (!res.ok) { setError(res.error ?? "Could not save the payment"); return; }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {p.canEdit && !p.bounced && (
        <button
          type="button"
          onClick={openEditor}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-[6px] text-text-dim hover:bg-accent/10 hover:text-accent"
          aria-label={`Edit payment ${p.number}`}
          title="Edit this payment"
        >
          <Pencil size={13} />
        </button>
      )}
      {p.canDelete && <DeletePaymentButton id={p.id} number={p.number} />}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Edit payment ${p.number}`}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/60 p-4 backdrop-blur-[2px] sm:items-center"
          onClick={(e) => { if (e.target === e.currentTarget && !pending) setOpen(false); }}
        >
          <form
            onSubmit={save}
            className="w-full max-w-[420px] overflow-hidden rounded-[14px] border border-rule bg-surface text-left shadow-xl"
          >
            <div className="border-b border-rule px-5 py-4">
              <div className="text-[14px] font-semibold text-text">Edit payment</div>
              <div className="mt-0.5 text-[12px] tabular-nums text-text-dim">{p.number}</div>
            </div>

            <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-2">
              <label className="block">
                <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Date</div>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={`${FIELD} tabular`} />
              </label>
              <label className="block">
                <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Amount (₹)</div>
                <input
                  type="text" inputMode="decimal" value={amount}
                  onChange={(e) => setAmount(e.target.value)} required className={`${FIELD} tabular`}
                />
              </label>
              <label className="block">
                <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Paid by</div>
                <select value={mode} onChange={(e) => setMode(e.target.value)} className={FIELD}>
                  {PAYMENT_MODES.map((m) => <option key={m} value={m}>{MODE_LABEL[m] ?? m}</option>)}
                </select>
              </label>
              <label className="block">
                <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Reference (optional)</div>
                <input
                  type="text" value={reference} maxLength={80}
                  onChange={(e) => setRef(e.target.value)}
                  placeholder="UPI ref, cheque no." className={FIELD}
                />
              </label>
            </div>

            <p className="px-5 pb-3 text-[11px] text-text-faint">
              The change is recorded in the audit log with the old figures.
            </p>

            {error && (
              <div className="mx-5 mb-4 rounded-[8px] border border-fault/40 bg-fault/5 px-3 py-2 text-[11.5px] leading-snug text-fault">
                {error}
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 border-t border-rule px-5 py-3.5 sm:flex-row sm:justify-end">
              <button
                type="button" disabled={pending} onClick={() => setOpen(false)}
                className="h-9 rounded-[8px] border border-rule px-4 text-[12.5px] text-text-dim transition-colors hover:text-text disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit" disabled={pending}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] bg-accent px-4 text-[12.5px] font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {pending && <Loader2 size={12} className="animate-spin" />}
                {pending ? "Saving…" : "Save payment"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

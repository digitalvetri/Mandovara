"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, IndianRupee } from "lucide-react";
import { createReceipt } from "@/modules/receipts/actions";
import { PAYMENT_MODES } from "@/modules/receipts/schema";

export interface OpenInvoiceStub {
  id: string;
  number: string;
  outstanding: string; // paise as string
}

// Oldest-first automatic allocation — fills each invoice until the
// payment is exhausted; remainder goes to unallocated on the receipt.
function buildAllocations(
  paise: bigint,
  invoices: OpenInvoiceStub[],
): Array<{ invoiceId: string; amount: string }> {
  const result: Array<{ invoiceId: string; amount: string }> = [];
  let remaining = paise;
  for (const inv of invoices) {
    if (remaining <= 0n) break;
    const cap   = BigInt(inv.outstanding);
    const alloc = remaining < cap ? remaining : cap;
    result.push({ invoiceId: inv.id, amount: alloc.toString() });
    remaining -= alloc;
  }
  return result;
}

interface Props {
  open: boolean;
  onClose: () => void;
  clientId: string;
  branchId: string;
  openInvoices: OpenInvoiceStub[];
}

export function RecordPaymentModal({
  open, onClose, clientId, branchId, openInvoices,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState("UPI");

  if (!open) return null;

  const today = new Date().toISOString().slice(0, 10);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const rupeesRaw = (fd.get("amount") as string).replace(/,/g, "").trim();
    const rupees    = parseFloat(rupeesRaw);
    if (!rupeesRaw || isNaN(rupees) || rupees <= 0) {
      setError("Enter a valid amount greater than ₹0."); return;
    }
    const paise = BigInt(Math.round(rupees * 100));
    setError(null);

    startTransition(async () => {
      const res = await createReceipt({
        clientId,
        branchId,
        date:        (fd.get("date") as string) || today,
        mode:        fd.get("mode") as string,
        reference:   (fd.get("reference") as string) || undefined,
        chequeDate:  (fd.get("chequeDate") as string) || undefined,
        amount:      paise.toString(),
        allocations: buildAllocations(paise, openInvoices),
      });
      if (!res.ok) { setError(res.error ?? "Could not record payment"); return; }
      onClose();
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] rounded-[14px] bg-surface border border-rule p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="font-display text-[17px] font-semibold">Record Payment</div>
          <button type="button" onClick={onClose}
            className="p-1 rounded hover:bg-surface-2 transition-colors">
            <X size={16} className="text-text-dim" />
          </button>
        </div>

        {/* Open invoice summary — shows what the payment will cover */}
        {openInvoices.length > 0 && (
          <div className="rounded-[8px] bg-surface-2 border border-rule px-3 py-2.5 space-y-1">
            <div className="text-[10px] uppercase tracking-[0.12em] text-text-faint mb-1.5">
              Outstanding invoices
            </div>
            {openInvoices.map((inv) => (
              <div key={inv.id} className="flex justify-between text-[11.5px]">
                <span className="text-text-dim tabular">{inv.number}</span>
                <span className="text-text tabular font-medium">{rsFromPaise(inv.outstanding)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <Field label="Amount received (₹)">
            <div className="flex h-[36px] border border-rule rounded-[6px] bg-surface-2 focus-within:border-accent overflow-hidden">
              <span className="px-3 flex items-center border-r border-rule shrink-0">
                <IndianRupee size={12} className="text-text-dim" />
              </span>
              <input
                name="amount"
                required
                autoFocus
                inputMode="decimal"
                placeholder="0.00"
                className="flex-1 px-3 bg-transparent text-[13.5px] tabular outline-none"
              />
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input
                type="date"
                name="date"
                defaultValue={today}
                required
                className={inp}
              />
            </Field>
            <Field label="Mode">
              <select
                name="mode"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className={inp}
              >
                {PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m.charAt(0) + m.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label={mode === "CHEQUE" ? "Cheque number" : "UTR / reference (optional)"}>
            <input name="reference" placeholder="Optional" className={inp} />
          </Field>

          {mode === "CHEQUE" && (
            <Field label="Cheque date">
              <input type="date" name="chequeDate" className={inp} />
            </Field>
          )}
        </div>

        {error && (
          <div className="rounded-[6px] bg-fault/10 border border-fault/30 px-3 py-2 text-[11.5px] text-fault">
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <button type="button" onClick={onClose}
            className="h-[32px] px-4 rounded-[7px] text-[12px] text-text-dim border border-rule hover:border-text-dim transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={pending}
            className="h-[32px] px-4 rounded-[7px] text-[12px] font-semibold bg-accent text-ink hover:bg-accent-strong disabled:opacity-50 transition-colors">
            {pending ? "Recording…" : "Record Payment"}
          </button>
        </div>
      </form>
    </div>
  );
}

function rsFromPaise(paise: string): string {
  return "₹" + (Number(paise) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 0, maximumFractionDigits: 2,
  });
}

const inp =
  "w-full h-[34px] px-2.5 rounded-[6px] border border-rule bg-surface-2 text-[12.5px] text-text outline-none focus:border-accent";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10.5px] uppercase tracking-[0.12em] text-text-dim mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

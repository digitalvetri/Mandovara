"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, IndianRupee } from "lucide-react";
import { createReceipt } from "@/modules/receipts/actions";
import { PAYMENT_MODES } from "@/modules/receipts/schema";
// The same "What is this for?" picker the Accounts payment sheet uses, so
// a payment recorded here lands on a job exactly as one recorded there.
import { PaymentSheetTarget } from "../../accounts/_components/PaymentSheetTarget";
import {
  toOpenProjects, type OpenProjectWire, type PaymentTarget,
} from "../../accounts/_components/_receipt-primitives";

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
  /** The client's jobs with money still to come on their quotation.
   *  Omitted by callers that only offer bills (the project page). */
  openProjects?: OpenProjectWire[];
}

const NO_PROJECTS: OpenProjectWire[] = [];

/** Jobs first — under the quotation-first flow that is where nearly all
 *  money lands. Bills only when there are no jobs to put it against. */
function defaultTarget(projects: OpenProjectWire[], billCount: number): PaymentTarget | null {
  if (projects.length > 0) return { kind: "project", projectId: projects[0]!.id };
  if (billCount > 0) return { kind: "bills" };
  return null;
}

export function RecordPaymentModal({
  open, onClose, clientId, branchId, openInvoices, openProjects = NO_PROJECTS,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState("UPI");
  const [picked, setTarget] = useState<PaymentTarget | null>(
    () => defaultTarget(openProjects, openInvoices.length),
  );
  // The modal stays mounted between openings, and a job paid off since the
  // last one drops out of the list — never submit against a stale pick.
  const target =
    picked?.kind === "project" && !openProjects.some((p) => p.id === picked.projectId)
      ? defaultTarget(openProjects, openInvoices.length)
      : picked?.kind === "bills" && openInvoices.length === 0
        ? defaultTarget(openProjects, 0)
        : picked;

  if (!open) return null;

  const projects  = toOpenProjects(openProjects);
  const billTotal = openInvoices.reduce((s, i) => s + BigInt(i.outstanding), 0n);
  // Something to choose between → a choice is required. A client with no
  // open job and no open bill has nowhere specific to put the money.
  const needsTarget = projects.length > 0 || openInvoices.length > 0;

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
    if (needsTarget && !target) {
      setError("Choose which project this payment is for."); return;
    }
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
        // A payment goes against ONE thing. Against a job it carries the
        // projectId and stays off the bills — it is swept onto the tax
        // invoice when that is raised. Against bills, oldest-first as before.
        ...(target?.kind === "project" ? { projectId: target.projectId } : {}),
        allocations: target?.kind === "project" ? [] : buildAllocations(paise, openInvoices),
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
        className="w-full max-w-[480px] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[14px] bg-surface border border-rule p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="font-display text-[17px] font-semibold">Record Payment</div>
          <button type="button" onClick={onClose}
            className="p-1 rounded hover:bg-surface-2 transition-colors">
            <X size={16} className="text-text-dim" />
          </button>
        </div>

        <PaymentSheetTarget
          projects={projects}
          billCount={openInvoices.length}
          billTotal={billTotal}
          value={target}
          onChange={setTarget}
        />

        {/* Open invoice summary — shows what the payment will cover */}
        {target?.kind === "bills" && openInvoices.length > 0 && (
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

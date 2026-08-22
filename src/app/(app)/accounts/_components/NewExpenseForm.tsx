"use client";

// "New expense" form — opens as a compact card that expands from the button.
// Head + description + amount + date + optional GST capture.
// GST fields (rate, vendor GSTIN, bill ref) are collapsed behind a toggle
// so the common case (no GST / exempt) stays fast.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, IndianRupee, X, ChevronDown } from "lucide-react";
import { createExpense } from "@/modules/expenses/actions";
import { GENERAL_EXPENSE_HEADS, GST_RATES } from "@/modules/expenses/schema";
import { safePaise, iso } from "./_receipt-primitives";

export function NewExpenseButton() {
  const [open, setOpen] = useState(false);
  if (open) return <NewExpenseSheet onClose={() => setOpen(false)} />;
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[8px] bg-gold text-ink text-[12.5px] font-semibold hover:bg-gold-strong transition-colors"
    >
      <Plus size={13} strokeWidth={2.5} />
      New expense
    </button>
  );
}

function NewExpenseSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showGst, setShowGst] = useState(false);

  const [head, setHead] = useState<string>(GENERAL_EXPENSE_HEADS[0]);
  const [customHead, setCustomHead] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState<string>(iso(new Date()));

  // GST fields
  const [gstRate, setGstRate] = useState<number>(0);
  const [isInterState, setIsInterState] = useState(false);
  const [vendorGstin, setVendorGstin] = useState("");
  const [billRef, setBillRef] = useState("");

  const usingCustom = head === "__custom__";
  const finalHead   = usingCustom ? customHead.trim() : head;
  const totalPaise  = safePaise(amount);

  // Live GST preview
  const taxablePaise = gstRate > 0 && totalPaise > 0n
    ? (totalPaise * 100n) / BigInt(100 + gstRate)
    : null;
  const gstPaise = taxablePaise !== null ? totalPaise - taxablePaise : null;

  const canSubmit = !!finalHead && description.trim().length >= 3 && totalPaise > 0n && !pending;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setFieldErrors({});
    start(async () => {
      const r = await createExpense({
        head:        finalHead,
        description: description.trim(),
        amount:      totalPaise.toString(),
        incurredAt:  date,
        ...(showGst && gstRate > 0 && {
          gstRatePct:   gstRate,
          isInterState,
          ...(vendorGstin.trim() && { vendorGstin: vendorGstin.trim() }),
          ...(billRef.trim()     && { billRef: billRef.trim() }),
        }),
      });
      if (!r.ok) {
        setError(r.error ?? "Could not save the expense");
        setFieldErrors(r.fieldErrors ?? {});
        return;
      }
      setHead(GENERAL_EXPENSE_HEADS[0]);
      setCustomHead(""); setDescription(""); setAmount("");
      setGstRate(0); setVendorGstin(""); setBillRef("");
      setShowGst(false);
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="mb-4 rounded-[14px] bg-surface border border-gold/40 p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.14em] text-gold mb-0.5">New expense</div>
          <div className="text-[12px] text-text-dim">
            Rent, travel, utilities — anything the business paid for that isn't tied to a project.
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-7 w-7 grid place-items-center rounded-[6px] text-text-dim hover:text-text hover:bg-surface-hover"
          aria-label="Close"
        >
          <X size={13} />
        </button>
      </div>

      <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Head */}
        <div className="sm:col-span-1">
          <label className="block text-[11px] text-text-dim mb-1">What was it for?</label>
          <select
            value={head}
            onChange={(e) => setHead(e.target.value)}
            className="w-full h-10 rounded-[8px] border border-rule bg-transparent px-2.5 text-[12.5px] text-text outline-none focus:border-gold"
          >
            {GENERAL_EXPENSE_HEADS.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
            <option value="__custom__">Type another…</option>
          </select>
          {usingCustom && (
            <input
              value={customHead}
              onChange={(e) => setCustomHead(e.target.value)}
              placeholder="e.g. Petrol · Client dinner"
              maxLength={60}
              className="w-full mt-2 h-10 rounded-[8px] border border-rule bg-transparent px-2.5 text-[12.5px] text-text outline-none focus:border-gold"
            />
          )}
        </div>

        {/* Amount */}
        <div className="sm:col-span-1">
          <label className="block text-[11px] text-text-dim mb-1">How much (total paid)?</label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim">
              <IndianRupee size={13} strokeWidth={2} />
            </span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full h-10 rounded-[8px] border border-rule bg-transparent pl-7 pr-2.5 text-[13px] tabular-nums text-text outline-none focus:border-gold"
            />
          </div>
          {fieldErrors["amount"] && (
            <div className="mt-1 text-[10.5px] text-fault">{fieldErrors["amount"]}</div>
          )}
          {/* GST preview */}
          {showGst && gstRate > 0 && taxablePaise !== null && (
            <div className="mt-1.5 text-[10.5px] text-text-dim space-y-0.5">
              <div>Taxable: ₹{(Number(taxablePaise) / 100).toFixed(2)}</div>
              {isInterState
                ? <div>IGST ({gstRate}%): ₹{(Number(gstPaise!) / 100).toFixed(2)}</div>
                : <div>CGST {gstRate/2}% + SGST {gstRate/2}% = ₹{(Number(gstPaise!) / 100).toFixed(2)}</div>
              }
            </div>
          )}
        </div>

        {/* Description */}
        <div className="sm:col-span-2">
          <label className="block text-[11px] text-text-dim mb-1">Note (what exactly)</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder='e.g. "Coimbatore ↔ Chennai for the Alila site visit"'
            maxLength={300}
            className="w-full h-10 rounded-[8px] border border-rule bg-transparent px-2.5 text-[12.5px] text-text outline-none focus:border-gold"
          />
          {fieldErrors["description"] && (
            <div className="mt-1 text-[10.5px] text-fault">{fieldErrors["description"]}</div>
          )}
        </div>

        {/* Date */}
        <div className="sm:col-span-1">
          <label className="block text-[11px] text-text-dim mb-1">When?</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full h-10 rounded-[8px] border border-rule bg-transparent px-2.5 text-[12.5px] text-text tabular-nums outline-none focus:border-gold"
          />
        </div>

        {/* GST toggle */}
        <div className="sm:col-span-1 flex items-end">
          <button
            type="button"
            onClick={() => setShowGst((v) => !v)}
            className="inline-flex items-center gap-1.5 h-10 px-3 rounded-[8px] border border-rule text-[12px] text-text-dim hover:text-text hover:border-gold transition-colors"
          >
            <ChevronDown
              size={12}
              className={`transition-transform ${showGst ? "rotate-180" : ""}`}
            />
            {showGst ? "Hide GST" : "Add GST details"}
          </button>
        </div>

        {/* GST section */}
        {showGst && (
          <>
            {/* GST Rate */}
            <div className="sm:col-span-1">
              <label className="block text-[11px] text-text-dim mb-1">GST rate</label>
              <select
                value={gstRate}
                onChange={(e) => setGstRate(Number(e.target.value))}
                className="w-full h-10 rounded-[8px] border border-rule bg-transparent px-2.5 text-[12.5px] text-text outline-none focus:border-gold"
              >
                {GST_RATES.map((r) => (
                  <option key={r} value={r}>{r === 0 ? "Exempt / nil" : `${r}%`}</option>
                ))}
              </select>
            </div>

            {/* Inter-state toggle */}
            {gstRate > 0 && (
              <div className="sm:col-span-1 flex items-end">
                <label className="inline-flex items-center gap-2 cursor-pointer h-10">
                  <input
                    type="checkbox"
                    checked={isInterState}
                    onChange={(e) => setIsInterState(e.target.checked)}
                    className="h-4 w-4 rounded border-rule accent-gold"
                  />
                  <span className="text-[12px] text-text-dim">Out-of-state purchase (IGST)</span>
                </label>
              </div>
            )}

            {/* Vendor GSTIN */}
            <div className="sm:col-span-1">
              <label className="block text-[11px] text-text-dim mb-1">Vendor GSTIN (optional)</label>
              <input
                value={vendorGstin}
                onChange={(e) => setVendorGstin(e.target.value.toUpperCase())}
                placeholder="33AABCM1234Q1Z5"
                maxLength={15}
                className="w-full h-10 rounded-[8px] border border-rule bg-transparent px-2.5 text-[12.5px] tabular-nums text-text outline-none focus:border-gold"
              />
            </div>

            {/* Vendor bill ref */}
            <div className="sm:col-span-1">
              <label className="block text-[11px] text-text-dim mb-1">Vendor invoice no. (optional)</label>
              <input
                value={billRef}
                onChange={(e) => setBillRef(e.target.value)}
                placeholder="e.g. INV/2026-27/0048"
                maxLength={50}
                className="w-full h-10 rounded-[8px] border border-rule bg-transparent px-2.5 text-[12.5px] text-text outline-none focus:border-gold"
              />
            </div>
          </>
        )}

        {error && (
          <div className="sm:col-span-2 rounded-[8px] border border-fault/40 bg-fault/5 px-3 py-2 text-[11.5px] text-fault">
            {error}
          </div>
        )}

        <div className="sm:col-span-2 flex justify-end gap-2 mt-1">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-[8px] text-[12.5px] text-text-dim hover:text-text transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 h-10 px-5 rounded-[8px] bg-gold text-ink text-[13px] font-semibold hover:bg-gold-strong disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {pending && <Loader2 size={12} className="animate-spin" />}
            Save expense
          </button>
        </div>
      </form>
    </div>
  );
}

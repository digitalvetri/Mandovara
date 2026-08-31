"use client";

// "New expense" — a trigger that lives in the tab header, and a form that
// does NOT.
//
// The button used to replace ITSELF with the whole form. Its call site sits
// inside the header's `flex items-center gap-2` row, next to the period
// chips, so a five-field card was being laid out in a slot sized for a
// chip: the fields collapsed into a narrow right-hand column and left half
// the row empty. Nothing was wrong with the form — it was the container.
//
// So the two are split. `NewExpenseSection` owns the open state and renders
// the trigger inline where the header wants it, then the form as a
// full-width row of its own beneath. Head + note + amount + date, with GST
// (rate, vendor GSTIN, bill ref) behind a toggle so the common case —
// no GST, or exempt — stays a four-field form.

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, IndianRupee, X, ChevronDown } from "lucide-react";
import { createExpense } from "@/modules/expenses/actions";
import { GENERAL_EXPENSE_HEADS } from "@/modules/expenses/schema";
import {
  GstFields, GstPreview, expenseFieldCls, expenseLabelCls,
} from "./_expense-gst";
import { safePaise, iso } from "./_receipt-primitives";

// Shared between the trigger and the form so the two can sit in different
// places in the tree without the parent having to be a client component.
const ExpenseFormCtx = createContext<{
  open: boolean;
  setOpen: (v: boolean) => void;
} | null>(null);

function useExpenseForm() {
  const ctx = useContext(ExpenseFormCtx);
  if (!ctx) throw new Error("NewExpenseButton/Panel must be inside NewExpenseSection");
  return ctx;
}

/** Wraps the part of the tab that contains both the trigger and the form. */
export function NewExpenseSection({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <ExpenseFormCtx.Provider value={{ open, setOpen }}>
      {children}
    </ExpenseFormCtx.Provider>
  );
}

/** The trigger. Belongs in the header row, beside the period chips. */
export function NewExpenseButton() {
  const { open, setOpen } = useExpenseForm();
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-expanded={open}
      className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[8px] text-[12.5px] font-semibold transition-colors ${
        open
          ? "border border-rule text-text-dim hover:text-text"
          : "bg-gold text-ink hover:bg-gold-strong"
      }`}
    >
      <Plus
        size={13}
        strokeWidth={2.5}
        className={`transition-transform ${open ? "rotate-45" : ""}`}
      />
      {open ? "Close" : "New expense"}
    </button>
  );
}

/** The form. Belongs on a row of its own, at full width. */
export function NewExpensePanel() {
  const { open, setOpen } = useExpenseForm();
  if (!open) return null;
  return <NewExpenseSheet onClose={() => setOpen(false)} />;
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
    <div className="mb-5 overflow-hidden rounded-[14px] border border-gold/40 bg-surface">
      <div className="flex items-start justify-between gap-3 border-b border-gold/25 bg-gold/[0.06] px-5 py-3.5">
        <div>
          <div className="mb-0.5 text-[10.5px] uppercase tracking-[0.14em] text-gold">New expense</div>
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

      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-x-4 gap-y-3.5 p-5 sm:grid-cols-12">
        {/* Head */}
        <div className="sm:col-span-5">
          <label className={expenseLabelCls}>What was it for?</label>
          <select
            value={head}
            onChange={(e) => setHead(e.target.value)}
            className={expenseFieldCls}
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
              className={`${expenseFieldCls} mt-2`}
            />
          )}
        </div>

        {/* Amount */}
        <div className="sm:col-span-3">
          <label className="mb-1 block text-[11px] text-text-dim">
            How much (total paid)? <span className="text-fault">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim">
              <IndianRupee size={13} strokeWidth={2} />
            </span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className={`${expenseFieldCls} pl-7 tabular-nums`}
            />
          </div>
          {fieldErrors["amount"] && (
            <div className="mt-1 text-[10.5px] text-fault">{fieldErrors["amount"]}</div>
          )}
          {showGst && (
            <GstPreview
              totalPaise={totalPaise} gstRate={gstRate} isInterState={isInterState}
            />
          )}
        </div>

        {/* Description */}
        <div className="sm:col-span-12">
          <label className="mb-1 block text-[11px] text-text-dim">
            Note (what exactly) <span className="text-fault">*</span>
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder='e.g. "Coimbatore ↔ Chennai for the Alila site visit"'
            maxLength={300}
            className={expenseFieldCls}
          />
          {fieldErrors["description"] && (
            <div className="mt-1 text-[10.5px] text-fault">{fieldErrors["description"]}</div>
          )}
        </div>

        {/* Date */}
        <div className="sm:col-span-4">
          <label className={expenseLabelCls}>When?</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`${expenseFieldCls} tabular-nums`}
          />
        </div>

        {/* GST toggle */}
        <div className="flex items-end sm:col-span-8">
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

        {/* GST section — four fields, one idea. See _expense-gst.tsx. */}
        {showGst && (
          <GstFields
            gstRate={gstRate} setGstRate={setGstRate}
            isInterState={isInterState} setIsInterState={setIsInterState}
            vendorGstin={vendorGstin} setVendorGstin={setVendorGstin}
            billRef={billRef} setBillRef={setBillRef}
          />
        )}

        {error && (
          <div className="sm:col-span-12 rounded-[8px] border border-fault/40 bg-fault/5 px-3 py-2 text-[11.5px] text-fault">
            {error}
          </div>
        )}

        {/* Footer. On a phone the hint reads first and the buttons stack
            with Save on top (thumb reach); on desktop it is hint-left,
            actions-right. */}
        <div className="mt-1 flex flex-col gap-3 border-t border-rule pt-4 sm:col-span-12 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[11px] text-text-dim">
            {canSubmit
              ? "Ready to save."
              : "Pick a head, add a short note and an amount above."}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-[8px] border border-rule px-4 text-[12.5px] text-text-dim transition-colors hover:border-text-dim hover:text-text sm:border-transparent"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[8px] bg-gold px-5 text-[13px] font-semibold text-ink transition-colors hover:bg-gold-strong disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-text-faint"
          >
            {pending && <Loader2 size={12} className="animate-spin" />}
            Save expense
          </button>
          </div>
        </div>
      </form>
    </div>
  );
}

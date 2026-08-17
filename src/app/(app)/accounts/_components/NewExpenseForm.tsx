"use client";

// "New expense" form — opens as a compact card that expands from the
// button. Head + description + amount + date. Optional bill photo (v1
// takes a string reference; upload UX is a Phase-later polish).
//
// Head is a combobox: pick a preset or type a custom one (e.g. "Petrol
// Aug 17"). Presets cover Rohit's common cases including Travel per
// the user's ask.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, IndianRupee, X } from "lucide-react";
import { createExpense } from "@/modules/expenses/actions";
import { GENERAL_EXPENSE_HEADS } from "@/modules/expenses/schema";
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

  const [head, setHead] = useState<string>(GENERAL_EXPENSE_HEADS[0]);
  const [customHead, setCustomHead] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState<string>(iso(new Date()));

  const usingCustom = head === "__custom__";
  const finalHead   = usingCustom ? customHead.trim() : head;
  const totalPaise  = safePaise(amount);
  const canSubmit   = !!finalHead && description.trim().length >= 3 && totalPaise > 0n && !pending;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setFieldErrors({});
    start(async () => {
      const r = await createExpense({
        head:        finalHead,
        description: description.trim(),
        amount:      totalPaise.toString(),
        incurredAt:  date,
      });
      if (!r.ok) {
        setError(r.error ?? "Could not save the expense");
        setFieldErrors(r.fieldErrors ?? {});
        return;
      }
      // Reset + close + refresh
      setHead(GENERAL_EXPENSE_HEADS[0]);
      setCustomHead(""); setDescription(""); setAmount("");
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
          <label className="block text-[11px] text-text-dim mb-1">How much?</label>
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

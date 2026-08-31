"use client";

// My spending — the whole module in one screen.
//
// Deliberately plainer than the business Expenses tab: no GST, no approval,
// no vendor. This is a notebook. The fastest possible path from "I just
// paid for petrol" to it being written down is the only thing that matters,
// so the form is always open and always first.

import { useState, useTransition } from "react";
import { Plus, Loader2, Trash2, IndianRupee } from "lucide-react";
import { addPersonalExpense, deletePersonalExpense } from "@/modules/personal-expenses";
import { PERSONAL_CATEGORIES, type PersonalExpenseRow } from "@/modules/personal-expenses/shared";
import { formatINR } from "@/kernel/money/format";

interface Props {
  rows:       PersonalExpenseRow[];
  total:      bigint;
  byCategory: { category: string; total: bigint }[];
  months:     number;
}

export function PersonalExpenseBoard({ rows, total, byCategory, months }: Props) {
  const [category, setCategory] = useState<string>(PERSONAL_CATEGORIES[0]);
  const [custom, setCustom]     = useState("");
  const [amount, setAmount]     = useState("");
  const [note, setNote]         = useState("");
  const [date, setDate]         = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError]       = useState<string | null>(null);
  const [pending, start]        = useTransition();

  const usingCustom = category === "__custom__";
  const finalCat    = usingCustom ? custom.trim() : category;
  // Rupees in the box, paise on the wire — never a float.
  const paise = Math.round((parseFloat(amount) || 0) * 100);
  const canSave = !!finalCat && paise > 0 && !pending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await addPersonalExpense({
        category: finalCat,
        amount:   String(paise),
        spentAt:  date,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      if (!r.ok) { setError(r.error ?? "Could not save that."); return; }
      setAmount(""); setNote(""); setCustom("");
    });
  }

  function remove(id: string) {
    setError(null);
    start(async () => {
      const r = await deletePersonalExpense(id);
      if (!r.ok) setError(r.error ?? "Could not remove that.");
    });
  }

  const field =
    "h-10 w-full rounded-[8px] border border-rule bg-transparent px-2.5 text-[12.5px] text-text outline-none focus:border-accent";

  return (
    <div className="space-y-4 pb-10">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="overflow-hidden rounded-[14px] border border-rule bg-surface">
          <div className="border-b border-rule px-5 py-3.5">
            <div className="text-[13px] font-medium text-text">Write it down</div>
            <p className="mt-0.5 text-[11.5px] text-text-dim">
              Petrol, lunch, groceries — yours only. This never touches the studio books.
            </p>
          </div>

          <form onSubmit={submit} className="grid grid-cols-1 gap-x-4 gap-y-3.5 p-5 sm:grid-cols-12">
            <div className="sm:col-span-5">
              <label className="mb-1 block text-[11px] text-text-dim" htmlFor="pe-cat">What for?</label>
              <select id="pe-cat" value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
                {PERSONAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="__custom__">Type another…</option>
              </select>
              {usingCustom && (
                <input
                  value={custom} onChange={(e) => setCustom(e.target.value)}
                  placeholder="e.g. Car service" maxLength={40}
                  className={`${field} mt-2`}
                />
              )}
            </div>

            <div className="sm:col-span-3">
              <label className="mb-1 block text-[11px] text-text-dim" htmlFor="pe-amt">
                How much? <span className="text-fault">*</span>
              </label>
              <div className="relative">
                <IndianRupee size={13} strokeWidth={2} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim" />
                <input
                  id="pe-amt" inputMode="decimal" value={amount}
                  onChange={(e) => setAmount(e.target.value)} placeholder="0"
                  className={`${field} pl-7 tabular-nums`}
                />
              </div>
            </div>

            <div className="sm:col-span-4">
              <label className="mb-1 block text-[11px] text-text-dim" htmlFor="pe-date">When?</label>
              <input
                id="pe-date" type="date" value={date}
                onChange={(e) => setDate(e.target.value)} className={`${field} tabular-nums`}
              />
            </div>

            <div className="sm:col-span-12">
              <label className="mb-1 block text-[11px] text-text-dim" htmlFor="pe-note">Note (optional)</label>
              <input
                id="pe-note" value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. petrol, Coimbatore to Pollachi" maxLength={200} className={field}
              />
            </div>

            {error && (
              <div className="rounded-[8px] border border-fault/30 bg-fault/5 px-3 py-2 text-[11.5px] text-fault sm:col-span-12">
                {error}
              </div>
            )}

            <div className="sm:col-span-12">
              <button
                type="submit" disabled={!canSave}
                className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] bg-accent px-5 text-[13px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:bg-surface-2 disabled:text-text-faint sm:w-auto"
              >
                {pending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} strokeWidth={2.5} />}
                Add
              </button>
            </div>
          </form>
        </section>

        <aside className="space-y-4">
          <div className="rounded-[14px] border border-rule bg-surface px-5 py-4">
            <div className="text-[10.5px] uppercase tracking-[0.12em] text-text-dim">
              Spent {months === 1 ? "this month" : `in ${months} months`}
            </div>
            <div className="mt-1 font-display text-[28px] font-semibold tabular-nums leading-none text-text">
              {formatINR(total)}
            </div>
          </div>

          {byCategory.length > 0 && (
            <div className="overflow-hidden rounded-[14px] border border-rule bg-surface">
              <div className="border-b border-rule px-5 py-3 text-[12.5px] font-medium text-text">
                Where it went
              </div>
              <ul className="divide-y divide-rule/60">
                {byCategory.map((c) => (
                  <li key={c.category} className="flex items-baseline justify-between px-5 py-2.5">
                    <span className="text-[12.5px] text-text-dim">{c.category}</span>
                    <span className="tabular text-[12.5px] text-text">{formatINR(c.total)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      <section className="overflow-hidden rounded-[14px] border border-rule bg-surface">
        <div className="flex items-baseline justify-between border-b border-rule px-5 py-3">
          <div className="text-[13px] font-medium text-text">Everything you noted</div>
          <div className="tabular text-[11px] text-text-dim">{rows.length}</div>
        </div>
        {rows.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <div className="text-[13px] text-text-dim">Nothing written down yet.</div>
            <p className="mt-1 text-[11.5px] text-text-faint">Add the last thing you paid for above.</p>
          </div>
        ) : (
          <ul className="divide-y divide-rule/60">
            {rows.map((r) => (
              <li key={r.id} className="flex items-baseline justify-between gap-4 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-text">{r.category}</div>
                  <div className="text-[11px] text-text-dim">
                    {r.note && <>{r.note}<span className="mx-1.5 opacity-40">·</span></>}
                    <span className="tabular">
                      {new Date(r.spentAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </div>
                </div>
                <span className="tabular whitespace-nowrap text-[13.5px] font-medium text-text">
                  −{formatINR(r.amount)}
                </span>
                <button
                  type="button" onClick={() => remove(r.id)} disabled={pending}
                  aria-label={`Remove ${r.category}`}
                  className="shrink-0 text-text-faint transition-colors hover:text-fault disabled:opacity-40"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

"use client";

// Row-level delete for a wrongly-entered expense, in the Spending list.
//
// Not DangerDeleteButton: that one navigates on success, which would
// throw away the period / head / approval filters the user is standing
// in. A row delete should leave the page exactly where it was and just
// drop the row, so this confirms inline — the same two-step shape
// ChequeActionButtons uses — and calls router.refresh().
//
// Only overhead and project expenses get one. Salary rows come from a
// payroll run and are not deletable here; SpendingTab is what decides
// that, this component just does as it is told.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteExpense } from "@/modules/expenses/actions-delete";

interface Props {
  /** Bare expense id — SpendingTab strips the `exp:` / `prj:` prefix. */
  expenseId: string;
  label:     string;
}

export function DeleteExpenseButton({ expenseId, label }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [pending, start]            = useTransition();

  function handleDelete() {
    setError(null);
    start(async () => {
      const res = await deleteExpense(expenseId);
      if (!res.ok) { setError(res.error ?? "Delete failed"); return; }
      setConfirming(false);
      router.refresh();
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => { setError(null); setConfirming(true); }}
        className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-text-dim hover:bg-fault/10 hover:text-fault transition-colors"
        aria-label={`Delete expense ${label}`}
        title="Delete this expense"
      >
        <Trash2 size={13} strokeWidth={1.75} />
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-text-dim">Delete?</span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="h-7 rounded-[6px] bg-fault px-2.5 text-[11px] font-semibold text-white hover:bg-fault/85 disabled:opacity-60 transition-colors"
        >
          {pending ? "Deleting…" : "Yes"}
        </button>
        <button
          type="button"
          onClick={() => { setConfirming(false); setError(null); }}
          disabled={pending}
          className="h-7 rounded-[6px] border border-rule px-2.5 text-[11px] text-text-dim hover:bg-ink/20 disabled:opacity-50 transition-colors"
        >
          No
        </button>
      </div>
      {error && <p className="max-w-[220px] text-right text-[11px] text-fault">{error}</p>}
    </div>
  );
}

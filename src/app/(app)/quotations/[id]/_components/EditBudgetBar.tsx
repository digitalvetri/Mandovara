"use client";

// How many edits are left, and the owner's way to grant three more.
//
// Shown above the editor rather than surfaced when the save fails: an
// employee who has spent two of three edits should know before they start
// rearranging lines, not after the server says no. The block itself is
// enforced server-side in updateQuotationLines — this bar is the courtesy,
// not the rule.

import { useState, useTransition } from "react";
import { Lock, Unlock, Loader2 } from "lucide-react";
import { unlockQuotationEdits } from "@/modules/quotations/actions-status";
import { budgetLabel, checkEditBudget } from "@/modules/quotations/edit-budget";

export function EditBudgetBar({
  quotationId, editCount, canApprove,
}: { quotationId: string; editCount: number; canApprove: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start]  = useTransition();

  const state   = { editCount, canApprove };
  const verdict = checkEditBudget(state);

  // An owner with a full budget has nothing to be told and nothing to do.
  if (canApprove && editCount === 0) return null;

  const exhausted = !verdict.allowed;

  return (
    <div
      className={`mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border px-4 py-2.5 ${
        exhausted
          ? "border-fault/35 bg-fault/5"
          : verdict.remaining === 1
            ? "border-warn/35 bg-warn/5"
            : "border-rule bg-surface-2"
      }`}
    >
      <div className="flex items-center gap-2 text-[12px]">
        {exhausted
          ? <Lock size={13} className="shrink-0 text-fault" />
          : <Unlock size={13} className="shrink-0 text-text-dim" />}
        <span className={exhausted ? "text-fault" : "text-text-dim"}>
          {budgetLabel(state)}
          {canApprove && editCount > 0 && ` · this quotation has used ${editCount}`}
        </span>
      </div>

      {canApprove && editCount > 0 && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            start(async () => {
              const r = await unlockQuotationEdits(quotationId);
              if (!r.ok) setError(r.error ?? "Could not unlock it.");
            });
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-[7px] bg-gold px-3.5 text-[12px] font-semibold text-ink transition-colors hover:bg-gold-strong disabled:opacity-60"
        >
          {pending ? <Loader2 size={12} className="animate-spin" /> : <Unlock size={12} strokeWidth={2.2} />}
          Give 3 more edits
        </button>
      )}

      {error && <div className="w-full text-[11.5px] text-fault">{error}</div>}
    </div>
  );
}

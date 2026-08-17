"use client";

// Small inline button — "Mark paid" — for a row in the To Pay tab.
// Fires markExpensePaid and refreshes the page on success.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { markExpensePaid } from "@/modules/accounts/to-pay-actions";

interface Props {
  expenseId: string;
}

export function MarkPaidButton({ expenseId }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function onClick() {
    if (done || pending) return;
    setError(null);
    start(async () => {
      const r = await markExpensePaid({ expenseId });
      if (!r.ok) { setError(r.error ?? "Could not mark paid"); return; }
      setDone(true);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={onClick}
        disabled={pending || done}
        className={[
          "inline-flex items-center gap-1 h-7 px-2.5 rounded-[6px] text-[11px] font-medium border transition-colors",
          done
            ? "border-solid/30 bg-solid/10 text-solid"
            : "border-rule text-text-dim hover:text-text hover:border-text-dim",
        ].join(" ")}
      >
        {pending && <Loader2 size={10} className="animate-spin" />}
        {done   && <Check size={11} strokeWidth={2.5} />}
        {done ? "Paid" : "Mark paid"}
      </button>
      {error && (
        <span className="text-[10px] text-fault" role="alert">{error}</span>
      )}
    </div>
  );
}

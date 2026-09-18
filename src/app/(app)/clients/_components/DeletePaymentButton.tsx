"use client";

// Trash control on a payment row in "Bills and payments". Two steps — the
// bin asks, the second click deletes — so a stray tap cannot take money
// off the books. Rendered only for holders of receipt.delete; deleteReceipt
// checks the same key server-side.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { deleteReceipt } from "@/modules/receipts/actions-delete";

export function DeletePaymentButton({ id, number }: { id: string; number: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [pending, start]    = useTransition();

  function confirm(): void {
    setError(null);
    start(async () => {
      const res = await deleteReceipt({ id });
      if (!res.ok) { setError(res.error ?? "Could not delete the payment"); return; }
      setAsking(false);
      router.refresh();
    });
  }

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-[6px] text-text-dim hover:bg-fault/10 hover:text-fault"
        aria-label={`Delete payment ${number}`}
        title="Delete this payment"
      >
        <Trash2 size={14} />
      </button>
    );
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <span className="text-[12px] text-fault">Delete?</span>
        <button
          type="button"
          onClick={confirm}
          disabled={pending}
          className="inline-flex h-7 items-center gap-1 rounded-[6px] bg-fault px-2.5 text-[12px] font-semibold text-white disabled:opacity-60"
        >
          {pending && <Loader2 size={12} className="animate-spin" />}
          Delete
        </button>
        <button
          type="button"
          onClick={() => { setAsking(false); setError(null); }}
          disabled={pending}
          className="h-7 rounded-[6px] border border-rule px-2.5 text-[12px] text-text-dim hover:text-text"
        >
          Keep
        </button>
      </div>
      {error && <div className="max-w-[240px] text-right text-[11px] text-fault">{error}</div>}
    </div>
  );
}

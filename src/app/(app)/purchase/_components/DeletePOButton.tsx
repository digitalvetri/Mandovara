"use client";

// Row-level delete for a wrongly-entered purchase order, in the PO list.
//
// Same shape as accounts/_components/DeleteExpenseButton.tsx: an inline
// two-step confirm that stays on the page and drops the row, rather than
// DangerDeleteButton's navigate-away — a row delete inside a filtered,
// paginated list should leave the operator exactly where they were.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deletePO } from "@/modules/purchase/actions-delete";

export function DeletePOButton({ poId, label }: { poId: string; label: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [pending, start]            = useTransition();

  function handleDelete() {
    setError(null);
    start(async () => {
      const res = await deletePO(poId);
      if (!res.ok) { setError(res.error ?? "Delete failed"); return; }
      setConfirming(false);
      router.refresh();
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); setError(null); setConfirming(true); }}
        className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-text-dim hover:bg-fault/10 hover:text-fault transition-colors"
        aria-label={`Delete purchase order ${label}`}
        title="Delete this purchase order"
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
          onClick={(e) => { e.preventDefault(); handleDelete(); }}
          disabled={pending}
          className="h-7 rounded-[6px] bg-fault px-2.5 text-[11px] font-semibold text-white hover:bg-fault/85 disabled:opacity-60 transition-colors"
        >
          {pending ? "Deleting…" : "Yes"}
        </button>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); setConfirming(false); setError(null); }}
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

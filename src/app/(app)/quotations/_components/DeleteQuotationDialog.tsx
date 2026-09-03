"use client";

// The delete-a-quotation confirmation.
//
// Fully controlled — the caller owns `open` and supplies its own
// trigger. That is not ceremony. The first version rendered its own
// trigger AND held its own state, and in the list's ⋯ menu the click
// that opened the modal also closed the popover the modal was rendered
// inside: it unmounted in the same tick and nothing appeared. Hoisting
// the state to the caller is what lets one component serve both the row
// menu and the detail header.
//
// Deliberately NOT window.confirm(): a native dialog blocks the page,
// cannot show the server's refusal ("an order was raised from QT-0142"),
// and reads as a browser alert rather than part of the app. This one
// stays open on failure and says why.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Loader2, AlertTriangle } from "lucide-react";
import { deleteQuotation } from "@/modules/quotations/actions-delete";

interface Props {
  id:      string;
  /** Shown in the confirmation so the user is sure which quote it is. */
  number:  string;
  open:    boolean;
  onClose: () => void;
  /** Where to go after a successful delete. Omit to just refresh. */
  redirectTo?: string;
}

export function DeleteQuotationDialog({
  id, number, open, onClose, redirectTo,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start]  = useTransition();

  function confirm(): void {
    setError(null);
    start(async () => {
      const res = await deleteQuotation(id);
      if (!res.ok) { setError(res.error ?? "Could not delete the quotation"); return; }
      onClose();
      if (redirectTo) router.push(redirectTo as Route);
      router.refresh();
    });
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Delete quotation ${number}`}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/60 p-4 backdrop-blur-[2px] sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget && !pending) onClose(); }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] overflow-hidden rounded-[14px] border border-rule bg-surface shadow-xl"
      >
        <div className="flex items-start gap-3 border-b border-rule px-5 py-4">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-fault/10 text-fault">
            <AlertTriangle size={15} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-text">Delete this quotation?</div>
            <div className="mt-0.5 truncate text-[12px] tabular-nums text-text-dim">{number}</div>
          </div>
        </div>

        <div className="px-5 py-4 text-[12.5px] leading-relaxed text-text-dim">
          The quotation and all of its lines are removed for good. If an order
          was already raised from it, or a later revision points back at it,
          the delete is refused rather than breaking them.
        </div>

        {error && (
          <div className="mx-5 mb-4 rounded-[8px] border border-fault/40 bg-fault/5 px-3 py-2 text-[11.5px] leading-snug text-fault">
            {error}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-rule px-5 py-3.5 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className="h-9 rounded-[8px] border border-rule px-4 text-[12.5px] text-text-dim transition-colors hover:text-text disabled:opacity-60"
          >
            Keep it
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={confirm}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] bg-fault px-4 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending && <Loader2 size={12} className="animate-spin" />}
            {pending ? "Deleting…" : "Delete quotation"}
          </button>
        </div>
      </div>
    </div>
  );
}

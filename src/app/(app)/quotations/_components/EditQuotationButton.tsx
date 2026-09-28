"use client";

// "Edit quotation" — reopen a quotation that has been sent (or approved,
// accepted, expired…) so it can be revised.
//
// Owner request, 2026-09-28. Moving a sent quote back to Draft was already
// possible through the status menu, but nobody reads "Draft" as "edit", so
// the editor looked locked for good once a quote went out. This is the
// same move, named for what it is for, with a confirmation that says what
// happens to the link the client already has.
//
// No new server action: it calls setQuotationStatus, so the usual
// permission gate and the "an order was already raised" refusal apply.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { setQuotationStatus } from "@/modules/quotations/actions-part2";
import { editTargetFor } from "@/modules/quotations/transitions";

interface Props {
  id:          string;
  number:      string;
  current:     string;
  permissions: string[];
}

export function EditQuotationButton({ id, number, current, permissions }: Props) {
  const router = useRouter();
  const [open, setOpen]   = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start]  = useTransition();

  const target = editTargetFor(current);
  if (!target || !permissions.includes("quotation.update")) return null;

  const wasSent = ["SENT", "ACCEPTED", "EXPIRED", "REJECTED"].includes(current);

  function confirm(): void {
    setError(null);
    start(async () => {
      const res = await setQuotationStatus({ id, status: target });
      if (!res.ok) { setError(res.error ?? "Could not open the quotation for editing"); return; }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setError(null); setOpen(true); }}
        className="inline-flex h-[30px] items-center gap-1.5 rounded-[6px] border border-accent/50 px-3 text-[11.5px] font-medium text-accent transition-colors hover:bg-accent/10"
      >
        <Pencil size={12} strokeWidth={1.75} />
        Edit quotation
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Edit quotation ${number}`}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/60 p-4 backdrop-blur-[2px] sm:items-center"
          onClick={(e) => { if (e.target === e.currentTarget && !pending) setOpen(false); }}
        >
          <div className="w-full max-w-[420px] overflow-hidden rounded-[14px] border border-rule bg-surface shadow-xl">
            <div className="flex items-start gap-3 border-b border-rule px-5 py-4">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
                <Pencil size={14} strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-text">Edit this quotation?</div>
                <div className="mt-0.5 truncate text-[12px] tabular-nums text-text-dim">{number}</div>
              </div>
            </div>

            <div className="space-y-2 px-5 py-4 text-[12.5px] leading-relaxed text-text-dim">
              <p>
                It goes back to <span className="font-medium text-text">{target === "DRAFT" ? "Draft" : "Revised"}</span> so
                you can change the items, rates, notes and the valid-until date.
              </p>
              {wasSent && (
                <p>
                  The link the client already has stops opening until you press
                  <span className="font-medium text-text"> Send</span> again with the revised quotation.
                </p>
              )}
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
                onClick={() => setOpen(false)}
                className="h-9 rounded-[8px] border border-rule px-4 text-[12.5px] text-text-dim transition-colors hover:text-text disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={confirm}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] bg-accent px-4 text-[12.5px] font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {pending && <Loader2 size={12} className="animate-spin" />}
                {pending ? "Opening…" : "Edit quotation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

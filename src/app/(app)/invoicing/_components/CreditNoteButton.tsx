"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, AlertTriangle, FileMinus } from "lucide-react";
import { createCreditNote } from "@/modules/invoices/actions-part2";

interface Props {
  invoiceId:     string;
  invoiceNumber: string;
}

export function CreditNoteButton({ invoiceId, invoiceNumber }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen]   = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError]   = useState<string | null>(null);

  function submit() {
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setError("Please give a reason (min 3 chars) — it's a GST audit trail.");
      return;
    }
    setError(null);
    start(async () => {
      const r = await createCreditNote({ invoiceId, reason: trimmed });
      if (!r.ok) { setError(r.error ?? "Could not create credit note"); return; }
      setOpen(false);
      setReason("");
      router.push(`/invoicing/${r.data!.id}`);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setError(null); setOpen(true); }}
        className="h-[32px] px-3 rounded-[8px] bg-surface border border-rule text-[11.5px] text-text-dim hover:text-text hover:border-text-dim/60 transition-colors whitespace-nowrap inline-flex items-center gap-1.5"
      >
        <FileMinus size={12} strokeWidth={1.75} />
        Issue credit note
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal aria-label="Issue credit note">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => !pending && setOpen(false)} />
          <div className="relative w-full max-w-md rounded-[14px] bg-surface border border-rule shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-rule">
              <h3 className="text-[14px] font-semibold text-text">Issue credit note</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="h-7 w-7 flex items-center justify-center rounded-[6px] text-text-dim hover:text-text hover:bg-ink/30 disabled:opacity-50 transition-colors"
                aria-label="Cancel"
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-[13px] text-text">
                Reverse invoice <span className="font-semibold tabular-nums">{invoiceNumber}</span> in full?
                A new CN document (all lines negated) will be created and linked back.
              </p>

              <label className="block">
                <span className="block text-[11.5px] text-text-dim mb-1">Reason (required — appears on the CN and in GSTR-1)</span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Client returned 2 rolls — colour mismatch"
                  rows={3}
                  disabled={pending}
                  autoFocus
                  className="w-full px-2.5 py-2 rounded-[7px] border border-rule bg-transparent text-[12.5px] text-text placeholder:text-text-faint outline-none focus:border-accent resize-none"
                />
              </label>

              <div className="rounded-[8px] border border-heat/25 bg-heat/8 p-3 flex gap-2.5">
                <AlertTriangle size={15} strokeWidth={1.75} className="text-heat mt-0.5 shrink-0" />
                <div className="text-[12px] text-text-dim">
                  Full reversal only for now — partial line credits (e.g. 2 rolls of 8) aren't yet supported here.
                  If that's what you need, cancel this dialog.
                </div>
              </div>

              {error && <p className="text-[12px] text-fault">{error}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="h-8 px-4 rounded-[7px] text-[12px] text-text-dim border border-rule hover:bg-ink/20 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={pending || reason.trim().length < 3}
                  className="h-8 px-4 rounded-[7px] text-[12px] font-semibold bg-accent text-white hover:bg-accent/90 disabled:opacity-60 transition-colors"
                >
                  {pending ? "Creating…" : "Issue credit note"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

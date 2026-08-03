"use client";

// Cancel invoice — asks the user to type the invoice number to confirm
// (destructive action, per BUILD-SPEC "Confirm only for cancelling a GST
// invoice — those require typing the document number").
//
// 24h window enforced server-side. The UI shows the reason field regardless
// and surfaces the server's "credit note required" message when the window
// has closed.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelInvoice } from "@/modules/invoices/actions";

interface Props {
  id: string;
  number: string;
  createdAt: Date;
}

const HRS_LIMIT = 24;

export function CancelInvoiceButton({ id, number, createdAt }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const ageHrs = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  const outsideWindow = ageHrs > HRS_LIMIT;
  const canSubmit = confirmText === number && reason.trim().length >= 5;

  function commit() {
    setError(null);
    startTransition(async () => {
      const res = await cancelInvoice({ id, reason });
      if (!res.ok) { setError(res.error ?? "Could not cancel"); return; }
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
              className="h-[30px] px-3 rounded-[6px] text-[11.5px] font-medium bg-bad/12 text-bad hover:bg-bad/20 transition-colors">
        Cancel invoice
      </button>
    );
  }

  return (
    <div className="rounded-[14px] bg-surface border border-bad/40 p-5">
      <div className="text-[12.5px] text-text mb-2 font-medium">Cancel {number}?</div>
      <p className="text-[11.5px] text-text-dim mb-3">
        {outsideWindow
          ? `This invoice is older than ${HRS_LIMIT}h. Cancellation is closed — the server will refuse, and you'll need to issue a credit note instead.`
          : `Cancellation is permitted for the next ${(HRS_LIMIT - ageHrs).toFixed(1)}h.`}
      </p>
      <label className="block mb-3">
        <div className="text-[11px] uppercase tracking-[0.06em] text-text-dim mb-1">Reason</div>
        <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 bg-white/60 border border-rule rounded-[6px] text-[12.5px] outline-none focus:border-bad" />
      </label>
      <label className="block mb-3">
        <div className="text-[11px] uppercase tracking-[0.06em] text-text-dim mb-1">
          Type the invoice number to confirm
        </div>
        <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
               placeholder={number}
               className="w-full h-[34px] px-3 bg-white/60 border border-rule rounded-[6px] text-[12.5px] tabular outline-none focus:border-bad" />
      </label>

      {error && <div className="mb-3 text-[12px] text-bad">{error}</div>}

      <div className="flex items-center justify-end gap-3">
        <button type="button" onClick={() => setOpen(false)}
                className="h-[32px] px-3 rounded-[6px] text-[12px] text-text-dim hover:text-text">
          Keep invoice
        </button>
        <button type="button" onClick={commit} disabled={!canSubmit || pending}
                className="h-[32px] px-4 rounded-[6px] text-[12px] font-medium bg-bad text-white hover:bg-bad/90 disabled:opacity-40 transition-colors">
          {pending ? "Cancelling…" : "Cancel invoice"}
        </button>
      </div>
    </div>
  );
}

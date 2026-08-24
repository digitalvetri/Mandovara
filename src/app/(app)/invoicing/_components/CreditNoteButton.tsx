"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCreditNote } from "@/modules/invoices/actions-part2";

export function CreditNoteButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    const reason = window.prompt("Reason for credit note:");
    if (!reason || reason.trim().length < 3) return;
    setError(null);
    start(async () => {
      const r = await createCreditNote({ invoiceId, reason: reason.trim() });
      if (!r.ok) { setError(r.error ?? "Could not create credit note"); return; }
      router.push(`/invoicing/${r.data!.id}`);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={onClick}
        className="h-[32px] px-3 rounded-[8px] bg-surface border border-rule text-[11.5px] text-text-dim hover:text-text hover:border-text-dim/60 transition-colors disabled:opacity-60 whitespace-nowrap"
      >
        {pending ? "Creating…" : "Issue credit note"}
      </button>
      {error && <span className="text-[10.5px] text-bad">{error}</span>}
    </div>
  );
}

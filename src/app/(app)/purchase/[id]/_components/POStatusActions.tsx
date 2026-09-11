"use client";

// Send / Cancel. Receiving is its own button (ReceivePOButton) — a single
// step that marks the PO received, posts stock, and raises the vendor
// payment in one go, so it doesn't belong in this apply-a-status helper.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPOStatus } from "@/modules/purchase/actions";

interface Props {
  poId:       string;
  status:     string;
  vendorName: string;
}

export function POStatusActions({ poId, status, vendorName }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (["RECEIVED", "CANCELLED", "PENDING_APPROVAL", "APPROVED"].includes(status)) return null;

  function apply(next: string) {
    setError(null);
    start(async () => {
      const res = await setPOStatus({ id: poId, status: next });
      if (!res.ok) { setError(res.error ?? "Failed"); return; }
      router.refresh();
    });
  }

  const hint = error
    ? <span className="text-fault">{error}</span>
    : status === "DRAFT"
      ? `Ready to send this order to ${vendorName}?`
      : `Waiting on ${vendorName}. Cancel here, or mark it received below once it arrives.`;

  return (
    <div className="rounded-[14px] bg-surface border border-rule px-5 py-3.5 flex items-center justify-between gap-6">
      <div className="text-[12.5px] text-text-dim leading-snug">{hint}</div>
      <div className="flex items-center gap-3 shrink-0">
        {status === "DRAFT" && (
          <button onClick={() => apply("SENT")} disabled={pending}
            className="h-[34px] px-5 rounded-[8px] bg-accent text-white text-[12.5px] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
            {pending ? "Updating…" : "Mark as Sent"}
          </button>
        )}
        {(status === "SENT" || status === "PARTIAL") && (
          <button onClick={() => apply("CANCELLED")} disabled={pending}
            className="h-[34px] px-5 rounded-[8px] border border-fault/40 text-fault text-[12.5px] hover:bg-fault/5 disabled:opacity-50 transition-colors">
            Cancel PO
          </button>
        )}
      </div>
    </div>
  );
}

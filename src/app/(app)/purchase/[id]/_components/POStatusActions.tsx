"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPOStatus } from "@/modules/purchase/actions";

interface Props {
  poId:   string;
  status: string;
}

export function POStatusActions({ poId, status }: Props) {
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

  return (
    <div className="rounded-[14px] bg-surface border border-rule px-5 py-3 flex items-center justify-between">
      <div className="text-[12px] text-text-dim">
        {error
          ? <span className="text-fault">{error}</span>
          : status === "DRAFT"
            ? "Ready to send this order?"
            : "Update the status of this purchase order."
        }
      </div>
      <div className="flex items-center gap-3">
        {status === "DRAFT" && (
          <button onClick={() => apply("SENT")} disabled={pending}
            className="h-[32px] px-4 rounded-[8px] bg-accent text-white text-[12px] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
            {pending ? "Updating…" : "Mark as Sent"}
          </button>
        )}
        {(status === "SENT" || status === "PARTIAL") && (
          <>
            <button onClick={() => apply("CANCELLED")} disabled={pending}
              className="h-[32px] px-4 rounded-[8px] border border-fault/40 text-fault text-[12px] hover:bg-fault/5 disabled:opacity-50 transition-colors">
              Cancel PO
            </button>
            <button onClick={() => apply("RECEIVED")} disabled={pending}
              className="h-[32px] px-4 rounded-[8px] bg-accent text-white text-[12px] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
              {pending ? "Updating…" : "Mark as Received"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approvePurchaseRequest, rejectPurchaseRequest } from "@/modules/purchase-requests/actions";

interface Props { id: string }

export function ApprovalButtons({ id }: Props) {
  const [pending, startTransition] = useTransition();
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject]     = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const router = useRouter();

  function approve() {
    setError(null);
    startTransition(async () => {
      const res = await approvePurchaseRequest({ id });
      if (!res.ok) { setError(res.error ?? "Failed"); return; }
      router.refresh();
    });
  }

  function reject() {
    setError(null);
    startTransition(async () => {
      const res = await rejectPurchaseRequest({ id, reason: rejectReason });
      if (!res.ok) { setError(res.error ?? "Failed"); return; }
      setShowReject(false);
      router.refresh();
    });
  }

  if (showReject) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Reason…"
          className="h-[26px] px-2 rounded-[5px] border border-rule bg-surface-2 text-[11px] text-text outline-none focus:border-fault w-[140px]"
        />
        <button
          type="button"
          disabled={pending || rejectReason.trim().length < 3}
          onClick={reject}
          className="h-[26px] px-2.5 rounded-[5px] text-[11px] bg-fault/12 text-fault hover:bg-fault/20 disabled:opacity-40 transition-colors"
        >
          Confirm
        </button>
        <button type="button" onClick={() => setShowReject(false)} className="text-[11px] text-text-dim hover:text-text">
          ×
        </button>
        {error && <span className="text-[10.5px] text-fault">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={approve}
        className="h-[26px] px-2.5 rounded-[5px] text-[11px] bg-solid/12 text-solid hover:bg-solid/20 disabled:opacity-40 transition-colors"
      >
        Approve
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setShowReject(true)}
        className="h-[26px] px-2.5 rounded-[5px] text-[11px] bg-fault/12 text-fault hover:bg-fault/20 disabled:opacity-40 transition-colors"
      >
        Reject
      </button>
      {error && <span className="text-[10.5px] text-fault">{error}</span>}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveLeave, rejectLeave } from "@/modules/hr/actions";

export function LeaveApprovalButtons({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function doApprove() {
    setError(null);
    start(async () => {
      const r = await approveLeave({ id });
      if (!r.ok) { setError(r.error ?? "Could not approve"); return; }
      router.refresh();
    });
  }

  function doReject() {
    const reason = window.prompt("Reason for rejection (optional):");
    if (reason === null) return;
    setError(null);
    start(async () => {
      const r = await rejectLeave({ id, rejectionReason: reason || undefined });
      if (!r.ok) { setError(r.error ?? "Could not reject"); return; }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      {error && <span className="text-[10px] text-bad">{error}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={doApprove}
        className="h-[24px] px-2 rounded-[4px] text-[10.5px] font-medium bg-good/12 text-good hover:bg-good/20 transition-colors disabled:opacity-60"
      >
        Approve
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={doReject}
        className="h-[24px] px-2 rounded-[4px] text-[10.5px] font-medium bg-bad/12 text-bad hover:bg-bad/20 transition-colors disabled:opacity-60"
      >
        Reject
      </button>
    </div>
  );
}

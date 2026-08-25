"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2, ChevronDown } from "lucide-react";
import { approveLeave, rejectLeave } from "@/modules/hr/actions";

export function LeaveApprovalButtons({ id }: { id: string }) {
  const router = useRouter();
  const [pending,   start]        = useTransition();
  const [error,     setError]     = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason,    setReason]    = useState("");

  function doApprove() {
    setError(null);
    setRejecting(false);
    start(async () => {
      const r = await approveLeave({ id });
      if (!r.ok) { setError(r.error ?? "Could not approve"); return; }
      router.refresh();
    });
  }

  function submitReject(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await rejectLeave({ id, rejectionReason: reason.trim() || undefined });
      if (!r.ok) { setError(r.error ?? "Could not reject"); return; }
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          disabled={pending}
          onClick={doApprove}
          className="inline-flex items-center gap-1 h-[27px] px-2.5 rounded-[6px] text-[11px] font-semibold bg-good/12 text-good hover:bg-good/22 transition-colors disabled:opacity-50"
        >
          <Check size={11} strokeWidth={2.5} />
          Approve
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={() => setRejecting((v) => !v)}
          className={`inline-flex items-center gap-1 h-[27px] px-2.5 rounded-[6px] text-[11px] font-semibold transition-colors disabled:opacity-50 ${
            rejecting
              ? "bg-bad/18 text-bad"
              : "bg-bad/10 text-bad hover:bg-bad/20"
          }`}
        >
          <X size={11} strokeWidth={2.5} />
          Reject
          <ChevronDown
            size={9}
            strokeWidth={2.5}
            className={`transition-transform duration-150 ${rejecting ? "rotate-180" : ""}`}
          />
        </button>

        {pending && <Loader2 size={12} className="animate-spin text-text-dim" />}
      </div>

      {/* Inline rejection form — expands when Reject is clicked */}
      {rejecting && (
        <form onSubmit={submitReject} className="mt-2.5 space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejection (optional)…"
            rows={2}
            maxLength={500}
            autoFocus
            className="w-full px-2.5 py-2 rounded-[8px] border border-rule bg-surface-2 text-[11.5px] text-text placeholder:text-text-faint outline-none focus:border-bad/50 focus:ring-1 focus:ring-bad/20 resize-none transition-all"
          />
          <div className="flex gap-1.5">
            <button
              type="submit"
              disabled={pending}
              className="h-[26px] px-3 rounded-[6px] bg-bad text-white text-[11px] font-semibold hover:bg-bad/90 transition-colors disabled:opacity-50"
            >
              Confirm Rejection
            </button>
            <button
              type="button"
              onClick={() => { setRejecting(false); setReason(""); }}
              className="h-[26px] px-3 rounded-[6px] border border-rule text-[11px] text-text-dim hover:bg-surface-2 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && <div className="mt-1 text-[10.5px] text-bad">{error}</div>}
    </div>
  );
}

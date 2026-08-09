"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { setQuotationStatus, rejectQuotation } from "@/modules/quotations/actions";
import { createOrderFromQuotation } from "@/modules/orders/actions";

interface Props {
  id:         string;
  current:    string;
  canApprove: boolean;  // true when user has quotation.approve permission
}

// Transitions available per state. "approve" and "reject" are gated by canApprove.
type Step = { to: string; label: string; tone?: "accent" | "good" | "bad"; requiresApprove?: boolean; requiresReason?: boolean };

const NEXT: Record<string, Step[]> = {
  DRAFT:            [{ to: "PENDING_APPROVAL", label: "Submit for approval" },
                     { to: "SENT",             label: "Send",    tone: "accent" }],
  PENDING_APPROVAL: [{ to: "APPROVED", label: "Approve", tone: "good", requiresApprove: true },
                     { to: "DRAFT",    label: "Reject",  tone: "bad",  requiresApprove: true, requiresReason: true }],
  APPROVED:         [{ to: "SENT", label: "Send", tone: "accent" }],
  SENT:             [{ to: "ACCEPTED", label: "Accepted", tone: "good" },
                     { to: "REJECTED", label: "Rejected", tone: "bad" }],
  VIEWED:           [{ to: "ACCEPTED", label: "Accepted", tone: "good" },
                     { to: "REJECTED", label: "Rejected", tone: "bad" }],
  ACCEPTED:         [{ to: "CONVERTED", label: "Convert to order", tone: "good" }],
  REVISED:          [{ to: "PENDING_APPROVAL", label: "Submit for approval" },
                     { to: "SENT",             label: "Send",    tone: "accent" }],
  REJECTED:  [],
  EXPIRED:   [],
  CONVERTED: [],
};

const TONE_CLS: Record<string, string> = {
  accent: "bg-accent text-white hover:bg-accent-hover",
  good:   "bg-solid/12 text-solid hover:bg-solid/20",
  bad:    "bg-fault/12 text-fault hover:bg-fault/20",
};

export function StatusChanger({ id, current, canApprove }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError]         = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectBox, setShowRejectBox] = useState(false);

  const allSteps = NEXT[current] ?? [];
  const nextSteps = allSteps.filter((s) => !s.requiresApprove || canApprove);

  function commit(step: Step) {
    if (step.requiresReason) {
      setShowRejectBox(true);
      return;
    }
    doCommit(step.to);
  }

  function doCommit(to: string, reason?: string) {
    setError(null);
    startTransition(async () => {
      if (to === "CONVERTED") {
        const res = await createOrderFromQuotation({ quotationId: id });
        if (!res.ok) { setError(res.error ?? "Could not convert to order"); return; }
        router.push(`/orders/${res.data!.id}` as Route);
        router.refresh();
        return;
      }
      if (to === "DRAFT" && current === "PENDING_APPROVAL" && reason) {
        const res = await rejectQuotation({ id, reason });
        if (!res.ok) { setError(res.error ?? "Could not reject"); return; }
        setShowRejectBox(false);
        router.refresh();
        return;
      }
      const res = await setQuotationStatus({ id, status: to });
      if (!res.ok) { setError(res.error ?? "Could not update status"); return; }
      router.refresh();
    });
  }

  if (nextSteps.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 items-end">
      <div className="flex items-center gap-2">
        {nextSteps.map((s) => (
          <button
            key={s.to}
            type="button"
            disabled={pending}
            onClick={() => commit(s)}
            className={[
              "h-[30px] px-3 rounded-[6px] text-[11.5px] font-medium transition-colors disabled:opacity-60",
              s.tone ? TONE_CLS[s.tone] : "bg-surface border border-rule text-text-dim hover:text-text hover:bg-surface-hover",
            ].join(" ")}
          >
            {s.label}
          </button>
        ))}
        {error && <div className="text-[11.5px] text-fault">{error}</div>}
      </div>

      {showRejectBox && (
        <div className="flex items-center gap-2 mt-1">
          <input
            type="text"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection…"
            className="h-[30px] px-2 rounded-[6px] border border-rule bg-transparent text-[11.5px] text-text placeholder:text-text-faint outline-none focus:border-accent w-[260px]"
          />
          <button
            type="button"
            disabled={pending || rejectReason.trim().length < 2}
            onClick={() => doCommit("DRAFT", rejectReason)}
            className="h-[30px] px-3 rounded-[6px] text-[11.5px] font-medium bg-fault/12 text-fault hover:bg-fault/20 disabled:opacity-40 transition-colors"
          >
            Confirm reject
          </button>
          <button
            type="button"
            onClick={() => setShowRejectBox(false)}
            className="h-[30px] px-2 rounded-[6px] text-[11.5px] text-text-dim hover:text-text"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { updateSiteVisitStatus } from "@/modules/site-visits/actions";

interface Props {
  visitId:  string;
  status:   string;
}

type Confirm = "COMPLETED" | "NO_SHOW";

export function VisitStatusActions({ visitId, status }: Props) {
  const [pending, start]           = useTransition();
  const [confirm, setConfirm]      = useState<Confirm | null>(null);
  const [notes, setNotes]          = useState("");
  const [error, setError]          = useState<string | null>(null);

  const isActive = status === "SCHEDULED" || status === "IN_PROGRESS";
  if (!isActive) return null;

  function submit() {
    if (!confirm) return;
    setError(null);
    start(async () => {
      const res = await updateSiteVisitStatus({
        id:     visitId,
        status: confirm,
        ...(notes.trim() ? { observations: notes.trim() } : {}),
      });
      if (!res.ok) setError(res.error ?? "Could not update visit");
    });
  }

  if (confirm) {
    return (
      <section className="rounded-[14px] border border-rule bg-surface p-5 md:p-6">
        <div className="mb-3 text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
          {confirm === "COMPLETED" ? "Mark visit as completed" : "Mark as no show / missed"}
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder={confirm === "COMPLETED"
            ? "Observations from the visit (optional)"
            : "Reason or rescheduling note (optional)"}
          className="w-full rounded-[8px] border border-rule bg-surface-2 px-3 py-2 text-[12.5px] text-text resize-none outline-none focus:border-gold mb-3"
        />
        {error && (
          <div className="mb-3 text-[11.5px] text-fault">{error}</div>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className={[
              "inline-flex items-center gap-1.5 rounded-[8px] px-4 py-2 text-[12.5px] font-semibold disabled:opacity-60",
              confirm === "COMPLETED"
                ? "bg-solid text-white hover:bg-solid/90"
                : "bg-fault text-white hover:bg-fault/90",
            ].join(" ")}
          >
            {pending
              ? <Loader2 size={12} className="animate-spin" />
              : confirm === "COMPLETED"
                ? <CheckCircle2 size={13} />
                : <XCircle size={13} />}
            Confirm
          </button>
          <button
            type="button"
            onClick={() => { setConfirm(null); setNotes(""); setError(null); }}
            disabled={pending}
            className="rounded-[8px] px-4 py-2 text-[12.5px] text-text-dim hover:text-text disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[14px] border border-rule bg-surface p-5 md:p-6">
      <div className="mb-3 text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
        Update visit
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setConfirm("COMPLETED")}
          className="inline-flex items-center gap-1.5 rounded-[8px] bg-solid px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-solid/90"
        >
          <CheckCircle2 size={13} />
          Mark Completed
        </button>
        {status === "SCHEDULED" && (
          <button
            type="button"
            onClick={() => setConfirm("NO_SHOW")}
            className="inline-flex items-center gap-1.5 rounded-[8px] border border-rule px-4 py-2 text-[12.5px] text-text-dim hover:text-fault hover:border-fault/40"
          >
            <XCircle size={13} />
            No Show / Missed
          </button>
        )}
      </div>
    </section>
  );
}

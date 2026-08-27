"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeFollowUp, rescheduleFollowUp } from "@/modules/followups/actions";
import { FOLLOWUP_OUTCOMES } from "@/modules/followups/schema";
import type { LeadFollowUpRow } from "@/modules/followups/queries";

const OUTCOME_LABEL: Record<string, string> = {
  CONTACTED:   "Contacted",
  NO_ANSWER:   "No answer",
  RESCHEDULED: "Rescheduled",
  CONVERTED:   "Converted",
  LOST:        "Lost",
};

export function LeadFollowUpList({ followUps }: { followUps: LeadFollowUpRow[] }) {
  if (followUps.length === 0) {
    return (
      <div className="text-[12.5px] text-text-faint">
        No follow-ups yet. Schedule one above to keep this lead warm.
      </div>
    );
  }
  return (
    <ul className="space-y-0">
      {followUps.map((f) => <FollowUpRow key={f.id} f={f} />)}
    </ul>
  );
}

function FollowUpRow({ f }: { f: LeadFollowUpRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<"complete" | "reschedule">("complete");
  const [outcome, setOutcome] = useState<string>(FOLLOWUP_OUTCOMES[0]);
  const [newDate, setNewDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [error, setError] = useState<string | null>(null);

  const isOpen = f.status !== "COMPLETED";
  const dotCls =
    f.status === "COMPLETED" ? "bg-good" :
    f.status === "OVERDUE"   ? "bg-bad"  : "bg-accent";
  const statusCls =
    f.status === "COMPLETED" ? "text-good" :
    f.status === "OVERDUE"   ? "text-bad"  : "text-text-dim";

  const dueLabel = f.dueAt.toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  });

  function markDone() {
    setError(null);
    start(async () => {
      const res = await completeFollowUp({ id: f.id, outcome });
      if (!res.ok) { setError(res.error ?? "Could not complete"); return; }
      setExpanded(false);
      router.refresh();
    });
  }

  function reschedule() {
    setError(null);
    start(async () => {
      const res = await rescheduleFollowUp({ id: f.id, dueAt: newDate });
      if (!res.ok) { setError(res.error ?? "Could not reschedule"); return; }
      setExpanded(false);
      router.refresh();
    });
  }

  return (
    <li className="border-b border-rule/60 last:border-0 py-3">
      <div className="flex items-baseline gap-3">
        <span className={`mt-[6px] h-[8px] w-[8px] rounded-full shrink-0 ${dotCls}`} />
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] text-text">{f.note || "Untitled follow-up"}</div>
          <div className="text-[11.5px] text-text-dim mt-0.5 tabular">
            Due {dueLabel}
            {f.outcome ? ` · ${(OUTCOME_LABEL[f.outcome] ?? f.outcome).toLowerCase()}` : ""}
          </div>
        </div>

        {isOpen ? (
          <button
            type="button"
            onClick={() => { setExpanded(!expanded); setError(null); }}
            className="shrink-0 text-[10.5px] uppercase tracking-[0.14em] border border-accent/40 text-accent rounded-[5px] px-2 py-0.5 hover:bg-accent/8 transition-colors"
          >
            {expanded ? "Cancel" : "Open ▾"}
          </button>
        ) : (
          <span className={`text-[10.5px] uppercase tracking-[0.14em] shrink-0 ${statusCls}`}>
            {f.status.toLowerCase()}
          </span>
        )}
      </div>

      {expanded && (
        <div className="mt-2 ml-[20px] rounded-[8px] border border-rule bg-surface-2/50 p-3 space-y-2">
          {/* Mode tabs */}
          <div className="flex gap-1.5">
            {(["complete", "reschedule"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={[
                  "text-[11px] px-2.5 py-1 rounded-[5px] border transition-colors",
                  mode === m
                    ? "bg-accent text-white border-accent"
                    : "border-rule text-text-dim hover:border-accent/40 hover:text-text",
                ].join(" ")}
              >
                {m === "complete" ? "Mark done" : "Reschedule"}
              </button>
            ))}
          </div>

          {mode === "complete" && (
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                className="h-[30px] px-2 text-[12px] bg-white/60 border border-rule rounded-[5px] outline-none focus:border-accent"
              >
                {FOLLOWUP_OUTCOMES.map((o) => (
                  <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={markDone}
                disabled={pending}
                className="h-[30px] px-3 rounded-[5px] bg-accent text-white text-[11.5px] font-medium hover:bg-accent-hover disabled:opacity-60 transition-colors"
              >
                {pending ? "Saving…" : "Mark done"}
              </button>
            </div>
          )}

          {mode === "reschedule" && (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="h-[30px] px-2 text-[12px] bg-white/60 border border-rule rounded-[5px] outline-none focus:border-accent tabular"
              />
              <button
                type="button"
                onClick={reschedule}
                disabled={pending}
                className="h-[30px] px-3 rounded-[5px] bg-accent text-white text-[11.5px] font-medium hover:bg-accent-hover disabled:opacity-60 transition-colors"
              >
                {pending ? "Saving…" : "Reschedule"}
              </button>
            </div>
          )}

          {error && <div className="text-[11px] text-bad">{error}</div>}
        </div>
      )}
    </li>
  );
}

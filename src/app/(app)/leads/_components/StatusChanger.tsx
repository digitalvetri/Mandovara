"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LEAD_STATUSES } from "@/modules/leads/schema";
import { changeLeadStage } from "@/modules/leads/actions";

const LABEL: Record<string, string> = {
  NEW: "New", CONTACTED: "Contacted", QUALIFIED: "Qualified",
  MEASUREMENT_SCHEDULED: "Meas. Scheduled", VISIT_SCHEDULED: "Visit Scheduled",
  MEASURED: "Measured", QUOTED: "Quoted",
  NEGOTIATION: "Negotiation", WON: "Won", LOST: "Lost",
};

export function StatusChanger({ id, current }: { id: string; current: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [askLostReason, setAskLostReason] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function commit(to: string, reason?: string) {
    setError(null);
    startTransition(async () => {
      const res = await changeLeadStage({ id, to, ...(reason != null && { lostReason: reason }) });
      if (!res.ok) {
        setError(res.fieldErrors?.["lostReason"] ?? res.error ?? "Could not update status");
        return;
      }
      setAskLostReason(false);
      setLostReason("");
      router.refresh();
    });
  }

  function onSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const to = e.target.value;
    if (to === current) return;
    if (to === "LOST") { setAskLostReason(true); return; }
    commit(to);
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={current}
        onChange={onSelect}
        disabled={pending}
        className="h-[30px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12px] outline-none focus:border-accent"
      >
        {LEAD_STATUSES.map((s) => (
          <option key={s} value={s}>{LABEL[s]}</option>
        ))}
      </select>

      {askLostReason && (
        <div className="flex items-center gap-2">
          <input
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            placeholder="Why lost?"
            className="h-[30px] w-[220px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12px] outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => commit("LOST", lostReason)}
            disabled={pending || lostReason.trim().length === 0}
            className="h-[30px] px-3 rounded-[6px] bg-bad text-white text-[11.5px] font-medium disabled:opacity-60"
          >
            Mark lost
          </button>
          <button
            type="button"
            onClick={() => { setAskLostReason(false); setLostReason(""); }}
            className="h-[30px] px-2 text-[11.5px] text-text-dim hover:text-text"
          >
            Cancel
          </button>
        </div>
      )}

      {error && <div className="text-[11.5px] text-bad">{error}</div>}
    </div>
  );
}

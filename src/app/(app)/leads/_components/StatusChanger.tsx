"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ACTIVE_LEAD_STAGES, normalizeLeadStage } from "@/modules/leads/schema";
import { changeLeadStage } from "@/modules/leads/actions";
import { ConvertLeadModal } from "./ConvertLeadModal";

const LABEL: Record<string, string> = {
  NEW: "New", QUOTED: "Quoted", WON: "Won", LOST: "Lost",
};

interface Props {
  id:       string;
  current:  string;
  // Needed for the ConvertLeadModal when the user picks WON.
  leadName: string;
  mobile:   string;
  email:    string | null;
}

export function StatusChanger({ id, current, leadName, mobile, email }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [askLostReason, setAskLostReason] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showConvertModal, setShowConvertModal] = useState(false);

  // Any legacy stage (CONTACTED / QUALIFIED / etc) displays as "New" in
  // the picker so the owner is never staring at a stage that isn't in
  // the picker's options list.
  const displayed = normalizeLeadStage(current);

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
    if (to === displayed) return;
    // WON is only reachable via lead conversion — the modal fires convertLead
    // which sets the stage to WON server-side. Prevents "orphan WON" leads
    // that never became clients.
    if (to === "WON") { setShowConvertModal(true); return; }
    if (to === "LOST") { setAskLostReason(true); return; }
    commit(to);
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={displayed}
        onChange={onSelect}
        disabled={pending}
        className="h-[30px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12px] outline-none focus:border-accent"
      >
        {ACTIVE_LEAD_STAGES.map((s) => (
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

      <ConvertLeadModal
        leadId={id}
        leadName={leadName}
        mobile={mobile}
        email={email}
        open={showConvertModal}
        onClose={() => setShowConvertModal(false)}
      />
    </div>
  );
}

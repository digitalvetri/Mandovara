"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CLIENT_STATUSES } from "@/modules/clients/schema";
import { setClientStatus } from "@/modules/clients/actions";

const LABEL: Record<string, string> = {
  ACTIVE: "Active", INACTIVE: "Inactive", BLACKLISTED: "Blacklisted",
};

export function StatusChanger({ id, current }: { id: string; current: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [askReason, setAskReason] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function commit(to: string, r?: string) {
    setError(null);
    startTransition(async () => {
      const res = await setClientStatus({ id, status: to, ...(r != null && { reason: r }) });
      if (!res.ok) {
        setError(res.fieldErrors?.["reason"] ?? res.error ?? "Could not update status");
        return;
      }
      setAskReason(false);
      setReason("");
      router.refresh();
    });
  }

  function onSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const to = e.target.value;
    if (to === current) return;
    if (to === "BLACKLISTED") { setAskReason(true); return; }
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
        {CLIENT_STATUSES.map((s) => (
          <option key={s} value={s}>{LABEL[s]}</option>
        ))}
      </select>

      {askReason && (
        <div className="flex items-center gap-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for blacklisting"
            className="h-[30px] w-[240px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12px] outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => commit("BLACKLISTED", reason)}
            disabled={pending || reason.trim().length === 0}
            className="h-[30px] px-3 rounded-[6px] bg-bad text-white text-[11.5px] font-medium disabled:opacity-60"
          >
            Blacklist
          </button>
          <button
            type="button"
            onClick={() => { setAskReason(false); setReason(""); }}
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

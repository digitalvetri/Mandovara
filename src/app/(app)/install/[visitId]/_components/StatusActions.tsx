"use client";

import { useState, useTransition } from "react";
import { assignCrew, advanceInstallStatus, confirmInstall, closeVisit } from "@/modules/install/actions";
import { rescheduleInstallVisit } from "@/modules/install/compat-actions";
import { INSTALL_STATUS_LABELS, INSTALL_STATUS_NEXT } from "@/modules/install/schema";
import { CheckCircle, Play, UserCheck, XCircle, RotateCcw } from "lucide-react";

interface Crew { id: string; name: string; }

interface Props {
  visitId: string;
  projectId: string;
  status: string;
  openSnags: number;
  crews: Crew[];
  currentCrewId?: string;
}

export function StatusActions({ visitId, status, openSnags, crews, currentCrewId }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showAssign, setShowAssign] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [crewId, setCrewId] = useState(currentCrewId ?? "");
  const [newDate, setNewDate] = useState("");
  const [reason, setReason] = useState("");

  const next = INSTALL_STATUS_NEXT[status];

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Failed");
    });
  }

  if (["CLOSED", "CANCELLED"].includes(status)) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Generic advance: SCHEDULED→ASSIGNED handled separately; IN_PROGRESS→COMPLETED etc. */}
      {next && status !== "SCHEDULED" && (
        <button
          onClick={() => run(() => advanceInstallStatus({ visitId }))}
          disabled={pending}
          className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-gold/20 border border-gold/40 text-gold text-[12px] font-medium hover:bg-gold/30 transition-colors disabled:opacity-60"
        >
          <Play size={12} />
          {pending ? "Saving…" : `→ ${INSTALL_STATUS_LABELS[next]}`}
        </button>
      )}

      {/* Assign crew button (SCHEDULED state) */}
      {status === "SCHEDULED" && (
        <>
          {showAssign ? (
            <div className="flex items-center gap-2">
              <select
                value={crewId}
                onChange={(e) => setCrewId(e.target.value)}
                className="h-8 px-2 rounded-md border border-border bg-surface-2 text-[12px] text-text outline-none focus:border-gold"
              >
                <option value="">— Select crew —</option>
                {crews.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button
                disabled={!crewId || pending}
                onClick={() => run(async () => { const r = await assignCrew({ visitId, crewId }); setShowAssign(false); return r; })}
                className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-gold text-ink text-[12px] font-semibold disabled:opacity-50"
              >
                <UserCheck size={12} /> Assign & Mark Assigned
              </button>
              <button onClick={() => setShowAssign(false)} className="h-8 px-2 text-[12px] text-text-muted hover:text-text">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setShowAssign(true)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-heat/15 border border-heat/30 text-heat text-[12px] font-medium hover:bg-heat/25 transition-colors"
            >
              <UserCheck size={12} /> Assign Crew
            </button>
          )}
        </>
      )}

      {/* Confirm installation */}
      {["COMPLETED", "SNAGGING"].includes(status) && (
        <button
          onClick={() => run(() => confirmInstall({ visitId }))}
          disabled={pending || openSnags > 0}
          title={openSnags > 0 ? `${openSnags} open snag(s) — resolve first` : ""}
          className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-solid/20 border border-solid/40 text-solid text-[12px] font-medium hover:bg-solid/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CheckCircle size={12} />
          {openSnags > 0 ? `${openSnags} snag(s) open` : "Confirm Installation"}
        </button>
      )}

      {/* Close visit */}
      {status === "CUSTOMER_CONFIRMED" && (
        <button
          onClick={() => run(() => closeVisit({ visitId }))}
          disabled={pending}
          className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-surface-2 border border-border text-text-muted text-[12px] font-medium hover:bg-surface hover:text-text transition-colors disabled:opacity-60"
        >
          <XCircle size={12} /> Close Visit
        </button>
      )}

      {/* Reschedule */}
      {!["COMPLETED", "CUSTOMER_CONFIRMED", "CLOSED", "CANCELLED"].includes(status) && (
        <>
          {showReschedule ? (
            <div className="flex items-center gap-2 flex-wrap">
              <input type="datetime-local" value={newDate} onChange={(e) => setNewDate(e.target.value)}
                className="h-8 px-2 rounded-md border border-border bg-surface-2 text-[12px] text-text outline-none focus:border-gold" />
              <input type="text" placeholder="Reason…" value={reason} onChange={(e) => setReason(e.target.value)}
                className="h-8 px-2 rounded-md border border-border bg-surface-2 text-[12px] text-text outline-none focus:border-gold w-48" />
              <button
                disabled={!newDate || !reason || pending}
                onClick={() => run(async () => { const r = await rescheduleInstallVisit({ visitId, scheduledAt: new Date(newDate).toISOString(), reason }); setShowReschedule(false); return r; })}
                className="h-8 px-3 rounded-md bg-gold/20 border border-gold/30 text-gold text-[12px] font-medium disabled:opacity-50"
              >
                <RotateCcw size={12} className="inline mr-1" /> Reschedule
              </button>
              <button onClick={() => setShowReschedule(false)} className="h-8 px-2 text-[12px] text-text-muted hover:text-text">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setShowReschedule(true)} className="h-8 px-2 text-[12px] text-text-muted hover:text-text flex items-center gap-1">
              <RotateCcw size={12} /> Reschedule
            </button>
          )}
        </>
      )}

      {error && <p className="w-full text-[11px] text-fault mt-1">{error}</p>}
    </div>
  );
}

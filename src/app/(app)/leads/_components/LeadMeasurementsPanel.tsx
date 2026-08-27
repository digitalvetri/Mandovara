"use client";

// Measurements taken on a lead's site, before the lead is a client.
//
// This is the ask that started the 2026-08-27 change: a lead can have a
// site visit, so it should be able to carry the measurement taken on
// that visit — and that measurement should follow the lead into the
// client and the project rather than being re-typed. It does: convertLead
// re-points these exact rows at the new Project, so every dimension,
// photo and CalcResult survives conversion untouched.
//
// Before this, measuring a prospect meant either converting them first
// (committing to a client record for someone who might never buy) or
// creating a throwaway Project, which is what createStubProjectForClient
// did until this change deleted it.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { Ruler, Loader2, Plus, ArrowUpRight } from "lucide-react";
import { startMeasurementAndRedirect } from "@/modules/measurement/start-and-redirect";
import type { LeadRoundRow } from "@/modules/measurement/queries-lead";

const STATUS_CHIP: Record<string, string> = {
  DRAFT:      "bg-info/12 text-info",
  SUBMITTED:  "bg-heat/12 text-heat",
  APPROVED:   "bg-solid/12 text-solid",
  SUPERSEDED: "bg-surface-2 text-text-dim",
};

interface Props {
  leadId:      string;
  rounds:      LeadRoundRow[];
  isConverted: boolean;
}

export function LeadMeasurementsPanel({ leadId, rounds, isConverted }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function begin(): void {
    setError(null);
    start(async () => {
      try {
        const res = await startMeasurementAndRedirect({ leadId });
        // No rooms yet — the field PWA's own room picker handles that,
        // so send the measurer straight there rather than to a desktop
        // room-setup sheet they may not be sitting in front of.
        if (res?.needsRooms) router.push(`/m/measure/lead-${leadId}` as Route);
      } catch (e) {
        if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
        setError(e instanceof Error ? e.message : "Could not start the measurement");
      }
    });
  }

  return (
    <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-3 border-b border-rule">
        <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
          <Ruler size={11} />
          Measurements
          {rounds.length > 0 && (
            <span className="tabular text-[10px] text-text-faint">({rounds.length})</span>
          )}
        </div>
        {!isConverted && (
          <button
            type="button"
            disabled={pending}
            onClick={begin}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline disabled:opacity-60"
          >
            {pending ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} strokeWidth={2.2} />}
            {rounds.length === 0 ? "Measure site" : "New round"}
          </button>
        )}
      </div>

      {rounds.length === 0 ? (
        <div className="px-5 py-6 text-center">
          <Ruler size={18} className="mx-auto mb-2 text-text-faint" />
          <div className="text-[12px] text-text-dim">
            Nothing measured yet.
            {!isConverted && " Measure on site and the dimensions come with the lead when it converts."}
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-rule">
          {rounds.map((r) => (
            <li key={r.id}>
              <Link
                href={`/leads/${leadId}/measurements/${r.id}` as Route}
                className="flex items-center justify-between gap-2 px-5 py-3 hover:bg-surface-2/60 transition-colors"
              >
                <div className="min-w-0">
                  <div className="tabular text-[12.5px] font-medium text-accent">
                    {r.number.split("/").slice(-1)[0] ?? r.number}
                    {r.revision > 0 && <span className="ml-1 text-[10px] text-text-faint">r{r.revision}</span>}
                  </div>
                  <div className="tabular text-[11px] text-text-dim mt-0.5">
                    {r.itemCount} item{r.itemCount === 1 ? "" : "s"} · {r.roomCount} room{r.roomCount === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-medium uppercase tracking-[0.05em] px-2 py-0.5 rounded-[3px] ${STATUS_CHIP[r.status] ?? "bg-surface-2 text-text-dim"}`}>
                    {r.status.toLowerCase()}
                  </span>
                  <ArrowUpRight size={12} className="text-text-faint" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {error && <div className="px-5 pb-3 text-[11px] text-fault">{error}</div>}
    </div>
  );
}

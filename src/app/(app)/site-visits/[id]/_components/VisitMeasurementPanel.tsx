"use client";

// The bridge between a site visit and the measurements taken on it.
//
// Until 2026-08-27 the visit page had no idea measurements existed: you
// opened "Site Visit Management", saw a scheduled visit, and then had to
// remember to go to a different top-level menu item to record what you
// measured — and nothing ever linked the two records. This panel starts
// the round and stamps siteVisitId on it, so the trip and its dimensions
// are one thing from here on.
//
// Mounted on the visit detail page. Only meaningful for a visit attached
// to a project; a lead-scoped visit cannot be measured until the lead
// itself can hold measurements (Phase 3).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { Ruler, Loader2, ArrowUpRight, Plus } from "lucide-react";
import { startMeasurementAndRedirect } from "@/modules/measurement/start-and-redirect";
import type { VisitMeasurementRound } from "@/modules/site-visits/queries";

const STATUS_CHIP: Record<string, string> = {
  DRAFT:      "bg-info/12 text-info",
  SUBMITTED:  "bg-heat/12 text-heat",
  APPROVED:   "bg-solid/12 text-solid",
  SUPERSEDED: "bg-surface-2 text-text-dim",
};

interface Props {
  visitId:   string;
  projectId: string | null;
  purposeRaw: string;
  rounds:    VisitMeasurementRound[];
}

export function VisitMeasurementPanel({ visitId, projectId, purposeRaw, rounds }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Surveys and sample-showings can turn into a measurement on the spot,
  // so the panel is offered on every visit rather than only MEASUREMENT
  // ones — but a MEASUREMENT visit leads with it.
  const isMeasurementVisit = purposeRaw === "MEASUREMENT";

  function begin(): void {
    if (!projectId) return;
    setError(null);
    start(async () => {
      try {
        const res = await startMeasurementAndRedirect({ projectId, siteVisitId: visitId });
        // needsRooms — the project has no rooms yet, so send the operator
        // to the project's measurement tab where the room sheet lives.
        if (res?.needsRooms) {
          router.push(`/projects/${projectId}/measurements` as Route);
        }
      } catch (e) {
        // A thrown redirect is Next's navigation mechanism, not a failure.
        if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
        setError(e instanceof Error ? e.message : "Could not start the measurement");
      }
    });
  }

  return (
    <section className="rounded-[14px] bg-surface border border-rule p-5 md:p-6">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
          <Ruler size={11} />
          Measurements on this visit
          {rounds.length > 0 && (
            <span className="tabular text-[10px] text-text-faint">({rounds.length})</span>
          )}
        </div>

        {projectId && (
          <button
            type="button"
            disabled={pending}
            onClick={begin}
            className={
              "inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-[12px] font-medium border transition-colors disabled:opacity-60 " +
              (isMeasurementVisit && rounds.length === 0
                ? "bg-accent text-white border-accent hover:opacity-90"
                : "bg-accent/8 text-accent border-accent/25 hover:bg-accent/15")
            }
          >
            {pending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} strokeWidth={2.2} />}
            {rounds.length === 0 ? "Start measurement" : "New round"}
          </button>
        )}
      </div>

      {!projectId ? (
        <div className="text-[12.5px] text-text-dim">
          This visit is attached to a lead, not a project. Convert the lead to a
          client to record measurements against it.
        </div>
      ) : rounds.length === 0 ? (
        <div className="text-[12.5px] text-text-dim">
          {isMeasurementVisit
            ? "Nothing measured yet. Start the round and the dimensions will be linked to this visit."
            : "No measurements taken on this visit. You can still start one if the client asks on the day."}
        </div>
      ) : (
        <ul className="divide-y divide-rule -mx-1">
          {rounds.map((r) => (
            <li key={r.id}>
              <Link
                href={`/projects/${projectId}/measurements/${r.id}` as Route}
                className="flex items-center justify-between gap-3 px-1 py-2.5 hover:bg-surface-2/60 rounded-[6px] transition-colors"
              >
                <div className="min-w-0">
                  <div className="tabular text-[12.5px] font-medium text-accent">
                    {r.number}
                    {r.revision > 0 && <span className="ml-1 text-[10px] text-text-faint">r{r.revision}</span>}
                  </div>
                  <div className="text-[11px] text-text-dim mt-0.5 tabular">
                    {r.itemCount} item{r.itemCount === 1 ? "" : "s"}
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

      {error && <div className="mt-2 text-[11.5px] text-fault">{error}</div>}
    </section>
  );
}

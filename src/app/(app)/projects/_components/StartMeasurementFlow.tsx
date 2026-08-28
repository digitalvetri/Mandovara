"use client";

// Owns the interactive state for the Next Action hero:
//   - the "Start measurement" button
//   - the "Schedule visit" sheet (ENQUIRY-stage action)
//   - the room-setup sheet that appears when the project has no rooms
//   - the always-visible "Quick actions" strip (2026-08-26 owner
//     redesign): Schedule visit + Add measurement are available at
//     every pre-installation phase, not just when the stepper is on
//     the matching gate.
//
// Kept as one client component so the server page.tsx can stay a plain
// Server Component and pass a fully-resolved NextAction down as data.
//
// URL wizard flags (post-conversion continuous flow, spec-detail §4):
//   ?wizard=schedule-visit → auto-opens the Schedule Visit sheet on
//     mount. ConvertLeadModal redirects here so users don't have to
//     hunt for "what's next" after converting a lead.

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { Route } from "next";
import { CalendarPlus, Ruler, Loader2 } from "lucide-react";
import { RoomSetupSheet } from "./RoomSetupSheet";
import { ScheduleVisitSheet } from "./ScheduleVisitSheet";
import type { NextAction } from "@/modules/projects/next-action";
import { startMeasurementAndRedirect } from "@/modules/measurement/start-and-redirect";

interface Props {
  projectId: string;
  action: NextAction;
  currentUserId: string;
  /** Show/hide the quick-action buttons per role. Both default to false
   *  so a permission-less viewer sees no action buttons at all. */
  canScheduleVisit?: boolean;
  canMeasure?: boolean;
  /** Hide the whole quick-actions strip once install is done. */
  quickActionsVisible?: boolean;
}

export function StartMeasurementFlow({
  projectId, action, currentUserId,
  canScheduleVisit = false, canMeasure = false, quickActionsVisible = true,
}: Props) {
  const router     = useRouter();
  const pathname   = usePathname();
  const params     = useSearchParams();
  const [needsRoomsOpen, setNeedsRoomsOpen] = useState(false);
  const [scheduleVisitOpen, setScheduleVisitOpen] = useState(false);
  const [measurePending, startMeasure] = useTransition();
  const [measureError, setMeasureError] = useState<string | null>(null);
  const [, startNav] = useTransition();

  // Post-conversion wizard entry: land here from ConvertLeadModal with
  // ?wizard=schedule-visit and we pop the sheet automatically. Clear
  // the param afterwards so a page reload doesn't repeat it. A ref
  // guards against the effect double-firing after the URL replace
  // triggers a re-render.
  const wizardFired = useRef(false);
  useEffect(() => {
    if (wizardFired.current) return;
    if (params.get("wizard") !== "schedule-visit") return;
    wizardFired.current = true;
    setScheduleVisitOpen(true);
    const sp = new URLSearchParams(params.toString());
    sp.delete("wizard");
    router.replace(`${pathname}${sp.toString() ? `?${sp}` : ""}` as Route);
  }, [params, pathname, router]);

  function beginMeasurement(): void {
    setMeasureError(null);
    startMeasure(async () => {
      try {
        const res = await startMeasurementAndRedirect({ projectId });
        if (res?.needsRooms) setNeedsRoomsOpen(true);
      } catch (e: unknown) {
        const err = e as { digest?: string; message?: string };
        if (err?.digest?.startsWith("NEXT_REDIRECT")) throw e;
        setMeasureError(err?.message ?? "Could not start measurement");
      }
    });
  }

  const showQuickActions = quickActionsVisible && (canScheduleVisit || canMeasure);

  return (
    <>
      {/* The NextActionCard is gone (2026-08-28, owner instruction:
          "remove the next action box").
          
          It announced one step in a fixed order — the same assumption
          the section list below was rebuilt to drop — and it took a
          large banner to say something the stage stepper already shows.
          Its one genuinely useful part was the shortcut it offered, so
          that survives here as a normal button beside the others, where
          it can be used at any time rather than only when the flow
          decides it is your turn. */}
      {showQuickActions && (
        <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-rule bg-surface-2/40 px-3 py-2">
          <span className="mr-1 text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
            Quick actions
          </span>
          {action.href && action.cta && (
            <a
              href={action.href}
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-accent/40 bg-accent/10 px-2.5 py-1 text-[12px] font-medium text-accent transition-colors hover:bg-accent/18"
            >
              {action.cta}
            </a>
          )}
          {canScheduleVisit && (
            <button
              type="button"
              onClick={() => setScheduleVisitOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-rule bg-surface px-2.5 py-1 text-[12px] text-text-dim hover:border-gold hover:text-text transition-colors"
            >
              <CalendarPlus size={13} strokeWidth={1.8} />
              Schedule visit
            </button>
          )}
          {canMeasure && (
            <button
              type="button"
              onClick={beginMeasurement}
              disabled={measurePending}
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-rule bg-surface px-2.5 py-1 text-[12px] text-text-dim hover:border-gold hover:text-text transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
              {measurePending
                ? <Loader2 size={13} className="animate-spin" />
                : <Ruler size={13} strokeWidth={1.8} />}
              Add measurement
            </button>
          )}
          {measureError && (
            <span className="text-[11px] text-fault">{measureError}</span>
          )}
        </div>
      )}

      <RoomSetupSheet
        projectId={projectId}
        open={needsRoomsOpen}
        onClose={() => setNeedsRoomsOpen(false)}
        onDone={() => {
          setNeedsRoomsOpen(false);
          // Rooms now exist — re-fire the measurement action. This time it
          // creates the measurement round and redirects directly to it, so
          // the user never has to click "Start measurement" a second time.
          startNav(async () => {
            try {
              await startMeasurementAndRedirect({ projectId });
            } catch (e: unknown) {
              const err = e as { digest?: string };
              if (err?.digest?.startsWith("NEXT_REDIRECT")) throw e;
              if (typeof window !== "undefined") window.location.reload();
            }
          });
        }}
      />

      <ScheduleVisitSheet
        projectId={projectId}
        defaultAssigneeId={currentUserId}
        open={scheduleVisitOpen}
        onClose={() => setScheduleVisitOpen(false)}
      />
    </>
  );
}

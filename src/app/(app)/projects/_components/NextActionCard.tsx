"use client";

// The hero card on the project detail page. Renders the single primary
// action for the project's current stage. The gold CTA is the ONE gold
// element on the page (spec §2, §6).
//
// The button is DISABLED with an explanatory line when the user's role
// cannot perform it — never hidden. See spec §5 ("Owner is not at the
// site and should not be typing measurements") for the doctrine.
//
// The START_MEASUREMENT kind bypasses the href and calls a server action
// so the redirect can be device-aware (phone → /m/measure, desktop →
// /projects/[id]/measurements/[id]).

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { ArrowRight, Loader2, Lock } from "lucide-react";
import type { NextAction } from "@/modules/projects/next-action";
import { startMeasurementAndRedirect } from "@/modules/measurement/start-and-redirect";

interface Props {
  action: NextAction;
  projectId: string;
  /** Called when startMeasurementRound returns needsRooms=true. */
  onNeedsRooms?: () => void;
  /** Open the schedule-visit sheet for ENQUIRY-stage projects. */
  onScheduleVisit?: () => void;
}

export function NextActionCard({
  action, projectId, onNeedsRooms, onScheduleVisit,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function fire(): void {
    setError(null);
    if (!action.enabled) return;

    if (action.kind === "SCHEDULE_VISIT" && onScheduleVisit) {
      onScheduleVisit();
      return;
    }

    if (action.kind === "START_MEASUREMENT") {
      start(async () => {
        try {
          const res = await startMeasurementAndRedirect({ projectId });
          // A `needsRooms` response means the server didn't redirect;
          // ask the parent to open the room-setup sheet.
          if (res?.needsRooms && onNeedsRooms) onNeedsRooms();
        } catch (e: unknown) {
          // Next-redirect throws a special error we shouldn't intercept;
          // rethrow it so navigation still happens.
          const err = e as { digest?: string; message?: string };
          if (err?.digest?.startsWith("NEXT_REDIRECT")) throw e;
          setError(err?.message ?? "Could not start measurement");
        }
      });
      return;
    }

    if (action.href) router.push(action.href as Route);
  }

  return (
    <div className="rounded-[14px] border border-rule bg-surface p-5">
      <div className="mb-1 text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
        Next action
      </div>
      <div className="mb-4 font-display text-[22px] font-semibold leading-tight text-text">
        {action.label}
      </div>

      {action.enabled ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={fire}
            disabled={pending || !action.cta}
            className="inline-flex items-center gap-2 rounded-[10px] bg-gold px-5 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:bg-gold-strong disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending
              ? <Loader2 size={14} className="animate-spin" />
              : action.cta || "Continue"}
            {!pending && action.cta && <ArrowRight size={14} strokeWidth={2.2} />}
          </button>

        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-[10px] border border-rule bg-surface-2 px-4 py-3 text-[12.5px] leading-relaxed text-text-dim">
          <Lock size={13} className="mt-[3px] shrink-0" />
          <span>{action.disabledReason ?? "You don't have permission for this action."}</span>
        </div>
      )}

      {action.subLine && (
        <div className="mt-3 text-[11.5px] tabular-nums text-text-dim">{action.subLine}</div>
      )}

      {error && (
        <div className="mt-3 rounded-[8px] border border-fault/40 bg-fault/5 px-3 py-2 text-[11.5px] text-fault">
          {error}
        </div>
      )}
    </div>
  );
}

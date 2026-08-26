"use client";

// The hero card on the project detail page. Renders the single primary
// action for the project's current stage. The gold CTA is the ONE gold
// element on the page (spec §2, §6).
//
// The button is DISABLED with an explanatory line when the user's role
// cannot perform it — never hidden. See spec §5 ("Owner is not at the
// site and should not be typing measurements") for the doctrine.
//
// Owner redesign (2026-08-26): the primary CTA is a plain href-based
// navigation for every stage. Schedule-visit and add-measurement are
// no longer primary CTAs — they live in the quick-actions strip owned
// by StartMeasurementFlow.

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { ArrowRight, Lock } from "lucide-react";
import type { NextAction } from "@/modules/projects/next-action";

interface Props {
  action: NextAction;
  projectId: string;
  /** Intercept BUILD_QUOTATION clicks (owner-redesign: pre-order stages
   *  should open the inline invoice wizard, not navigate to the
   *  quotation module). When present, called instead of routing. */
  onCreateInvoice?: () => void;
}

export function NextActionCard({ action, onCreateInvoice }: Props) {
  const router = useRouter();

  function fire(): void {
    if (!action.enabled) return;
    if (action.kind === "BUILD_QUOTATION" && onCreateInvoice) {
      onCreateInvoice();
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
            disabled={!action.cta}
            className="inline-flex items-center gap-2 rounded-[10px] bg-gold px-5 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:bg-gold-strong disabled:cursor-not-allowed disabled:opacity-60"
          >
            {action.cta || "Continue"}
            {action.cta && <ArrowRight size={14} strokeWidth={2.2} />}
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
    </div>
  );
}

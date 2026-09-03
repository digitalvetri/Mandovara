"use client";

// "Mark as completed" — and, once completed, "Reopen".
//
// Why it exists (owner, 2026-09-04): the stepper is the only way to
// change a project's stage, and it refuses every forward jump past
// "Project" until an invoiceable Order exists (StageStepper's
// `forwardBlocked`). That guard is right for the middle of the flow —
// landing at ORDERED with no order dead-ends the Create-invoice CTA —
// but it also made "Completed" unreachable for every project that never
// went down the firm-quote path. Those projects sat at 20% forever,
// which is the number the owner reported.
//
// Finishing a job is not a forward jump through the pipeline, it is a
// statement that the job is over, so it gets its own control and its own
// confirm rather than another dot on the stepper. The server action is
// unchanged: setProjectStatus already requires project.update and has no
// transition table to widen.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { setProjectStatus } from "@/modules/projects/actions";

interface Props {
  projectId: string;
  stage:     string;
}

export function MarkCompleteButton({ projectId, stage }: Props) {
  const router = useRouter();
  const [open, setOpen]   = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start]  = useTransition();

  const isComplete = stage === "COMPLETED";
  // A cancelled project is closed for a different reason; reopening it
  // belongs to the stepper, not here.
  if (stage === "CANCELLED") return null;

  function apply(target: string): void {
    setError(null);
    start(async () => {
      const res = await setProjectStatus({ id: projectId, status: target });
      if (!res.ok) { setError(res.error ?? "Could not change the stage"); return; }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setError(null); setOpen(true); }}
        className={
          "inline-flex h-8 items-center gap-1.5 rounded-[6px] px-3 text-[12px] font-medium transition-colors " +
          (isComplete
            ? "border border-rule bg-surface-2 text-text-dim hover:border-gold hover:text-text"
            : "border border-solid/40 bg-solid/10 text-solid hover:bg-solid/20")
        }
      >
        {isComplete
          ? <><RotateCcw size={13} strokeWidth={1.9} /> Reopen project</>
          : <><CheckCircle2 size={13} strokeWidth={1.9} /> Mark as completed</>}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={isComplete ? "Reopen project" : "Mark project as completed"}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/60 p-4 backdrop-blur-[2px] sm:items-center"
          onClick={(e) => { if (e.target === e.currentTarget && !pending) setOpen(false); }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[420px] overflow-hidden rounded-[14px] border border-rule bg-surface shadow-xl"
          >
            <div className="border-b border-rule px-5 py-4 text-[14px] font-semibold text-text">
              {isComplete ? "Reopen this project?" : "Mark this project as completed?"}
            </div>

            <div className="px-5 py-4 text-[12.5px] leading-relaxed text-text-dim">
              {isComplete
                ? "The project goes back to work in progress and shows on the active list again. Nothing about its invoices, payments or measurements changes."
                : "The project moves to Completed and shows as 100% done. Invoices, payments and measurements are left exactly as they are — this only records that the work is finished."}
            </div>

            {error && (
              <div className="mx-5 mb-4 rounded-[8px] border border-fault/40 bg-fault/5 px-3 py-2 text-[11.5px] text-fault">
                {error}
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 border-t border-rule px-5 py-3.5 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={pending}
                onClick={() => setOpen(false)}
                className="h-9 rounded-[8px] border border-rule px-4 text-[12.5px] text-text-dim transition-colors hover:text-text disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                // Reopening lands on PROCUREMENT — "Installation" in the
                // 5-phase view — rather than ENQUIRY. A project someone
                // had called finished is not back at the enquiry desk.
                onClick={() => apply(isComplete ? "PROCUREMENT" : "COMPLETED")}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] bg-gold px-4 text-[12.5px] font-semibold text-ink transition-colors hover:bg-gold-strong disabled:opacity-60"
              >
                {pending && <Loader2 size={12} className="animate-spin" />}
                {isComplete ? "Reopen" : "Yes, it's completed"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

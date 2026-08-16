"use client";

// Clickable stage stepper. Display-first: a chain of dots across the top
// of the project page. If the caller passes `canEdit`, each dot becomes a
// button that opens a small confirm popover — click Yes to jump the
// project's stage. Auto-advance from doing the work (scheduling a visit,
// submitting a measurement, sending a quote…) is still the primary flow;
// this is the owner's manual override, per spec §0.
//
// completed = solid gold dot, current = gold ring, future = rule.

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PROJECT_PHASES, PHASE_LABEL, PHASE_TARGET_STAGE, phaseForStage } from "@/modules/projects/next-action";
import { setProjectStatus } from "@/modules/projects/actions";

interface Props {
  stage: string;
  projectId?: string;
  canEdit?: boolean;
}

export function StageStepper({ stage, projectId, canEdit = false }: Props) {
  const router = useRouter();
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [pending, start]      = useTransition();
  const rootRef               = useRef<HTMLOListElement>(null);

  const cancelled       = stage === "CANCELLED";
  const currentPhase    = phaseForStage(stage);
  const currentIndex    = cancelled ? -1 : PROJECT_PHASES.indexOf(currentPhase as never);

  useEffect(() => {
    if (openIdx === null) return;
    function onDocClick(e: MouseEvent): void {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpenIdx(null);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [openIdx]);

  function jump(target: string): void {
    if (!projectId) return;
    setError(null);
    start(async () => {
      const res = await setProjectStatus({ id: projectId, status: target });
      if (!res.ok) { setError(res.error ?? "Could not change stage"); return; }
      setOpenIdx(null);
      router.refresh();
    });
  }

  return (
    <>
      <ol
        ref={rootRef}
        className="flex items-center gap-2 overflow-x-auto pb-1"
        aria-label="Project stage"
      >
        {PROJECT_PHASES.map((phase, i) => {
          const done    = !cancelled && i <  currentIndex;
          const current = !cancelled && i === currentIndex;
          const label   = PHASE_LABEL[phase];
          const isOpen  = openIdx === i;
          const editable = canEdit && !cancelled && !current;
          const targetStage = PHASE_TARGET_STAGE[phase];

          const inner = (
            <span
              aria-current={current ? "step" : undefined}
              className={[
                "inline-flex items-center gap-1.5 text-[11.5px] tracking-[0.02em]",
                done    ? "text-text"     :
                current ? "text-text"     :
                          "text-text-dim",
              ].join(" ")}
            >
              <Dot state={done ? "done" : current ? "current" : "future"} />
              {label}
            </span>
          );

          return (
            <li key={phase} className="relative flex items-center gap-2 shrink-0">
              {editable ? (
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : i)}
                  className="rounded-[6px] px-1 py-0.5 hover:bg-surface-2 focus:bg-surface-2 focus:outline-none"
                  aria-haspopup="menu"
                  aria-expanded={isOpen}
                  aria-label={`Move project to ${label}`}
                >
                  {inner}
                </button>
              ) : (
                inner
              )}

              {isOpen && editable && (
                <div
                  role="menu"
                  className="absolute left-0 top-[calc(100%+6px)] z-30 w-[220px] rounded-[10px] border border-rule bg-surface p-3 shadow-lg"
                >
                  <div className="mb-2 text-[11.5px] text-text-dim">
                    Move project to{" "}
                    <span className="text-text">{label}</span>?
                  </div>
                  {error && (
                    <div className="mb-2 rounded-[6px] border border-fault/40 bg-fault/5 px-2 py-1 text-[11px] text-fault">
                      {error}
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setOpenIdx(null)}
                      className="rounded-[6px] px-2.5 py-1 text-[11.5px] text-text-dim hover:text-text disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => jump(targetStage)}
                      className="rounded-[6px] bg-gold px-2.5 py-1 text-[11.5px] font-semibold text-ink hover:bg-gold-strong disabled:opacity-60"
                    >
                      {pending ? "Moving…" : "Yes, move"}
                    </button>
                  </div>
                </div>
              )}

              {i < PROJECT_PHASES.length - 1 && (
                <span aria-hidden className="h-px w-6 bg-rule" />
              )}
            </li>
          );
        })}
        {cancelled && (
          <li className="ml-2 rounded-[4px] border border-fault/40 px-2 py-0.5 text-[10.5px] uppercase tracking-[0.14em] text-fault">
            Cancelled
          </li>
        )}
      </ol>

      {canEdit && !cancelled && (
        <div className="mt-1.5 text-[10.5px] text-text-subtle">
          Stages advance automatically as work happens. Click a stage to override manually.
        </div>
      )}
    </>
  );
}

function Dot({ state }: { state: "done" | "current" | "future" }) {
  if (state === "done") {
    return <span aria-hidden className="h-2 w-2 rounded-full bg-gold" />;
  }
  if (state === "current") {
    return (
      <span aria-hidden className="relative inline-flex h-2.5 w-2.5 items-center justify-center">
        <span className="absolute inset-0 rounded-full border-2 border-gold" />
        <span className="h-1 w-1 rounded-full bg-gold" />
      </span>
    );
  }
  return <span aria-hidden className="h-2 w-2 rounded-full border border-rule" />;
}

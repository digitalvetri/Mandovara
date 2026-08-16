"use client";

// Clickable phase pill on the project-list cards. Tap the pill → small
// popover of the 4 phases; pick one → setProjectStatus fires and the
// list refreshes.
//
// The parent card is a <Link>, so every event handler here stops
// propagation to prevent the outer link from navigating when the user
// really meant to change status.

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import {
  PROJECT_PHASES, PHASE_LABEL, PHASE_TARGET_STAGE, phaseForStage,
  type ProjectPhase,
} from "@/modules/projects/next-action";
import { setProjectStatus } from "@/modules/projects/actions";

const PHASE_TONE: Record<string, { color: string; bg: string }> = {
  SITE_VISIT:   { color: "text-info",  bg: "bg-info/12"  },
  MEASUREMENT:  { color: "text-heat",  bg: "bg-heat/12"  },
  INSTALLATION: { color: "text-solid", bg: "bg-solid/12" },
  COMPLETED:    { color: "text-solid", bg: "bg-solid/12" },
  CANCELLED:    { color: "text-fault", bg: "bg-fault/12" },
};

interface Props {
  projectId: string;
  stage:     string;
  canEdit:   boolean;
}

export function InteractiveStagePill({ projectId, stage, canEdit }: Props) {
  const router = useRouter();
  const [open, setOpen]     = useState(false);
  const [pending, start]    = useTransition();
  const [error, setError]   = useState<string | null>(null);
  const rootRef             = useRef<HTMLSpanElement>(null);

  const phase = phaseForStage(stage);
  const isCancelled = phase === "CANCELLED";
  const activePhase = isCancelled ? null : (phase as ProjectPhase);
  const tone = PHASE_TONE[phase] ?? PHASE_TONE.SITE_VISIT!;
  const label = phase === "CANCELLED" ? "Cancelled" : PHASE_LABEL[activePhase!];

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent): void {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown",  onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown",  onKey);
    };
  }, [open]);

  function stop(e: React.SyntheticEvent): void {
    e.preventDefault();
    e.stopPropagation();
  }

  function toggle(e: React.SyntheticEvent): void {
    stop(e);
    if (!canEdit || pending) return;
    setError(null);
    setOpen((v) => !v);
  }

  function move(e: React.SyntheticEvent, targetPhase: ProjectPhase): void {
    stop(e);
    if (targetPhase === activePhase) { setOpen(false); return; }
    setError(null);
    start(async () => {
      const r = await setProjectStatus({ id: projectId, status: PHASE_TARGET_STAGE[targetPhase] });
      if (!r.ok) { setError(r.error ?? "Could not change stage"); return; }
      setOpen(false);
      router.refresh();
    });
  }

  const pillCls = `rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${tone.bg} ${tone.color}`;

  return (
    <span ref={rootRef} className="relative inline-flex">
      {canEdit ? (
        <span
          role="button"
          tabIndex={0}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Change stage from ${label}`}
          onClick={toggle}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggle(e); }}
          className={`${pillCls} cursor-pointer hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold`}
        >
          {label}
        </span>
      ) : (
        <span className={pillCls}>{label}</span>
      )}

      {open && (
        <span
          role="menu"
          onClick={stop}
          className="absolute right-0 top-[calc(100%+6px)] z-20 w-[180px] rounded-[10px] border border-rule bg-surface p-1 shadow-lg"
        >
          {PROJECT_PHASES.map((p) => {
            const isCurrent = p === activePhase;
            return (
              <span
                key={p}
                role="menuitem"
                tabIndex={0}
                onClick={(e) => move(e, p)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") move(e, p); }}
                className={`
                  flex cursor-pointer items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-[12px]
                  ${isCurrent ? "text-gold" : "text-text hover:bg-surface-2"}
                  ${pending ? "pointer-events-none opacity-60" : ""}
                `}
              >
                <Check size={11} className={isCurrent ? "" : "opacity-0"} />
                {PHASE_LABEL[p]}
              </span>
            );
          })}
          {error && (
            <span className="block mt-1 rounded-[6px] border border-fault/40 bg-fault/5 px-2 py-1 text-[10.5px] text-fault">
              {error}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

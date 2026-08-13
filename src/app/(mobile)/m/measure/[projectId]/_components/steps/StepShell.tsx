"use client";

// Shared layout for every step in the item flow. Ensures the primary
// action is always thumb-reachable (bottom of the viewport) and every
// tap target hits ≥56px per spec §8.

import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

interface StepShellProps {
  title:      string;
  hint?:      ReactNode;
  onBack?:    () => void;
  onNext?:    () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  children:   ReactNode;
}

export function StepShell({
  title, hint, onBack, onNext, nextLabel = "Next", nextDisabled = false, children,
}: StepShellProps) {
  return (
    <div className="flex-1 flex flex-col">
      <div className="mb-3">
        <h2
          className="text-[20px] leading-tight font-medium"
          style={{ fontFamily: "'Fraunces', Georgia, serif" }}
        >
          {title}
        </h2>
        {hint && <p className="mt-1 text-[12px] text-text-dim">{hint}</p>}
      </div>

      <div className="flex-1">{children}</div>

      <div className="sticky bottom-4 pt-4 flex items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="h-[56px] w-[56px] grid place-items-center rounded-[12px] border border-rule text-text hover:bg-surface-hover"
            aria-label="Back"
          >
            <ChevronLeft size={22} />
          </button>
        )}
        {onNext && (
          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled}
            className="flex-1 h-[56px] rounded-[12px] bg-gold text-ink text-[15px] font-medium hover:bg-gold-strong disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {nextLabel}
          </button>
        )}
      </div>
    </div>
  );
}

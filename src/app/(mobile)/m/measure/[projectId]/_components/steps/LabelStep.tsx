"use client";

import { StepShell } from "./StepShell";

interface LabelStepProps {
  value:    string;
  onChange: (v: string) => void;
  onBack:   () => void;
  onNext:   () => void;
}

export function LabelStep({ value, onChange, onBack, onNext }: LabelStepProps) {
  const trimmed = value.trim();
  return (
    <StepShell
      title="Name this item"
      hint="A short label the tailor and installer can read at a glance."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={trimmed.length === 0}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Window 1 — East"
        autoFocus
        maxLength={120}
        className="w-full h-[56px] rounded-[10px] border border-rule bg-surface px-4 text-[16px] text-text placeholder:text-text-faint"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className="rounded-full border border-rule px-3 py-1.5 text-[11.5px] text-text-dim hover:text-text hover:border-gold"
          >
            {s}
          </button>
        ))}
      </div>
    </StepShell>
  );
}

const SUGGESTIONS = [
  "Window 1", "Window 2", "Door",
  "Feature wall", "North wall", "South wall",
  "Floor", "Ceiling",
];

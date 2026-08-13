"use client";

import { StepShell } from "./StepShell";
import type { Surface } from "../types";

interface SurfaceStepProps {
  value:    Surface;
  onChange: (v: Surface) => void;
  onBack:   () => void;
  onNext:   () => void;
}

const OPTIONS: { value: Surface; label: string; hint: string }[] = [
  { value: "WINDOW",    label: "Window",    hint: "Curtain, blind, film" },
  { value: "WALL",      label: "Wall",      hint: "Wallpaper, mural, film" },
  { value: "FLOOR",     label: "Floor",     hint: "Flooring, carpet" },
  { value: "CEILING",   label: "Ceiling",   hint: "Vertical garden, mural" },
  { value: "GLASS",     label: "Glass",     hint: "Film, frosting" },
  { value: "FURNITURE", label: "Furniture", hint: "Upholstery, film" },
];

export function SurfaceStep({ value, onChange, onBack, onNext }: SurfaceStepProps) {
  return (
    <StepShell
      title="What surface?"
      hint="This changes which downstream calculations run."
      onBack={onBack}
      onNext={onNext}
    >
      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={`min-h-[80px] rounded-[10px] border px-3 py-2 text-left ${
                active ? "border-gold bg-gold-tint" : "border-rule bg-surface hover:border-gold/50"
              }`}
            >
              <div className="text-[14px] font-medium text-text">{o.label}</div>
              <div className="text-[10.5px] text-text-dim mt-0.5">{o.hint}</div>
            </button>
          );
        })}
      </div>
    </StepShell>
  );
}

"use client";

import { StepShell } from "./StepShell";
import type { Family } from "../types";

interface FamilyStepProps {
  value:    Family;
  onChange: (v: Family) => void;
  onBack:   () => void;
  onNext:   () => void;
}

// The commonly-measured families are surfaced first. Rare cases
// (motor, hardware) fold into a "More" list to keep the primary view
// scan-able in poor lighting.
const PRIMARY: { value: Family; label: string; subtext: string }[] = [
  { value: "CURTAIN_FABRIC",    label: "Curtain",    subtext: "Fabric, main" },
  { value: "SHEER",             label: "Sheer",      subtext: "Light diffuser" },
  { value: "BLIND",             label: "Blind",      subtext: "Roller, cellular, panel" },
  { value: "WALLPAPER",         label: "Wallpaper",  subtext: "Roll goods" },
  { value: "FLOORING",          label: "Flooring",   subtext: "Laminate, SPC, vinyl" },
  { value: "CARPET_ROLL",       label: "Carpet",     subtext: "Wall-to-wall" },
  { value: "CARPET_TILE",       label: "Carpet tile", subtext: "500×500 tile" },
  { value: "INTERIOR_FILM",     label: "Film",       subtext: "Furniture, glass, wall" },
];

export function FamilyStep({ value, onChange, onBack, onNext }: FamilyStepProps) {
  return (
    <StepShell
      title="Which product?"
      hint="Determines which extras we'll ask for next."
      onBack={onBack}
      onNext={onNext}
    >
      <div className="space-y-2">
        {PRIMARY.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={`w-full min-h-[56px] flex items-center justify-between px-4 rounded-[10px] border ${
                active ? "border-gold bg-gold-tint" : "border-rule hover:border-gold/50"
              }`}
            >
              <div className="flex flex-col items-start">
                <span className="text-[14px] font-medium text-text">{o.label}</span>
                <span className="text-[10.5px] text-text-dim">{o.subtext}</span>
              </div>
              {active && (
                <span className="text-[10.5px] uppercase tracking-[0.06em] text-gold-strong">Picked</span>
              )}
            </button>
          );
        })}
      </div>
    </StepShell>
  );
}

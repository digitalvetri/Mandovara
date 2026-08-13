"use client";

// Width + height + quantity, with a unit toggle that is ALWAYS
// visible — spec §8 explicitly calls this out. Numeric keypad on
// every dimension field. LiveCalc renders below the inputs.

import type { ItemDraft, Unit } from "../types";
import { UNIT_LABEL } from "../unit-convert";
import { StepShell } from "./StepShell";
import { LiveCalc } from "./LiveCalc";

interface DimsStepProps {
  draft:        ItemDraft;
  unit:         Unit;
  onUnitChange: (u: Unit) => void;
  onChange:     (patch: Partial<ItemDraft>) => void;
  onBack:       () => void;
  onNext:       () => void;
}

const UNITS: Unit[] = ["mm", "in", "ft"];

export function DimsStep({ draft, unit, onUnitChange, onChange, onBack, onNext }: DimsStepProps) {
  const disabled = !draft.widthMm.trim() || !draft.heightMm.trim();

  return (
    <StepShell
      title="Dimensions"
      hint="Stored in millimetres, no matter which unit you type in."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={disabled}
    >
      {/* Unit toggle */}
      <div className="inline-flex rounded-[10px] border border-rule bg-surface p-1 mb-4">
        {UNITS.map((u) => (
          <button
            key={u}
            type="button"
            onClick={() => onUnitChange(u)}
            className={`min-w-[64px] h-[36px] rounded-[7px] text-[12.5px] font-medium ${
              unit === u ? "bg-gold text-ink" : "text-text-dim hover:text-text"
            }`}
          >
            {UNIT_LABEL[u]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <DimField
          label="Width"
          suffix={UNIT_LABEL[unit]}
          value={draft.widthMm}
          onChange={(v) => onChange({ widthMm: v })}
        />
        <DimField
          label="Height"
          suffix={UNIT_LABEL[unit]}
          value={draft.heightMm}
          onChange={(v) => onChange({ heightMm: v })}
        />
      </div>

      <div className="mt-3">
        <DimField
          label="Quantity"
          suffix="× identical"
          value={draft.quantity}
          onChange={(v) => onChange({ quantity: v })}
          integer
        />
      </div>

      <LiveCalc draft={draft} unit={unit} />
    </StepShell>
  );
}

interface DimFieldProps {
  label:    string;
  suffix:   string;
  value:    string;
  onChange: (v: string) => void;
  integer?: boolean;
}

function DimField({ label, suffix, value, onChange, integer }: DimFieldProps) {
  return (
    <label className="block">
      <div className="text-[10.5px] uppercase tracking-[0.06em] text-text-dim mb-1">
        {label} <span className="text-text-faint">· {suffix}</span>
      </div>
      <input
        type="text"
        inputMode={integer ? "numeric" : "decimal"}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        className="w-full h-[56px] rounded-[10px] border border-rule bg-surface px-4 text-[18px] tabular text-text placeholder:text-text-faint"
        placeholder="0"
      />
    </label>
  );
}

"use client";

// Family-specific extras — spec §6.4 required fields.
//   CURTAIN_FABRIC / SHEER → headingType + fullness
//   FLOORING              → layPattern
//   BLIND                 → mountType (with defaults for INSIDE clearance)

import type { ItemDraft, Unit, Heading, Lay, MountKind } from "../types";
import { HEADING_TYPES, LAY_PATTERNS, MOUNT_TYPES } from "@/modules/measurement/schema";
import { StepShell } from "./StepShell";
import { LiveCalc } from "./LiveCalc";

interface ExtrasStepProps {
  draft:    ItemDraft;
  unit:     Unit;
  onChange: (patch: Partial<ItemDraft>) => void;
  onBack:   () => void;
  onNext:   () => void;
}

export function ExtrasStep({ draft, unit, onChange, onBack, onNext }: ExtrasStepProps) {
  const family = draft.family;

  const needsCurtain  = family === "CURTAIN_FABRIC" || family === "SHEER";
  const needsFlooring = family === "FLOORING";
  const needsBlind    = family === "BLIND";

  return (
    <StepShell title="A few details" onBack={onBack} onNext={onNext}>
      {needsCurtain && (
        <>
          <ChipRow<Heading>
            label="Heading"
            options={HEADING_TYPES}
            value={draft.headingType ?? "EYELET"}
            onChange={(v) => onChange({ headingType: v })}
          />
          <div className="mt-4">
            <div className="text-[10.5px] uppercase tracking-[0.06em] text-text-dim mb-1">Fullness</div>
            <input
              type="text"
              inputMode="decimal"
              value={draft.fullness ?? "2.5"}
              onChange={(e) => onChange({ fullness: e.target.value.replace(/[^0-9.]/g, "") })}
              placeholder="2.5"
              className="w-full h-[56px] rounded-[10px] border border-rule bg-surface px-4 text-[18px] tabular text-text"
            />
          </div>
        </>
      )}
      {needsFlooring && (
        <ChipRow<Lay>
          label="Lay pattern"
          options={LAY_PATTERNS}
          value={draft.layPattern ?? "STRAIGHT"}
          onChange={(v) => onChange({ layPattern: v })}
        />
      )}
      {needsBlind && (
        <ChipRow<MountKind>
          label="Mount"
          options={MOUNT_TYPES}
          value={draft.mountType ?? "INSIDE"}
          onChange={(v) => onChange({ mountType: v })}
        />
      )}

      <LiveCalc draft={draft} unit={unit} />
    </StepShell>
  );
}

interface ChipRowProps<T extends string> {
  label:    string;
  options:  readonly T[];
  value:    T;
  onChange: (v: T) => void;
}

function ChipRow<T extends string>({ label, options, value, onChange }: ChipRowProps<T>) {
  return (
    <div className="mb-2">
      <div className="text-[10.5px] uppercase tracking-[0.06em] text-text-dim mb-1">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = value === o;
          return (
            <button
              key={o}
              type="button"
              onClick={() => onChange(o)}
              className={`min-h-[44px] rounded-full px-3 border text-[12px] font-medium ${
                active ? "border-gold bg-gold-tint text-text" : "border-rule text-text-dim hover:text-text"
              }`}
            >
              {o.replace(/_/g, " ").toLowerCase()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

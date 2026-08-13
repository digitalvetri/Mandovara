"use client";

// Review + save. Every previous step is one tap away — the measurer
// can jump back to a specific field without re-typing anything.
// Primary action queues the item to the outbox and springs to a
// fresh draft.

import type { ItemDraft, FieldRoom, Unit, FlowStep } from "../types";
import { UNIT_LABEL, fromMm, toMm } from "../unit-convert";
import { StepShell } from "./StepShell";

interface ReviewStepProps {
  draft: ItemDraft;
  unit:  Unit;
  room:  FieldRoom | null;
  onEdit: (step: FlowStep) => void;
  onBack: () => void;
  onSave: () => void;
}

export function ReviewStep({ draft, unit, room, onEdit, onBack, onSave }: ReviewStepProps) {
  const wMm = toMm(draft.widthMm, unit) ?? 0;
  const hMm = toMm(draft.heightMm, unit) ?? 0;
  const q   = parseInt(draft.quantity, 10) || 1;
  const disabled = wMm <= 0 || hMm <= 0 || draft.label.trim().length === 0;

  return (
    <StepShell
      title="Ready to queue"
      hint="Saved to this device — the app syncs when you're back online."
      onBack={onBack}
      onNext={onSave}
      nextDisabled={disabled}
      nextLabel="Save & next item"
    >
      <ul className="rounded-[10px] border border-rule bg-surface divide-y divide-rule">
        <Row label="Room"      value={room?.name ?? "—"}                                 onEdit={() => onEdit("room")} />
        <Row label="Label"     value={draft.label || "—"}                               onEdit={() => onEdit("label")} />
        <Row label="Surface"   value={draft.surface}                                    onEdit={() => onEdit("surface")} />
        <Row label="Product"   value={draft.family.replace(/_/g, " ")}                  onEdit={() => onEdit("family")} />
        <Row
          label="Dimensions"
          value={`${draft.widthMm || "?"} × ${draft.heightMm || "?"} ${UNIT_LABEL[unit]} × ${q}`}
          sub={wMm && hMm ? `${fromMm(wMm, "mm")} × ${fromMm(hMm, "mm")} mm stored` : undefined}
          onEdit={() => onEdit("dims")}
        />
        {draft.headingType && (
          <Row label="Heading" value={`${draft.headingType.replace(/_/g, " ")} · fullness ${draft.fullness ?? "2.5"}`} onEdit={() => onEdit("extras")} />
        )}
        {draft.layPattern && (
          <Row label="Lay"     value={draft.layPattern} onEdit={() => onEdit("extras")} />
        )}
        {draft.mountType && (
          <Row label="Mount"   value={draft.mountType} onEdit={() => onEdit("extras")} />
        )}
        <Row label="Photo"     value={draft.photoKey ? "Attached" : "None"}   onEdit={() => onEdit("photo")} />
        <Row label="Sketch"    value={draft.sketchKey ? "Attached" : "None"}  onEdit={() => onEdit("sketch")} />
      </ul>
    </StepShell>
  );
}

interface RowProps {
  label:  string;
  value:  string;
  sub?:   string;
  onEdit: () => void;
}

function Row({ label, value, sub, onEdit }: RowProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onEdit}
        className="w-full min-h-[56px] flex items-center justify-between gap-3 px-4 py-2 text-left hover:bg-surface-hover"
      >
        <div className="text-[10.5px] uppercase tracking-[0.06em] text-text-dim min-w-[80px]">{label}</div>
        <div className="flex-1 text-right">
          <div className="text-[13px] text-text tabular">{value}</div>
          {sub && <div className="text-[10.5px] text-text-faint">{sub}</div>}
        </div>
        <span className="text-[10.5px] text-gold-strong uppercase tracking-[0.06em]">Edit</span>
      </button>
    </li>
  );
}

"use client";

// One item, one step at a time. State machine drives:
//   room → label → surface → family → dims → extras → photo → sketch → review
// LiveCalc renders under the dims + extras steps so the measurer sees
// the material update as they type.
//
// A completed item is enqueued to IndexedDB — the drain worker takes
// it from there. The UI does NOT wait for the server; the next item
// starts immediately (spec §5.3 "add item → next item ready < 300ms").

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { clientCuid, enqueueOutbox } from "@/lib/measure-outbox";
import type { FieldRoom, ItemDraft, FlowStep, Unit } from "./types";
import { RoomStep }    from "./steps/RoomStep";
import { LabelStep }   from "./steps/LabelStep";
import { SurfaceStep } from "./steps/SurfaceStep";
import { FamilyStep }  from "./steps/FamilyStep";
import { DimsStep }    from "./steps/DimsStep";
import { ExtrasStep }  from "./steps/ExtrasStep";
import { PhotoStep }   from "./steps/PhotoStep";
import { SketchStep }  from "./steps/SketchStep";
import { ReviewStep }  from "./steps/ReviewStep";

interface ItemFlowProps {
  projectId:        string;
  measurementId:    string;
  rooms:            FieldRoom[];
  initialItemCount: number;
  onRoomAdded:      (name: string) => Promise<FieldRoom | null>;
}

const CURTAIN_FAMILIES = new Set(["CURTAIN_FABRIC", "SHEER"]);
const FLOORING_FAMILIES = new Set(["FLOORING"]);
const BLIND_FAMILIES = new Set(["BLIND"]);

function emptyDraft(cuid: string, roomId: string): ItemDraft {
  return {
    clientCuid:  cuid,
    roomId,
    label:       "",
    surface:     "WINDOW",
    family:      "CURTAIN_FABRIC",
    widthMm:     "",
    heightMm:    "",
    quantity:    "1",
  };
}

export function ItemFlow({
  projectId, measurementId, rooms, initialItemCount, onRoomAdded,
}: ItemFlowProps) {
  const [itemCount, setItemCount] = useState(initialItemCount);
  const [unit, setUnit]           = useState<Unit>("mm");
  const [draft, setDraft]         = useState<ItemDraft>(() => emptyDraft(clientCuid(), rooms[0]?.id ?? ""));
  const [step, setStep]           = useState<FlowStep>(rooms.length > 0 ? "label" : "room");

  const currentRoom = useMemo(() => rooms.find((r) => r.id === draft.roomId) ?? null, [rooms, draft.roomId]);

  const needsExtras = useMemo(() => {
    if (CURTAIN_FAMILIES.has(draft.family)) return true;
    if (FLOORING_FAMILIES.has(draft.family)) return true;
    if (BLIND_FAMILIES.has(draft.family)) return true;
    return false;
  }, [draft.family]);

  function goTo(next: FlowStep): void {
    setStep(next);
  }

  function goNextFromDims(): void {
    if (needsExtras) goTo("extras");
    else goTo("photo");
  }

  async function saveAndNext(): Promise<void> {
    await enqueueOutbox({
      id:        draft.clientCuid,
      projectId,
      payload:   toEnqueuePayload(draft, measurementId, unit),
    });
    setItemCount((n) => n + 1);
    setDraft(emptyDraft(clientCuid(), draft.roomId));
    setStep(rooms.length > 0 ? "label" : "room");
  }

  const stepIndex = STEP_ORDER.indexOf(step) + 1;

  return (
    <main className="flex-1 flex flex-col pb-24">
      {/* Step chip + room chip */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1 text-[11.5px]">
        <div className="flex items-center gap-2 text-text-dim">
          <span className="tabular">{stepIndex}/{STEP_ORDER.length}</span>
          <ChevronRight size={11} />
          <span className="uppercase tracking-[0.05em]">{STEP_LABEL[step]}</span>
        </div>
        <div className="text-text-dim">
          <span className="tabular text-text">{itemCount}</span> items · {currentRoom?.name ?? "no room"}
        </div>
      </div>

      <div className="flex-1 px-4 pt-4">
        {step === "room" && (
          <RoomStep
            rooms={rooms}
            selectedId={draft.roomId}
            onPick={(id) => { setDraft((d) => ({ ...d, roomId: id })); goTo("label"); }}
            onCreate={async (name) => {
              const room = await onRoomAdded(name);
              if (room) {
                setDraft((d) => ({ ...d, roomId: room.id }));
                goTo("label");
              }
            }}
          />
        )}
        {step === "label" && (
          <LabelStep
            value={draft.label}
            onChange={(v) => setDraft((d) => ({ ...d, label: v }))}
            onBack={() => goTo("room")}
            onNext={() => goTo("surface")}
          />
        )}
        {step === "surface" && (
          <SurfaceStep
            value={draft.surface}
            onChange={(v) => setDraft((d) => ({ ...d, surface: v }))}
            onBack={() => goTo("label")}
            onNext={() => goTo("family")}
          />
        )}
        {step === "family" && (
          <FamilyStep
            value={draft.family}
            onChange={(v) => setDraft((d) => ({ ...d, family: v }))}
            onBack={() => goTo("surface")}
            onNext={() => goTo("dims")}
          />
        )}
        {step === "dims" && (
          <DimsStep
            draft={draft}
            unit={unit}
            onUnitChange={setUnit}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
            onBack={() => goTo("family")}
            onNext={goNextFromDims}
          />
        )}
        {step === "extras" && (
          <ExtrasStep
            draft={draft}
            unit={unit}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
            onBack={() => goTo("dims")}
            onNext={() => goTo("photo")}
          />
        )}
        {step === "photo" && (
          <PhotoStep
            hasPhoto={!!draft.photoKey}
            onCaptured={(key) => setDraft((d) => ({ ...d, photoKey: key }))}
            onSkip={() => goTo("sketch")}
            onBack={() => (needsExtras ? goTo("extras") : goTo("dims"))}
            onNext={() => goTo("sketch")}
          />
        )}
        {step === "sketch" && (
          <SketchStep
            hasSketch={!!draft.sketchKey}
            onCaptured={(key) => setDraft((d) => ({ ...d, sketchKey: key }))}
            onSkip={() => goTo("review")}
            onBack={() => goTo("photo")}
            onNext={() => goTo("review")}
          />
        )}
        {step === "review" && (
          <ReviewStep
            draft={draft}
            unit={unit}
            room={currentRoom}
            onEdit={goTo}
            onBack={() => goTo("sketch")}
            onSave={saveAndNext}
          />
        )}
      </div>
    </main>
  );
}

const STEP_ORDER: readonly FlowStep[] = [
  "room", "label", "surface", "family", "dims", "extras", "photo", "sketch", "review",
];
const STEP_LABEL: Record<FlowStep, string> = {
  room:    "Room",
  label:   "Label",
  surface: "Surface",
  family:  "Product",
  dims:    "Dimensions",
  extras:  "Details",
  photo:   "Photo",
  sketch:  "Sketch",
  review:  "Review",
};

// Turn a draft + unit selection into an addItemSchema-compatible
// payload. Dimensions are stored in mm — the display unit is a UI
// concept only (§6.1).
function toEnqueuePayload(draft: ItemDraft, measurementId: string, unit: Unit): Record<string, unknown> {
  const toMm = (v: string): number => {
    const n = parseFloat(v);
    if (!Number.isFinite(n) || n <= 0) return 0;
    if (unit === "mm") return n;
    if (unit === "in") return n * 25.4;
    return n * 304.8;
  };
  const payload: Record<string, unknown> = {
    clientCuid:    draft.clientCuid,
    measurementId,
    roomId:        draft.roomId,
    label:         draft.label.trim(),
    surface:       draft.surface,
    widthMm:       toMm(draft.widthMm),
    heightMm:      toMm(draft.heightMm),
    quantity:      parseInt(draft.quantity, 10) || 1,
    family:        draft.family,
  };
  if (draft.headingType) payload.headingType = draft.headingType;
  if (draft.fullness)    payload.fullness    = parseFloat(draft.fullness);
  if (draft.layPattern)  payload.layPattern  = draft.layPattern;
  if (draft.mountType)   payload.mountType   = draft.mountType;
  if (draft.family === "WALLPAPER") payload.deductions = [];
  if (draft.photoKey)    payload.photoKeys   = [draft.photoKey];
  if (draft.sketchKey)   payload.sketchKey   = draft.sketchKey;
  if (draft.notes)       payload.notes       = draft.notes;
  return payload;
}

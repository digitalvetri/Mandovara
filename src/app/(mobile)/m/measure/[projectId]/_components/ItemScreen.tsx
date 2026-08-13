"use client";

// One item, one screen (spec §5.3 wireframe). Every field is
// visible; the measurer types top to bottom and the live calc
// updates in place. Photo + Sketch are inline modals so we never
// navigate away and never lose the draft. NEXT ITEM enqueues to
// the offline outbox and resets the form to a fresh clientCuid
// while keeping the same room.

import { useMemo, useState } from "react";
import { Camera, PenTool, MapPin, Loader2 } from "lucide-react";
import { clientCuid, enqueueOutbox } from "@/lib/measure-outbox";
import {
  HEADING_TYPES, LAY_PATTERNS, MOUNT_TYPES, PRODUCT_FAMILIES, SURFACE_TYPES,
} from "@/modules/measurement/schema";
import type { FieldRoom, ItemDraft, Unit, Heading, Lay, MountKind } from "./types";
import { UNIT_LABEL } from "./unit-convert";
import { LiveCalc } from "./LiveCalc";
import { RoomPickerModal } from "./RoomPickerModal";
import { PhotoModal } from "./PhotoModal";
import { SketchModal } from "./SketchModal";
import { toEnqueuePayload } from "./enqueue";
import { DimField, EvidenceButton, Field, SelectPill } from "./field-primitives";

interface ItemScreenProps {
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
    clientCuid: cuid, roomId,
    label:      "",
    surface:    "WINDOW",
    family:     "CURTAIN_FABRIC",
    widthMm:    "",
    heightMm:   "",
    quantity:   "1",
  };
}

export function ItemScreen({
  projectId, measurementId, rooms, initialItemCount, onRoomAdded,
}: ItemScreenProps) {
  const [itemCount, setItemCount] = useState(initialItemCount);
  const [unit, setUnit]           = useState<Unit>("mm");
  const [draft, setDraft]         = useState<ItemDraft>(() => emptyDraft(clientCuid(), rooms[0]?.id ?? ""));
  const [showRoom, setShowRoom]   = useState(!draft.roomId);
  const [showPhoto, setShowPhoto] = useState(false);
  const [showSketch, setShowSketch] = useState(false);
  const [saving, setSaving]       = useState(false);

  const room = useMemo(() => rooms.find((r) => r.id === draft.roomId) ?? null, [rooms, draft.roomId]);
  const needsHeading = CURTAIN_FAMILIES.has(draft.family);
  const needsLay     = FLOORING_FAMILIES.has(draft.family);
  const needsMount   = BLIND_FAMILIES.has(draft.family);

  const disabled =
    !draft.roomId ||
    draft.label.trim().length === 0 ||
    !draft.widthMm.trim() ||
    !draft.heightMm.trim();

  async function saveAndNext(): Promise<void> {
    if (disabled) return;
    setSaving(true);
    try {
      await enqueueOutbox({
        id:        draft.clientCuid,
        projectId,
        payload:   toEnqueuePayload(draft, measurementId, unit),
      });
      setItemCount((n) => n + 1);
      setDraft(emptyDraft(clientCuid(), draft.roomId));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col pb-24">
      {/* Sub-header: room name (tappable) + item count */}
      <div className="sticky top-[52px] z-10 flex items-center justify-between bg-ink/95 backdrop-blur-sm px-4 py-2.5 border-b border-rule">
        <button
          type="button"
          onClick={() => setShowRoom(true)}
          className="min-h-[36px] inline-flex items-center gap-1.5 text-[13px] font-medium text-text hover:text-gold"
        >
          <MapPin size={13} className="text-gold-strong" />
          {room?.name ?? "Pick a room"}
        </button>
        <div className="text-[11.5px] text-text-dim tabular">
          Item <span className="text-text">#{itemCount + 1}</span>
          {" · "}<span className="text-text">{itemCount}</span> saved
        </div>
      </div>

      <div className="flex-1 px-4 pt-4 space-y-4">
        {/* Label */}
        <Field label="Label">
          <input
            type="text"
            value={draft.label}
            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
            placeholder="Window 1 — East"
            maxLength={120}
            className="w-full h-[56px] rounded-[10px] border border-rule bg-surface px-4 text-[16px] text-text placeholder:text-text-faint"
          />
        </Field>

        {/* Surface + Family */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Surface">
            <SelectPill value={draft.surface} options={SURFACE_TYPES}
              onChange={(v) => setDraft((d) => ({ ...d, surface: v as typeof draft.surface }))} />
          </Field>
          <Field label="Product">
            <SelectPill value={draft.family} options={PRODUCT_FAMILIES}
              onChange={(v) => setDraft((d) => ({ ...d, family: v as typeof draft.family }))} />
          </Field>
        </div>

        {/* Unit toggle */}
        <div className="inline-flex rounded-[10px] border border-rule bg-surface p-1">
          {(["mm", "in", "ft"] as Unit[]).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              className={`min-w-[60px] h-[32px] rounded-[7px] text-[12px] font-medium ${
                unit === u ? "bg-gold text-ink" : "text-text-dim"
              }`}
            >
              {UNIT_LABEL[u]}
            </button>
          ))}
        </div>

        {/* Width / Height / Quantity */}
        <div className="grid grid-cols-2 gap-3">
          <DimField label={`Width · ${UNIT_LABEL[unit]}`}  value={draft.widthMm}
            onChange={(v) => setDraft((d) => ({ ...d, widthMm: v }))} />
          <DimField label={`Height · ${UNIT_LABEL[unit]}`} value={draft.heightMm}
            onChange={(v) => setDraft((d) => ({ ...d, heightMm: v }))} />
        </div>
        <DimField label="Quantity" value={draft.quantity} integer
          onChange={(v) => setDraft((d) => ({ ...d, quantity: v }))} />

        {/* Family-specific extras — inline, not a separate screen */}
        {needsHeading && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Heading">
              <SelectPill<Heading> value={draft.headingType ?? "EYELET"} options={HEADING_TYPES}
                onChange={(v) => setDraft((d) => ({ ...d, headingType: v }))} />
            </Field>
            <DimField label="Fullness" value={draft.fullness ?? "2.5"}
              onChange={(v) => setDraft((d) => ({ ...d, fullness: v }))} />
          </div>
        )}
        {needsLay && (
          <Field label="Lay pattern">
            <SelectPill<Lay> value={draft.layPattern ?? "STRAIGHT"} options={LAY_PATTERNS}
              onChange={(v) => setDraft((d) => ({ ...d, layPattern: v }))} />
          </Field>
        )}
        {needsMount && (
          <Field label="Mount">
            <SelectPill<MountKind> value={draft.mountType ?? "INSIDE"} options={MOUNT_TYPES}
              onChange={(v) => setDraft((d) => ({ ...d, mountType: v }))} />
          </Field>
        )}

        {/* Live calc — the moment the product earns its price */}
        <LiveCalc draft={draft} unit={unit} />

        {/* Photo + Sketch inline */}
        <div className="grid grid-cols-2 gap-3">
          <EvidenceButton
            label="Photo"
            icon={<Camera size={16} />}
            attached={!!draft.photoKey}
            onOpen={() => setShowPhoto(true)}
          />
          <EvidenceButton
            label="Sketch"
            icon={<PenTool size={16} />}
            attached={!!draft.sketchKey}
            onOpen={() => setShowSketch(true)}
          />
        </div>

        {/* NEXT ITEM — gold, thumb-reachable */}
        <button
          type="button"
          onClick={saveAndNext}
          disabled={disabled || saving}
          className="w-full min-h-[56px] rounded-[12px] bg-gold text-ink text-[15px] font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gold-strong transition-colors inline-flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : null}
          {saving ? "Saving…" : "Next item →"}
        </button>
      </div>

      {/* Modals */}
      {showRoom && (
        <RoomPickerModal
          rooms={rooms}
          selectedId={draft.roomId}
          onPick={(id) => setDraft((d) => ({ ...d, roomId: id }))}
          onCreate={async (name) => {
            const created = await onRoomAdded(name);
            if (created) setDraft((d) => ({ ...d, roomId: created.id }));
          }}
          onClose={() => setShowRoom(false)}
        />
      )}
      {showPhoto && (
        <PhotoModal
          {...(draft.photoKey ? { existing: draft.photoKey } : {})}
          onSave={(url) => setDraft((d) => ({ ...d, photoKey: url }))}
          onClear={() => setDraft((d) => ({ ...d, photoKey: undefined }))}
          onClose={() => setShowPhoto(false)}
        />
      )}
      {showSketch && (
        <SketchModal
          {...(draft.sketchKey ? { existing: draft.sketchKey } : {})}
          onSave={(url) => setDraft((d) => ({ ...d, sketchKey: url }))}
          onClear={() => setDraft((d) => ({ ...d, sketchKey: undefined }))}
          onClose={() => setShowSketch(false)}
        />
      )}
    </main>
  );
}


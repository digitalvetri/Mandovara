"use client";

// Office-side "Add item" panel. This is the reduced form for the
// detail page — the field PWA gets its own richer, single-item-per-
// screen flow next session. Rooms are pre-loaded from the parent.
// A new-room quick-add sits inline.

import { useState, useTransition, useMemo, useEffect } from "react";
import { Loader2, Plus } from "lucide-react";
import { createRoom } from "@/modules/measurement/actions";
import { searchColourwaysByFamily } from "@/modules/measurement/actions-catalog";
import type { ColourwayOption } from "@/modules/measurement/actions-shared";
import { addMeasurementItem, pickProductForMeasurementItem } from "@/modules/measurement/actions-item";
import {
  PRODUCT_FAMILIES, SURFACE_TYPES, HEADING_TYPES, LAY_PATTERNS, MOUNT_TYPES,
} from "@/modules/measurement/schema";

interface AddItemPanelProps {
  measurementId: string;
  projectId:     string;
  rooms:         { id: string; name: string; floorLabel: string | null; sortOrder: number }[];
}

type Family = (typeof PRODUCT_FAMILIES)[number];

const CURTAIN_LIKE = new Set<Family>(["CURTAIN_FABRIC", "SHEER"]);
const FLOORING_LIKE = new Set<Family>(["FLOORING"]);
const WALLPAPER_LIKE = new Set<Family>(["WALLPAPER"]);
const BLIND_LIKE = new Set<Family>(["BLIND"]);

export function AddItemPanel({ measurementId, projectId, rooms }: AddItemPanelProps) {
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const [label,  setLabel]  = useState("");
  const [surface, setSurface] = useState<(typeof SURFACE_TYPES)[number]>("WINDOW");
  const [family, setFamily]  = useState<Family>("CURTAIN_FABRIC");
  const [widthMm,  setWidthMm]  = useState("");
  const [heightMm, setHeightMm] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [headingType, setHeadingType] = useState<(typeof HEADING_TYPES)[number]>("EYELET");
  const [fullness,    setFullness]    = useState("2.5");
  const [layPattern,  setLayPattern]  = useState<(typeof LAY_PATTERNS)[number]>("STRAIGHT");
  const [mountType,   setMountType]   = useState<(typeof MOUNT_TYPES)[number]>("INSIDE");
  const [notes, setNotes] = useState("");
  const [colourwayId, setColourwayId] = useState("");
  const [colourways,  setColourways]  = useState<ColourwayOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start]  = useTransition();

  useEffect(() => {
    setColourwayId("");
    setColourways([]);
    searchColourwaysByFamily(family).then(setColourways).catch(() => setColourways([]));
  }, [family]);

  const [newRoomOpen, setNewRoomOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [addingRoom,  setAddingRoom]  = useState(false);

  const showHeading = useMemo(() => CURTAIN_LIKE.has(family), [family]);
  const showLay     = useMemo(() => FLOORING_LIKE.has(family), [family]);
  const showMount   = useMemo(() => BLIND_LIKE.has(family), [family]);
  const showDeducts = useMemo(() => WALLPAPER_LIKE.has(family), [family]);

  function reset(): void {
    setLabel(""); setWidthMm(""); setHeightMm(""); setQuantity("1"); setNotes(""); setColourwayId("");
  }

  async function addRoom(): Promise<void> {
    if (!newRoomName.trim()) return;
    setAddingRoom(true);
    const r = await createRoom({ projectId, name: newRoomName.trim() });
    setAddingRoom(false);
    if (r.ok && r.data) {
      setRoomId(r.data.id);
      setNewRoomOpen(false);
      setNewRoomName("");
    } else {
      setError(r.error ?? "Could not create room");
    }
  }

  function save(): void {
    setError(null);
    const w = parseFloat(widthMm);
    const h = parseFloat(heightMm);
    const q = parseInt(quantity, 10);
    if (!roomId) { setError("Pick or add a room first"); return; }
    if (!label.trim()) { setError("Label required"); return; }
    if (!Number.isFinite(w) || w <= 0) { setError("Width in millimetres required"); return; }
    if (!Number.isFinite(h) || h <= 0) { setError("Height in millimetres required"); return; }

    start(async () => {
      const payload = {
        measurementId,
        roomId,
        label: label.trim(),
        surface,
        widthMm: w,
        heightMm: h,
        quantity: Number.isFinite(q) && q > 0 ? q : 1,
        family,
        notes: notes.trim() || undefined,
        ...(showHeading  && { headingType, fullness: parseFloat(fullness) }),
        ...(showLay      && { layPattern }),
        ...(showMount    && { mountType }),
        ...(showDeducts  && { deductions: [] as { widthMm: number; heightMm: number; qty: number }[] }),
      };
      const r = await addMeasurementItem(payload);
      if (!r.ok) { setError(r.error ?? "Could not add item"); return; }
      if (colourwayId && r.data?.id) {
        await pickProductForMeasurementItem({ measurementItemId: r.data.id, colourwayId });
      }
      reset();
    });
  }

  return (
    <div className="rounded-[10px] border border-rule bg-surface">
      <div className="border-b border-rule px-4 py-2.5 text-[11.5px] uppercase tracking-[0.06em] text-text-dim">
        Add item
      </div>
      <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-4">
        <div className="col-span-2 flex items-center gap-2 lg:col-span-4">
          <select
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="h-[36px] rounded-[6px] border border-rule bg-transparent px-2 text-[12px] text-text"
          >
            {rooms.length === 0 && <option value="">No rooms yet</option>}
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}{r.floorLabel ? ` · ${r.floorLabel}` : ""}
              </option>
            ))}
          </select>
          {!newRoomOpen ? (
            <button
              type="button"
              onClick={() => setNewRoomOpen(true)}
              className="inline-flex items-center gap-1 text-[11.5px] text-text-dim hover:text-gold"
            >
              <Plus size={11} /> New room
            </button>
          ) : (
            <>
              <input
                type="text"
                placeholder="Room name"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                autoFocus
                className="h-[36px] w-[180px] rounded-[6px] border border-rule bg-transparent px-2 text-[12px] text-text"
              />
              <button
                type="button"
                onClick={addRoom}
                disabled={addingRoom}
                className="rounded-[6px] bg-gold px-2.5 py-1 text-[11.5px] font-medium text-ink hover:bg-gold-strong disabled:opacity-60"
              >
                {addingRoom ? <Loader2 size={11} className="animate-spin" /> : "Add"}
              </button>
              <button
                type="button"
                onClick={() => { setNewRoomOpen(false); setNewRoomName(""); }}
                className="text-[11.5px] text-text-dim"
              >
                Cancel
              </button>
            </>
          )}
        </div>

        <FieldInput label="Label" value={label} onChange={setLabel} placeholder="Window 1 — East" />
        <FieldSelect label="Surface" value={surface} onChange={(v) => setSurface(v as typeof surface)} options={SURFACE_TYPES} />
        <FieldSelect label="Family"  value={family}  onChange={(v) => setFamily(v as Family)}          options={PRODUCT_FAMILIES} />
        <FieldInput label="Quantity" value={quantity} onChange={setQuantity} inputMode="numeric" width="w-full" />

        {/* Product picker — select before saving so calc uses actual product properties */}
        <div className="col-span-2 flex flex-col gap-1 lg:col-span-4">
          <span className="text-[10.5px] uppercase tracking-[0.06em] text-text-dim">
            Product <span className="normal-case text-text-subtle">(optional — select to link catalogue item)</span>
          </span>
          <select
            value={colourwayId}
            onChange={(e) => setColourwayId(e.target.value)}
            className="h-[36px] rounded-[6px] border border-rule bg-transparent px-2 text-[12.5px] text-text"
          >
            <option value="">— no product selected (pick from catalogue later) —</option>
            {colourways.map((c) => (
              <option key={c.id} value={c.id}>
                {c.brandName} · {c.designName} · {c.colourName} ({c.code})
              </option>
            ))}
          </select>
        </div>

        <FieldInput label="Width (mm)"  value={widthMm}  onChange={setWidthMm}  inputMode="decimal" />
        <FieldInput label="Height (mm)" value={heightMm} onChange={setHeightMm} inputMode="decimal" />

        {showHeading && (
          <>
            <FieldSelect label="Heading" value={headingType} onChange={(v) => setHeadingType(v as typeof headingType)} options={HEADING_TYPES} />
            <FieldInput  label="Fullness" value={fullness} onChange={setFullness} inputMode="decimal" />
          </>
        )}
        {showLay && (
          <FieldSelect label="Lay pattern" value={layPattern} onChange={(v) => setLayPattern(v as typeof layPattern)} options={LAY_PATTERNS} />
        )}
        {showMount && (
          <FieldSelect label="Mount" value={mountType} onChange={(v) => setMountType(v as typeof mountType)} options={MOUNT_TYPES} />
        )}

        <FieldInput label="Notes" value={notes} onChange={setNotes} width="col-span-2 lg:col-span-4" />
      </div>

      <div className="flex items-center justify-between border-t border-rule px-4 py-2.5">
        {error ? (
          <span className="text-[11px] text-fault">{error}</span>
        ) : (
          <span className="text-[11px] text-text-dim">
            Dimensions in millimetres. Live calc runs on save.
          </span>
        )}
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-[6px] bg-gold px-3 py-1.5 text-[11.5px] font-medium text-ink hover:bg-gold-strong disabled:opacity-60 transition-colors"
        >
          {pending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          Add item
        </button>
      </div>
    </div>
  );
}

// ── Small field primitives (kept local to avoid a design-system PR) ─
function FieldInput({
  label, value, onChange, placeholder, inputMode, width,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; inputMode?: "decimal" | "numeric"; width?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${width ?? ""}`}>
      <span className="text-[10.5px] uppercase tracking-[0.06em] text-text-dim">{label}</span>
      <input
        type="text"
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-[36px] rounded-[6px] border border-rule bg-transparent px-2 text-[12.5px] text-text tabular"
      />
    </label>
  );
}

function FieldSelect({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: readonly string[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] uppercase tracking-[0.06em] text-text-dim">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-[36px] rounded-[6px] border border-rule bg-transparent px-2 text-[12.5px] text-text"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o.replace(/_/g, " ")}</option>
        ))}
      </select>
    </label>
  );
}

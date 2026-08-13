"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import {
  createMeasurement, updateMeasurement, deleteMeasurement,
} from "@/modules/measurement/actions";
import type { MeasurementItemRow } from "@/modules/measurement/queries";
import {
  familyLabel, wallpaperInputsFrom, flooringInputsFrom, curtainInputsFrom,
  DEFAULT_WALLPAPER, DEFAULT_FLOORING, DEFAULT_CURTAIN,
  type Family, type WallpaperInputs, type FlooringInputs, type CurtainInputs,
} from "./measurement-types";
import { WallpaperFields, FlooringFields, CurtainFields } from "./MeasurementFields";
import { LiveResult } from "./MeasurementLiveResult";
import { ItemsList } from "./MeasurementItemsList";
import { PhotoPicker } from "./PhotoPicker";
import { NumberOrText } from "./MeasurementAtoms";

export function MeasurementBuilder({
  projectId,
  initial,
}: { projectId: string; initial: MeasurementItemRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [items] = useState<MeasurementItemRow[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [room, setRoom] = useState("");
  const [label, setLabel] = useState("");
  const [family, setFamily] = useState<Family>("WALLPAPER");
  const [wp, setWp] = useState<WallpaperInputs>(DEFAULT_WALLPAPER);
  const [fl, setFl] = useState<FlooringInputs>(DEFAULT_FLOORING);
  const [ct, setCt] = useState<CurtainInputs>(DEFAULT_CURTAIN);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Items comes from prop; useState only for local optimism if needed.
  }, [initial]);

  function resetForm() {
    setEditingId(null);
    setLabel("");
    setWp(DEFAULT_WALLPAPER);
    setFl(DEFAULT_FLOORING);
    setCt(DEFAULT_CURTAIN);
    setPhotoDataUrl(undefined);
    setError(null);
  }

  function beginEdit(m: MeasurementItemRow) {
    setEditingId(m.id);
    setRoom(m.roomLabel);
    setLabel(m.label);
    setFamily(m.family);
    setPhotoDataUrl(undefined);
    if (m.family === "WALLPAPER") setWp(wallpaperInputsFrom(m.inputs));
    if (m.family === "FLOORING")  setFl(flooringInputsFrom(m.inputs));
    if (m.family === "CURTAIN")   setCt(curtainInputsFrom(m.inputs));
    setError(null);
  }

  function save() {
    const trimmedRoom  = room.trim()  || "Untitled room";
    const trimmedLabel = label.trim() || `${familyLabel(family)} item`;
    const inputs =
      family === "WALLPAPER" ? {
        ...wp,
        patternRepeatMm: wp.patternMatch === "FREE" ? 0 : wp.patternRepeatMm,
      }
      : family === "FLOORING" ? {
        ...fl,
        areaPerBoxSqft: fl.productKind === "BOX" ? fl.areaPerBoxSqft : 0,
        rollWidthMm:    fl.productKind === "ROLL" ? fl.rollWidthMm  : 0,
      }
      : {
        ...ct,
        patternRepeatMm:         ct.patternMatch === "FREE" ? 0 : ct.patternRepeatMm,
        railroadedFabricWidthMm: ct.railroadable ? ct.railroadedFabricWidthMm : 0,
      };
    const base = {
      projectId,
      roomLabel: trimmedRoom,
      label:     trimmedLabel,
      family,
      inputs,
    } as const;

    setError(null);
    startTransition(async () => {
      const res = editingId
        ? await updateMeasurement({ id: editingId, ...base })
        : await createMeasurement(base);
      if (!res.ok) {
        setError(res.error ?? "Could not save measurement");
        return;
      }
      resetForm();
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this measurement? This cannot be undone.")) return;
    startTransition(async () => {
      const res = await deleteMeasurement({ id });
      if (!res.ok) { setError(res.error ?? "Could not delete"); return; }
      if (editingId === id) resetForm();
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pb-10">
      {/* ── LEFT: capture form + live result ───────────────────────── */}
      <div className="space-y-4">
        <div className="rounded-[14px] bg-surface border border-rule p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
              {editingId ? "Editing measurement" : "New measurement"}
            </div>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1 text-[11px] text-text-dim hover:text-text"
              >
                <X size={11} /> Cancel edit
              </button>
            )}
          </div>

          {/* Room + label */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <NumberOrText label="Room" value={room} onChange={setRoom} placeholder="Master bedroom" />
            <NumberOrText label="Item label" value={label} onChange={setLabel} placeholder="North wall / Window 1" />
          </div>

          {/* Family selector */}
          <div>
            <div className="mb-1 text-[10.5px] uppercase tracking-[0.14em] text-text-dim">Family</div>
            <div className="flex items-center gap-1">
              {(["WALLPAPER", "FLOORING", "CURTAIN"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFamily(f)}
                  className={`h-[36px] px-4 rounded-[6px] text-[12.5px] border transition-colors ${
                    family === f
                      ? "bg-accent text-white border-accent"
                      : "bg-white/60 border-rule text-text-dim hover:text-text"
                  }`}
                >
                  {familyLabel(f)}
                </button>
              ))}
            </div>
          </div>

          {/* Family-specific inputs */}
          {family === "WALLPAPER" && <WallpaperFields value={wp} onChange={setWp} />}
          {family === "FLOORING"  && <FlooringFields  value={fl} onChange={setFl} />}
          {family === "CURTAIN"   && <CurtainFields   value={ct} onChange={setCt} />}

          {/* Photo capture */}
          <PhotoPicker value={photoDataUrl} onChange={setPhotoDataUrl} />

          {error && (
            <div className="text-[12px] text-bad bg-bad/8 border border-bad/30 rounded-[8px] px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="h-[36px] px-5 rounded-[8px] bg-accent text-white text-[12.5px] font-medium hover:bg-accent-hover disabled:opacity-60 transition-colors"
            >
              {pending ? (editingId ? "Saving…" : "Adding…") : (editingId ? "Save changes" : "Add measurement")}
            </button>
          </div>
        </div>

        {/* Live calc result */}
        <div className="rounded-[14px] bg-surface border border-rule p-5">
          <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">
            Live calculation
          </div>
          <LiveResult family={family} wp={wp} fl={fl} ct={ct} />
        </div>
      </div>

      {/* ── RIGHT: captured items by room ─────────────────────────── */}
      <div>
        <ItemsList items={items} onEdit={beginEdit} onDelete={remove} editingId={editingId} />
      </div>
    </div>
  );
}

"use client";

// Site measurement builder — TRACK-B-CRAFT.md §3 W8-11.
//
// Persistence: localStorage keyed by projectId. Once Dev A ships the
// Room + MeasurementItem models this hydrates from Prisma instead;
// the shape below deliberately mirrors what those tables should hold.
// A localStorage-only build lets the site team start capturing on the
// phone TODAY without waiting for the schema pair-session.
//
// The three engine calculators from /lib/calc run client-side against
// the current draft so the numbers move as you type (§6.4 test 5).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Trash2, Pencil, X, ImagePlus, AlertTriangle, Pen } from "lucide-react";
import { SketchOverlay } from "./SketchOverlay";
import {
  calcWallpaper, WALLPAPER_ENGINE_VERSION,
  type PatternMatch as WallpaperPatternMatch,
} from "@/lib/calc/wallpaper";
import {
  calcFlooring, FLOORING_ENGINE_VERSION,
  type LayPattern,
} from "@/lib/calc/flooring";
import {
  calcCurtain, CURTAIN_ENGINE_VERSION,
  type PatternMatch as CurtainPatternMatch,
} from "@/lib/calc/curtain";

type Family = "WALLPAPER" | "FLOORING" | "CURTAIN";

// ── Storage shape (mirrors the future MeasurementItem row) ─────────
interface StoredBase {
  id:              string;
  projectId:       string;
  room:            string;
  label:           string;
  family:          Family;
  photoDataUrl?:   string;
  createdAt:       number;
  updatedAt:       number;
}

interface WallpaperInputs {
  wallWidthMm:     number;
  wallHeightMm:    number;
  rollWidthMm:     number;
  rollLengthM:     number;
  patternMatch:    WallpaperPatternMatch;
  patternRepeatMm: number;
}
interface FlooringInputs {
  roomLengthMm:   number;
  roomWidthMm:    number;
  layPattern:     LayPattern;
  productKind:   "BOX" | "ROLL";
  areaPerBoxSqft: number;
  rollWidthMm:    number;
}
interface CurtainInputs {
  windowWidthMm:            number;
  windowHeightMm:           number;
  fullness:                 number;
  fabricWidthMm:            number;
  patternMatch:             CurtainPatternMatch;
  patternRepeatMm:          number;
  railroadable:             boolean;
  railroadedFabricWidthMm:  number;
  eyelet:                   boolean;
  lining:                   boolean;
}

type StoredMeasurement =
  | (StoredBase & { family: "WALLPAPER"; inputs: WallpaperInputs })
  | (StoredBase & { family: "FLOORING";  inputs: FlooringInputs  })
  | (StoredBase & { family: "CURTAIN";   inputs: CurtainInputs   });

// ── Storage helpers ────────────────────────────────────────────────
const STORAGE_PREFIX = "mandovara:measurements:";
function storageKey(projectId: string): string { return STORAGE_PREFIX + projectId; }

function loadAll(projectId: string): StoredMeasurement[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    return raw ? JSON.parse(raw) as StoredMeasurement[] : [];
  } catch { return []; }
}
function saveAll(projectId: string, items: StoredMeasurement[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(projectId), JSON.stringify(items));
}
function newId(): string {
  // Ephemeral client-side id; server will replace with cuid on migration.
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Family defaults ────────────────────────────────────────────────
const DEFAULT_WALLPAPER: WallpaperInputs = {
  wallWidthMm: 4000, wallHeightMm: 2700, rollWidthMm: 530, rollLengthM: 10.05,
  patternMatch: "FREE", patternRepeatMm: 0,
};
const DEFAULT_FLOORING: FlooringInputs = {
  roomLengthMm: 4000, roomWidthMm: 3500, layPattern: "STRAIGHT",
  productKind: "BOX", areaPerBoxSqft: 2.2, rollWidthMm: 1220,
};
const DEFAULT_CURTAIN: CurtainInputs = {
  windowWidthMm: 1800, windowHeightMm: 2100, fullness: 2.5, fabricWidthMm: 1100,
  patternMatch: "FREE", patternRepeatMm: 0,
  railroadable: false, railroadedFabricWidthMm: 2800,
  eyelet: false, lining: false,
};

// ── Root component ─────────────────────────────────────────────────
export function MeasurementBuilder({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<StoredMeasurement[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [room, setRoom] = useState("");
  const [label, setLabel] = useState("");
  const [family, setFamily] = useState<Family>("WALLPAPER");
  const [wp, setWp] = useState<WallpaperInputs>(DEFAULT_WALLPAPER);
  const [fl, setFl] = useState<FlooringInputs>(DEFAULT_FLOORING);
  const [ct, setCt] = useState<CurtainInputs>(DEFAULT_CURTAIN);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(undefined);

  // Hydrate from localStorage once mounted.
  useEffect(() => {
    setItems(loadAll(projectId));
  }, [projectId]);

  const editing = editingId ? items.find((i) => i.id === editingId) : null;

  function resetForm() {
    setEditingId(null);
    setLabel("");
    setWp(DEFAULT_WALLPAPER);
    setFl(DEFAULT_FLOORING);
    setCt(DEFAULT_CURTAIN);
    setPhotoDataUrl(undefined);
  }

  function beginEdit(m: StoredMeasurement) {
    setEditingId(m.id);
    setRoom(m.room);
    setLabel(m.label);
    setFamily(m.family);
    setPhotoDataUrl(m.photoDataUrl);
    if (m.family === "WALLPAPER") setWp(m.inputs);
    if (m.family === "FLOORING")  setFl(m.inputs);
    if (m.family === "CURTAIN")   setCt(m.inputs);
  }

  function persist(next: StoredMeasurement[]) {
    setItems(next);
    saveAll(projectId, next);
  }

  function save() {
    const trimmedRoom  = room.trim()  || "Untitled room";
    const trimmedLabel = label.trim() || `${familyLabel(family)} item`;
    const base = {
      id:        editingId ?? newId(),
      projectId,
      room:      trimmedRoom,
      label:     trimmedLabel,
      family,
      photoDataUrl,
      createdAt: editing?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };
    const item: StoredMeasurement =
      family === "WALLPAPER" ? { ...base, family: "WALLPAPER", inputs: wp }
      : family === "FLOORING" ? { ...base, family: "FLOORING",  inputs: fl }
      : { ...base, family: "CURTAIN", inputs: ct };

    persist(
      editingId
        ? items.map((x) => (x.id === editingId ? item : x))
        : [...items, item],
    );
    resetForm();
  }

  function remove(id: string) {
    if (!confirm("Delete this measurement? This cannot be undone.")) return;
    persist(items.filter((i) => i.id !== id));
    if (editingId === id) resetForm();
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

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={save}
              className="h-[36px] px-5 rounded-[8px] bg-accent text-white text-[12.5px] font-medium hover:bg-accent-hover transition-colors"
            >
              {editingId ? "Save changes" : "Add measurement"}
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

        <StorageHint />
      </div>

      {/* ── RIGHT: captured items by room ─────────────────────────── */}
      <div>
        <ItemsList items={items} onEdit={beginEdit} onDelete={remove} editingId={editingId} />
      </div>
    </div>
  );
}

// ── Fields ─────────────────────────────────────────────────────────

function WallpaperFields({
  value, onChange,
}: { value: WallpaperInputs; onChange: (v: WallpaperInputs) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <NumInput label="Wall width (mm)"  v={value.wallWidthMm}  set={(n) => onChange({ ...value, wallWidthMm:  n })} />
      <NumInput label="Wall height (mm)" v={value.wallHeightMm} set={(n) => onChange({ ...value, wallHeightMm: n })} />
      <NumInput label="Roll width (mm)"  v={value.rollWidthMm}  set={(n) => onChange({ ...value, rollWidthMm:  n })} />
      <NumInput label="Roll length (m)"  v={value.rollLengthM}  set={(n) => onChange({ ...value, rollLengthM:  n })} step={0.05} />
      <Select label="Pattern match" value={value.patternMatch} onChange={(pm) => onChange({ ...value, patternMatch: pm as WallpaperPatternMatch })}
        options={[
          { value: "FREE",     label: "Free" },
          { value: "STRAIGHT", label: "Straight" },
          { value: "OFFSET",   label: "Offset (half-drop)" },
        ]}
      />
      {value.patternMatch !== "FREE" && (
        <NumInput label="Repeat (mm)" v={value.patternRepeatMm} set={(n) => onChange({ ...value, patternRepeatMm: n })} />
      )}
    </div>
  );
}

function FlooringFields({
  value, onChange,
}: { value: FlooringInputs; onChange: (v: FlooringInputs) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <NumInput label="Room length (mm)" v={value.roomLengthMm} set={(n) => onChange({ ...value, roomLengthMm: n })} />
      <NumInput label="Room width (mm)"  v={value.roomWidthMm}  set={(n) => onChange({ ...value, roomWidthMm:  n })} />
      <Select label="Lay pattern" value={value.layPattern} onChange={(lp) => onChange({ ...value, layPattern: lp as LayPattern })}
        options={[
          { value: "STRAIGHT",    label: "Straight (7%)" },
          { value: "DIAGONAL",    label: "Diagonal (10%)" },
          { value: "HERRINGBONE", label: "Herringbone (15%)" },
        ]}
      />
      <Select label="Product kind" value={value.productKind} onChange={(k) => onChange({ ...value, productKind: k as "BOX" | "ROLL" })}
        options={[
          { value: "BOX",  label: "Box-packed" },
          { value: "ROLL", label: "Roll film" },
        ]}
      />
      {value.productKind === "BOX" ? (
        <NumInput label="Area per box (sqft)" v={value.areaPerBoxSqft} set={(n) => onChange({ ...value, areaPerBoxSqft: n })} step={0.1} />
      ) : (
        <NumInput label="Roll width (mm)" v={value.rollWidthMm} set={(n) => onChange({ ...value, rollWidthMm: n })} />
      )}
    </div>
  );
}

function CurtainFields({
  value, onChange,
}: { value: CurtainInputs; onChange: (v: CurtainInputs) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <NumInput label="Window width (mm)"  v={value.windowWidthMm}  set={(n) => onChange({ ...value, windowWidthMm:  n })} />
      <NumInput label="Window height (mm)" v={value.windowHeightMm} set={(n) => onChange({ ...value, windowHeightMm: n })} />
      <NumInput label="Fullness"           v={value.fullness}       set={(n) => onChange({ ...value, fullness:       n })} step={0.1} />
      <NumInput label="Fabric width (mm)"  v={value.fabricWidthMm}  set={(n) => onChange({ ...value, fabricWidthMm:  n })} />
      <Select label="Pattern match" value={value.patternMatch} onChange={(pm) => onChange({ ...value, patternMatch: pm as CurtainPatternMatch })}
        options={[
          { value: "FREE",     label: "Free" },
          { value: "STRAIGHT", label: "Straight" },
          { value: "OFFSET",   label: "Offset (half-drop)" },
        ]}
      />
      {value.patternMatch !== "FREE" && (
        <NumInput label="Repeat (mm)" v={value.patternRepeatMm} set={(n) => onChange({ ...value, patternRepeatMm: n })} />
      )}
      <Check label="Railroadable" checked={value.railroadable} onChange={(b) => onChange({ ...value, railroadable: b })} />
      {value.railroadable && (
        <NumInput label="Wide-bolt width (mm)" v={value.railroadedFabricWidthMm} set={(n) => onChange({ ...value, railroadedFabricWidthMm: n })} />
      )}
      <Check label="Eyelet heading" checked={value.eyelet} onChange={(b) => onChange({ ...value, eyelet: b })} />
      <Check label="With lining"    checked={value.lining} onChange={(b) => onChange({ ...value, lining: b })} />
    </div>
  );
}

// ── Live result ────────────────────────────────────────────────────

function LiveResult({
  family, wp, fl, ct,
}: {
  family: Family;
  wp: WallpaperInputs;
  fl: FlooringInputs;
  ct: CurtainInputs;
}) {
  const result = useMemo(() => {
    try {
      if (family === "WALLPAPER") {
        return {
          version: WALLPAPER_ENGINE_VERSION,
          ok: true as const,
          value: calcWallpaper({
            wallWidthMm:     wp.wallWidthMm,
            wallHeightMm:    wp.wallHeightMm,
            rollWidthMm:     wp.rollWidthMm,
            rollLengthM:     wp.rollLengthM,
            patternMatch:    wp.patternMatch,
            patternRepeatMm: wp.patternMatch === "FREE" ? 0 : wp.patternRepeatMm,
            deductions:      [],
          }),
        };
      }
      if (family === "FLOORING") {
        return {
          version: FLOORING_ENGINE_VERSION,
          ok: true as const,
          value: calcFlooring({
            roomLengthMm: fl.roomLengthMm,
            roomWidthMm:  fl.roomWidthMm,
            layPattern:   fl.layPattern,
            product:
              fl.productKind === "BOX"
                ? { kind: "BOX",  areaPerBoxSqft: fl.areaPerBoxSqft }
                : { kind: "ROLL", rollWidthMm:    fl.rollWidthMm },
          }),
        };
      }
      return {
        version: CURTAIN_ENGINE_VERSION,
        ok: true as const,
        value: calcCurtain({
          windowWidthMm:  ct.windowWidthMm,
          windowHeightMm: ct.windowHeightMm,
          fullness:       ct.fullness,
          fabricWidthMm:  ct.fabricWidthMm,
          patternMatch:   ct.patternMatch,
          patternRepeatMm: ct.patternMatch === "FREE" ? 0 : ct.patternRepeatMm,
          railroadable:   ct.railroadable,
          ...(ct.railroadable && { railroadedFabricWidthMm: ct.railroadedFabricWidthMm }),
          ...(ct.eyelet       && { headingType: "EYELET" as const }),
          ...(ct.lining       && { liningRequired: true }),
        }),
      };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message, version: "" };
    }
  }, [family, wp, fl, ct]);

  if (!result.ok) {
    return (
      <div className="flex items-start gap-2 text-[12px] text-bad bg-bad/8 border border-bad/30 rounded-[8px] px-3 py-2">
        <AlertTriangle size={13} strokeWidth={1.75} className="mt-[3px] shrink-0" />
        <span>{result.error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {family === "WALLPAPER" && "rollsRequired" in result.value && (
          <>
            <Stat label="Rolls"        value={result.value.rollsRequired}   emphasize />
            <Stat label="Cut length"   value={result.value.cutLengthMm}     unit="mm" />
            <Stat label="Strips/roll"  value={result.value.stripsPerRoll} />
            <Stat label="Strips"       value={result.value.stripsNeeded} />
          </>
        )}
        {family === "FLOORING" && "areaSqft" in result.value && (
          <>
            {result.value.boxesRequired != null ? (
              <Stat label="Boxes" value={result.value.boxesRequired} emphasize />
            ) : (
              <Stat label="Roll length" value={result.value.rollLengthM?.toFixed(2) ?? "—"} unit="m" emphasize />
            )}
            <Stat label="Area" value={result.value.areaSqft.toFixed(1)} unit="sqft" />
            <Stat label="Wastage" value={result.value.wastagePct} unit="%" />
            <Stat label="Skirting" value={result.value.skirtingRft.toFixed(2)} unit="rft" />
            {result.value.seamCount != null && <Stat label="Seams" value={result.value.seamCount} />}
          </>
        )}
        {family === "CURTAIN" && "fabricMetres" in result.value && (
          <>
            <Stat label="Fabric" value={result.value.fabricMetres.toFixed(2)} unit="m" emphasize />
            <Stat label="Run"    value={result.value.fabricRun === "RAILROADED" ? "Railroaded" : "Vertical"} />
            {result.value.panels != null && <Stat label="Panels" value={result.value.panels} />}
            {result.value.cutLengthMm != null && <Stat label="Cut length" value={result.value.cutLengthMm} unit="mm" />}
            {result.value.liningMetres != null && <Stat label="Lining" value={result.value.liningMetres.toFixed(2)} unit="m" />}
            {result.value.eyeletCountPerPanel != null && <Stat label="Eyelets/panel" value={result.value.eyeletCountPerPanel} />}
          </>
        )}
      </div>

      {"warnings" in result.value && result.value.warnings.length > 0 && (
        <ul className="space-y-1.5">
          {result.value.warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-2 text-[11.5px] text-text bg-accent/8 border border-accent/25 rounded-[6px] px-3 py-1.5">
              <AlertTriangle size={12} strokeWidth={1.75} className="mt-[3px] text-accent shrink-0" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="text-[10px] uppercase tracking-[0.18em] text-text-faint">
        Engine · {result.version}
      </div>
    </div>
  );
}

// ── Items list ─────────────────────────────────────────────────────

function ItemsList({
  items, onEdit, onDelete, editingId,
}: {
  items: StoredMeasurement[];
  onEdit: (m: StoredMeasurement) => void;
  onDelete: (id: string) => void;
  editingId: string | null;
}) {
  const byRoom = useMemo(() => {
    const map = new Map<string, StoredMeasurement[]>();
    for (const m of items) {
      const list = map.get(m.room) ?? [];
      list.push(m);
      map.set(m.room, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule py-16 text-center">
        <div className="text-[14px] text-text mb-2">No measurements yet.</div>
        <p className="text-[12px] text-text-dim">
          Fill the form on the left and press <span className="text-text">Add measurement</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {byRoom.map(([room, rows]) => (
        <div key={room} className="rounded-[14px] bg-surface border border-rule">
          <div className="px-4 py-3 border-b border-rule flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-[0.14em] text-text-dim">{room}</div>
            <div className="text-[10.5px] text-text-faint tabular">{rows.length} item{rows.length !== 1 ? "s" : ""}</div>
          </div>
          <ul className="divide-y divide-rule/60">
            {rows.map((m) => (
              <li key={m.id} className={`px-4 py-3 flex items-start gap-3 ${editingId === m.id ? "bg-accent/6" : ""}`}>
                {m.photoDataUrl ? (
                  <img src={m.photoDataUrl} alt="" className="h-[42px] w-[42px] rounded-[6px] object-cover border border-rule shrink-0" />
                ) : (
                  <div className="h-[42px] w-[42px] rounded-[6px] border border-dashed border-rule flex items-center justify-center text-text-faint shrink-0">
                    <ImagePlus size={14} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] text-text truncate">{m.label}</div>
                  <div className="text-[10.5px] text-text-dim tabular flex items-center gap-2 mt-0.5">
                    <span className="uppercase tracking-[0.08em] text-text-faint">{familyLabel(m.family)}</span>
                    <span>·</span>
                    <span>{summariseInputs(m)}</span>
                  </div>
                </div>
                <button type="button" onClick={() => onEdit(m)}
                        className="h-[26px] w-[26px] grid place-items-center rounded-[6px] border border-rule text-text-dim hover:text-text hover:bg-surface-hover">
                  <Pencil size={12} />
                </button>
                <button type="button" onClick={() => onDelete(m.id)}
                        className="h-[26px] w-[26px] grid place-items-center rounded-[6px] border border-rule text-text-dim hover:text-bad hover:bg-bad/8">
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function summariseInputs(m: StoredMeasurement): string {
  if (m.family === "WALLPAPER") return `${m.inputs.wallWidthMm}×${m.inputs.wallHeightMm} · ${m.inputs.patternMatch}`;
  if (m.family === "FLOORING")  return `${m.inputs.roomLengthMm}×${m.inputs.roomWidthMm} · ${m.inputs.layPattern} · ${m.inputs.productKind}`;
  return `${m.inputs.windowWidthMm}×${m.inputs.windowHeightMm} · ${m.inputs.fullness}× fullness`;
}

// ── Photo picker (compresses client-side to ~1024px longest edge) ──

function PhotoPicker({
  value, onChange,
}: { value: string | undefined; onChange: (data: string | undefined) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [sketching, setSketching] = useState(false);

  const compress = useCallback(async (file: File) => {
    const bitmap = await createImageBitmap(file);
    const maxEdge = 1024;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width  * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
    onChange(dataUrl);
  }, [onChange]);

  function pick() { inputRef.current?.click(); }

  return (
    <div>
      <div className="mb-1 text-[10.5px] uppercase tracking-[0.14em] text-text-dim">Photo</div>
      <div className="flex items-center gap-3">
        {value ? (
          <img src={value} alt="" className="h-[64px] w-[64px] rounded-[6px] object-cover border border-rule" />
        ) : (
          <div className="h-[64px] w-[64px] rounded-[6px] border border-dashed border-rule flex items-center justify-center text-text-faint">
            <ImagePlus size={16} />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={pick}
            className="h-[30px] px-3 rounded-[6px] bg-white/60 border border-rule text-[11.5px] text-text hover:bg-surface-hover transition-colors"
          >
            {value ? "Replace photo" : "Add photo"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => setSketching(true)}
              className="inline-flex items-center gap-1 h-[30px] px-3 rounded-[6px] bg-accent/10 border border-accent/40 text-accent text-[11.5px] hover:bg-accent/20 transition-colors"
            >
              <Pen size={11} /> Sketch on photo
            </button>
          )}
          {value && (
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="h-[26px] px-3 rounded-[6px] text-[11px] text-text-dim hover:text-bad text-left"
            >
              Remove
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void compress(f);
            e.target.value = "";
          }}
        />
      </div>
      {sketching && value && (
        <SketchOverlay
          photoDataUrl={value}
          onSave={(dataUrl) => {
            onChange(dataUrl);
            setSketching(false);
          }}
          onCancel={() => setSketching(false)}
        />
      )}
    </div>
  );
}

// ── Storage hint (make the tradeoff visible) ───────────────────────

function StorageHint() {
  return (
    <div className="rounded-[10px] bg-accent/8 border border-accent/25 px-3 py-2 text-[11px] text-text">
      Measurements save to this browser only for now. When the Prisma
      Room + MeasurementItem models land they&apos;ll persist to the
      server and sync across devices.
    </div>
  );
}

// ── Atoms ──────────────────────────────────────────────────────────

function NumInput({
  label, v, set, step,
}: { label: string; v: number; set: (n: number) => void; step?: number }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10.5px] uppercase tracking-[0.14em] text-text-dim">{label}</div>
      <input
        type="number"
        value={Number.isFinite(v) ? v : ""}
        step={step ?? 1}
        inputMode="decimal"
        onChange={(e) => set(e.target.value === "" ? 0 : Number(e.target.value))}
        className="w-full h-[36px] px-3 bg-white/60 border border-rule rounded-[6px] text-[13px] tabular outline-none focus:border-accent transition-colors"
      />
    </label>
  );
}

function Select({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[10.5px] uppercase tracking-[0.14em] text-text-dim">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-[36px] px-3 bg-white/60 border border-rule rounded-[6px] text-[13px] outline-none focus:border-accent transition-colors"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function Check({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-[12.5px] text-text sm:mt-6">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-[16px] w-[16px] accent-accent"
      />
      {label}
    </label>
  );
}

function NumberOrText({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10.5px] uppercase tracking-[0.14em] text-text-dim">{label}</div>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-[36px] px-3 bg-white/60 border border-rule rounded-[6px] text-[13px] outline-none focus:border-accent transition-colors"
      />
    </label>
  );
}

function Stat({
  label, value, unit, emphasize,
}: { label: string; value: string | number; unit?: string; emphasize?: boolean }) {
  return (
    <div>
      <div className="text-[10.5px] tracking-[0.14em] uppercase text-text-dim mb-0.5">{label}</div>
      <div className={emphasize ? "font-display text-[24px] leading-none tabular text-text" : "text-[15px] tabular text-text"}>
        {value}
        {unit && <span className="ml-1 text-[10.5px] text-text-dim uppercase tracking-[0.06em]">{unit}</span>}
      </div>
    </div>
  );
}

function familyLabel(f: Family): string {
  return f === "WALLPAPER" ? "Wallpaper" : f === "FLOORING" ? "Flooring" : "Curtains";
}

"use client";

import { useState, useTransition } from "react";
import { Camera, Trash2, PencilLine, Save, X } from "lucide-react";
import type { ItemDetail } from "@/modules/measurement/queries";
import { deleteMeasurementItem, updateMeasurementItem } from "@/modules/measurement/actions-item";
import {
  SURFACE_TYPES, HEADING_TYPES, LAY_PATTERNS, MOUNT_TYPES, PRODUCT_FAMILIES,
} from "@/modules/measurement/schema";

interface ItemCardProps {
  item:          ItemDetail;
  measurementId: string;
  editable:      boolean;
}

type Family = (typeof PRODUCT_FAMILIES)[number];
const CURTAIN_LIKE = new Set<Family>(["CURTAIN_FABRIC", "SHEER"]);
const FLOORING_LIKE = new Set<Family>(["FLOORING"]);
const BLIND_LIKE = new Set<Family>(["BLIND"]);

export function ItemCard({ item, measurementId, editable }: ItemCardProps) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit-form state — initialised from item on each open
  const [label,       setLabel]       = useState(item.label);
  const [surface,     setSurface]     = useState<(typeof SURFACE_TYPES)[number]>(item.surface as (typeof SURFACE_TYPES)[number]);
  const [family,      setFamily]      = useState<Family>(item.family as Family);
  const [quantity,    setQuantity]    = useState(String(item.quantity));
  const [headingType, setHeadingType] = useState<(typeof HEADING_TYPES)[number]>(
    (item.headingType ?? "EYELET") as (typeof HEADING_TYPES)[number],
  );
  const [layPattern,  setLayPattern]  = useState<(typeof LAY_PATTERNS)[number]>(
    (item.layPattern ?? "STRAIGHT") as (typeof LAY_PATTERNS)[number],
  );
  const [mountType,   setMountType]   = useState<(typeof MOUNT_TYPES)[number]>(
    (item.mountType ?? "INSIDE") as (typeof MOUNT_TYPES)[number],
  );
  const [notes, setNotes] = useState(item.notes ?? "");

  const showHeading = CURTAIN_LIKE.has(family);
  const showLay     = FLOORING_LIKE.has(family);
  const showMount   = BLIND_LIKE.has(family);

  function openEdit() {
    setLabel(item.label);
    setSurface(item.surface as (typeof SURFACE_TYPES)[number]);
    setFamily(item.family as Family);
    setQuantity(String(item.quantity));
    setHeadingType((item.headingType ?? "EYELET") as (typeof HEADING_TYPES)[number]);
    setLayPattern((item.layPattern ?? "STRAIGHT") as (typeof LAY_PATTERNS)[number]);
    setMountType((item.mountType ?? "INSIDE") as (typeof MOUNT_TYPES)[number]);
    setNotes(item.notes ?? "");
    setError(null);
    setEditing(true);
  }

  function saveEdit() {
    setError(null);
    const q = parseInt(quantity, 10);
    if (!label.trim()) { setError("Label required"); return; }
    start(async () => {
      const r = await updateMeasurementItem({
        id:            item.id,
        measurementId,
        roomId:        item.roomId,
        label:         label.trim(),
        surface,
        family,
        quantity:  Number.isFinite(q) && q > 0 ? q : 1,
        notes:     notes.trim() || undefined,
        ...(showHeading && { headingType, fullness: 2.5 }),
        ...(showLay     && { layPattern }),
        ...(showMount   && { mountType }),
      });
      if (!r.ok) { setError(r.error ?? "Could not save"); return; }
      setEditing(false);
    });
  }

  function onDelete() {
    if (!confirm(`Delete "${item.label}"?`)) return;
    start(async () => { await deleteMeasurementItem({ id: item.id }); });
  }

  if (editing) {
    return (
      <article className="rounded-[8px] border border-accent/40 bg-surface overflow-hidden">
        <div className="border-b border-rule px-4 py-2.5 text-[11.5px] uppercase tracking-[0.06em] text-text-dim flex items-center justify-between">
          <span>Editing — {item.label}</span>
          <button type="button" onClick={() => setEditing(false)} className="text-text-dim hover:text-text">
            <X size={13} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-4">
          <EField label="Label"       value={label}    onChange={setLabel}    placeholder="Window 1 — East" width="col-span-2" />
          <ESelect label="Surface"    value={surface}   onChange={(v) => setSurface(v as typeof surface)}   options={SURFACE_TYPES} />
          <ESelect label="Family"     value={family}    onChange={(v) => setFamily(v as Family)}            options={PRODUCT_FAMILIES} />
          <EField label="Quantity"    value={quantity}  onChange={setQuantity}  inputMode="numeric" />
          {showHeading && (
            <ESelect label="Heading"  value={headingType} onChange={(v) => setHeadingType(v as typeof headingType)} options={HEADING_TYPES} />
          )}
          {showLay && (
            <ESelect label="Lay pattern" value={layPattern} onChange={(v) => setLayPattern(v as typeof layPattern)} options={LAY_PATTERNS} />
          )}
          {showMount && (
            <ESelect label="Mount"    value={mountType} onChange={(v) => setMountType(v as typeof mountType)} options={MOUNT_TYPES} />
          )}
          <EField label="Notes"       value={notes}     onChange={setNotes}   width="col-span-2 lg:col-span-4" />
        </div>
        <div className="flex items-center justify-between border-t border-rule px-4 py-2.5">
          {error ? (
            <span className="text-[11px] text-fault">{error}</span>
          ) : (
            <span className="text-[11px] text-text-dim">Label + qty is enough. Full dimensions live in the mobile round.</span>
          )}
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-rule px-3 py-1.5 text-[11.5px] text-text-dim hover:text-text transition-colors">
              Cancel
            </button>
            <button type="button" onClick={saveEdit} disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-accent px-4 py-1.5 text-[11.5px] font-medium text-white hover:opacity-90 disabled:opacity-60 transition-colors">
              {pending ? <span className="animate-spin">⟳</span> : <Save size={12} />}
              Save
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="grid grid-cols-[3px_1fr] gap-3 rounded-[8px] border border-rule bg-surface-2 overflow-hidden">
      <div className="bg-gold self-stretch" aria-hidden />
      <div className="grid grid-cols-[1fr_auto] gap-4 p-3">
        {/* Left: label + dimensions + intent */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-[13px] font-medium text-text">{item.label}</h3>
            <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-[0.05em] text-text-dim">
              {item.surface}
            </span>
            <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-[0.05em] text-gold-strong">
              {item.family.replace(/_/g, " ")}
            </span>
          </div>

          <div className="tabular text-[12.5px] text-text-dim mb-1">
            {parseFloat(item.widthMm) > 0 && parseFloat(item.heightMm) > 0 && (
              <>{formatMm(item.widthMm)} mm × {formatMm(item.heightMm)} mm{" "}</>
            )}
            {item.quantity > 0 && (
              parseFloat(item.widthMm) > 0
                ? <>× <span className="text-text">{item.quantity}</span></>
                : <><span className="text-text">Qty {item.quantity}</span></>
            )}
          </div>

          {(item.headingType || item.fullness || item.layPattern || item.mountType) && (
            <div className="text-[11.5px] text-text-dim mb-1">
              {[
                item.headingType && item.headingType.replace(/_/g, " ").toLowerCase(),
                item.fullness && `fullness ${item.fullness}`,
                item.layPattern && item.layPattern.toLowerCase(),
                item.mountType && `${item.mountType.toLowerCase()} mount`,
              ].filter(Boolean).join(" · ")}
            </div>
          )}

          {item.photoKeys.length > 0 && (
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[10.5px] text-text-dim">
              <Camera size={10} /> {item.photoKeys.length} photo{item.photoKeys.length > 1 ? "s" : ""}
            </div>
          )}
        </div>

        {/* Right: MATERIAL block */}
        <div className="min-w-[160px] text-right border-l border-rule pl-4">
          <div className="text-[9.5px] uppercase tracking-[0.08em] text-text-faint mb-1">Material</div>
          {item.calc ? (
            <div>
              <div className="tabular text-[15px] text-text font-medium">
                {formatQty(item.calc.materialQty)} <span className="text-[11.5px] text-text-dim">{item.calc.materialUnit.toLowerCase()}</span>
              </div>
              {item.calc.widthsRequired != null && (
                <div className="text-[11px] text-text-dim tabular">
                  {item.calc.widthsRequired} panels
                  {item.calc.cutLengthMm && <> · cut {formatMm(item.calc.cutLengthMm)} mm</>}
                </div>
              )}
              {item.calc.rollsRequired != null && (
                <div className="text-[11px] text-text-dim tabular">
                  {item.calc.rollsRequired} roll{item.calc.rollsRequired > 1 ? "s" : ""}
                  {item.calc.cutLengthMm && <> · cut {formatMm(item.calc.cutLengthMm)} mm</>}
                </div>
              )}
              {item.calc.boxesRequired != null && (
                <div className="text-[11px] text-text-dim tabular">
                  {item.calc.boxesRequired} box{item.calc.boxesRequired > 1 ? "es" : ""}
                  {item.calc.areaSqft && <> · {item.calc.areaSqft} sqft</>}
                </div>
              )}
            </div>
          ) : (
            <div className="text-[11.5px] text-text-dim">Not calculated</div>
          )}
        </div>
      </div>

      {/* Actions row */}
      <div className="col-span-2 border-t border-rule px-4 py-2 flex justify-end items-center gap-3">
        {editable && (
          <>
            <button
              type="button"
              onClick={openEdit}
              disabled={pending}
              className="inline-flex items-center gap-1 text-[10.5px] text-text-dim hover:text-accent transition-colors disabled:opacity-60"
            >
              <PencilLine size={10} /> Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={pending}
              className="inline-flex items-center gap-1 text-[10.5px] text-fault hover:text-fault-strong disabled:opacity-60"
            >
              <Trash2 size={10} /> Delete
            </button>
          </>
        )}
      </div>
    </article>
  );
}

// ── Inline edit field primitives ──────────────────────────────────────
function EField({
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

function ESelect({
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
        className="h-[36px] rounded-[6px] border border-rule bg-transparent px-2 pr-8 text-[12.5px] text-text"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o.replace(/_/g, " ")}</option>
        ))}
      </select>
    </label>
  );
}

function formatMm(v: string): string {
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return v;
  return n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function formatQty(v: string): string {
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return v;
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

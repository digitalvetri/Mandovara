"use client";

// Four fields, one row, no modal.
//
// Place / Wall · Quantity · Width · Height — the owner's brief
// (2026-08-28), for a person who does not know the system and should not
// have to learn rooms, surfaces and product families before they can
// write down a window.
//
// Lives in src/components (not under a route's _components) because it
// is mounted in two places: the project measurement round and the
// Client 360 measurement card. One component, so the two can never
// drift into asking for different things.
//
// Units follow the field PWA: stored in mm always, entered in whatever
// the person is holding a tape in. Default is inches, which is what a
// tape reads on site here; the toggle is one tap away. The chosen unit
// is saved with the row, so the item card afterwards shows 60 inch
// rather than the 1524 mm it became (owner, 2026-09-01).

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { addSimpleMeasurementItem } from "@/modules/measurement/actions-simple";
import { SIMPLE_FAMILIES, FAMILY_LABEL, type SimpleFamily } from "@/modules/measurement/simple-families";
import { FIELD_PLAN, asks } from "@/modules/measurement/simple-field-plan";
import { toMm, UNITS, UNIT_LABEL, type Unit } from "@/modules/measurement/units";

interface Props {
  measurementId: string;
  /** Called after a successful save so the parent can refresh its list. */
  onAdded?: () => void;
}

export function SimpleMeasurementEntry({ measurementId, onAdded }: Props) {
  const [place,  setPlace]  = useState("");
  // What is going there. The owner's brief (2026-08-30): "whether
  // curtain or wallpapers or something thats all i m going to enter".
  const [family, setFamily] = useState<SimpleFamily>("CURTAIN_FABRIC");
  const [qty,    setQty]    = useState("1");
  const [width,  setWidth]  = useState("");
  const [height, setHeight] = useState("");
  const [parts,  setParts]  = useState("");
  const [meters, setMeters] = useState("");
  const [unit,   setUnit]   = useState<Unit>("in");
  const [error,  setError]  = useState<string | null>(null);
  const [saved,  setSaved]  = useState<string | null>(null);
  const [pending, start]    = useTransition();

  function submit() {
    setError(null);
    setSaved(null);

    if (!place.trim()) {
      setError("Enter where this goes — a room, a wall, or a window.");
      return;
    }
    // Blank means one. The field is seeded with "1", so clearing it to type
    // over it and then tabbing away is the common path, not a mistake — and
    // this form is for someone who should not have to think about it. A real
    // value that is wrong (0, -2, "abc") still gets told. Families that
    // never show the field (a curtain is split into parts, not counted)
    // simply save one.
    const quantity = !asks(family, "quantity") || qty.trim() === "" ? 1 : parseInt(qty, 10);
    if (!Number.isFinite(quantity) || quantity < 1) {
      setError("Quantity must be at least 1.");
      return;
    }

    // Width and height are optional together — a qty-only line is a
    // valid thing to jot down and fill in after the site visit. But half
    // a size is a typo, not an intention, so say so.
    const w = width.trim()  ? toMm(width,  unit) : null;
    const h = height.trim() ? toMm(height, unit) : null;
    if (width.trim()  && w === null) { setError("Width must be a number greater than zero."); return; }
    if (height.trim() && h === null) { setError("Height must be a number greater than zero."); return; }
    if ((w === null) !== (h === null)) {
      setError("Enter both width and height, or leave both blank.");
      return;
    }

    // Curtain-only, and only when the family actually asks. A stale value
    // left in state after switching product type must not be saved.
    const partsN  = asks(family, "parts")  && parts.trim()  ? parseInt(parts, 10)   : null;
    const metersN = asks(family, "meters") && meters.trim() ? parseFloat(meters)    : null;
    if (partsN  !== null && (!Number.isFinite(partsN)  || partsN  < 1)) {
      setError("Parts must be a whole number, 1 or more."); return;
    }
    if (metersN !== null && (!Number.isFinite(metersN) || metersN <= 0)) {
      setError("Meters must be a number greater than zero."); return;
    }

    start(async () => {
      const r = await addSimpleMeasurementItem({
        measurementId,
        place:    place.trim(),
        family,
        quantity,
        ...(w !== null && { widthMm:  w }),
        ...(h !== null && { heightMm: h }),
        // Remember the tape, so the card reads back what was typed
        // instead of the mm it became.
        ...((w !== null || h !== null) && { enteredUnit: unit }),
        ...(partsN  !== null && { parts:         partsN }),
        ...(metersN !== null && { runningMeters: metersN }),
      });
      if (!r.ok) { setError(r.error ?? "Could not save that."); return; }

      setSaved(`Saved “${place.trim()}”.`);
      // Keep the unit AND the product type — a measurer does all the
      // curtains in a house, then all the wallpaper, not one of each.
      setPlace(""); setQty("1"); setWidth(""); setHeight(""); setParts(""); setMeters("");
      onAdded?.();
    });
  }

  return (
    <div className="rounded-[10px] border border-rule bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[14px] font-medium text-text">Add a measurement</h3>
        <div className="flex items-center gap-1">
          <span className="mr-1 text-[12px] text-text-dim">Measured in</span>
          {UNITS.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              className={`rounded-[6px] px-2.5 py-1 text-[12px] transition-colors ${
                unit === u
                  ? "bg-accent/15 font-medium text-accent"
                  : "text-text-dim hover:text-text"
              }`}
            >
              {UNIT_LABEL[u]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Field
          label="Place or wall"
          value={place}
          onChange={setPlace}
          placeholder="Living room — east wall"
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] text-text-dim">What is it</span>
          <select
            value={family}
            onChange={(e) => setFamily(e.target.value as SimpleFamily)}
            className="h-[38px] rounded-[6px] border border-rule bg-surface-2 px-3 text-[14px] text-text outline-none transition-colors focus:border-accent"
          >
            {SIMPLE_FAMILIES.map((f) => (
              <option key={f} value={f}>{FAMILY_LABEL[f]}</option>
            ))}
          </select>
        </label>
        {/* Fields follow the product type, not one row for everything —
            a curtain is split into parts and booked in metres; wallpaper
            is an area with a count. See simple-field-plan.ts. */}
        {FIELD_PLAN[family].map((f) => {
          const [value, set] =
            f.key === "width"    ? [width,  setWidth]  :
            f.key === "height"   ? [height, setHeight] :
            f.key === "quantity" ? [qty,    setQty]    :
            f.key === "parts"    ? [parts,  setParts]  :
                                   [meters, setMeters];
          return (
            <Field
              key={f.key}
              label={f.dimension ? `${f.label} (${UNIT_LABEL[unit]})` : f.label}
              value={value as string}
              onChange={set as (v: string) => void}
              inputMode={f.key === "quantity" || f.key === "parts" ? "numeric" : "decimal"}
              {...(f.optional ? { placeholder: "Optional" } : {})}
            />
          );
        })}
        <div className="flex items-end">
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="inline-flex h-[38px] w-full items-center justify-center gap-1.5 rounded-[6px] border border-accent/40 bg-accent/10 px-4 text-[13px] font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50 lg:w-auto"
          >
            <Plus size={14} />
            {pending ? "Saving…" : "Add"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-[12.5px] text-heat" role="alert">{error}</p>
      )}
      {saved && !error && (
        <p className="mt-3 text-[12.5px] text-good" role="status">{saved}</p>
      )}
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "decimal" | "numeric";
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] text-text-dim">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        {...(inputMode && { inputMode })}
        className="h-[38px] rounded-[6px] border border-rule bg-surface-2 px-3 text-[14px] text-text outline-none transition-colors placeholder:text-text-faint focus:border-accent"
      />
    </label>
  );
}

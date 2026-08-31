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
// tape reads on site here; the toggle is one tap away.

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { addSimpleMeasurementItem } from "@/modules/measurement/actions-simple";
import { SIMPLE_FAMILIES, FAMILY_LABEL, type SimpleFamily } from "@/modules/measurement/simple-families";
import { toMm } from "@/app/(mobile)/m/measure/[projectId]/_components/unit-convert";

type Unit = "mm" | "in" | "ft";
const UNITS: Unit[] = ["in", "ft", "mm"];
const UNIT_LABEL: Record<Unit, string> = { mm: "mm", in: "inch", ft: "ft" };

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
    // value that is wrong (0, -2, "abc") still gets told.
    const quantity = qty.trim() === "" ? 1 : parseInt(qty, 10);
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

    start(async () => {
      const r = await addSimpleMeasurementItem({
        measurementId,
        place:    place.trim(),
        family,
        quantity,
        ...(w !== null && { widthMm:  w }),
        ...(h !== null && { heightMm: h }),
      });
      if (!r.ok) { setError(r.error ?? "Could not save that."); return; }

      setSaved(`Saved “${place.trim()}”.`);
      // Keep the unit AND the product type — a measurer does all the
      // curtains in a house, then all the wallpaper, not one of each.
      setPlace(""); setQty("1"); setWidth(""); setHeight("");
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.3fr_0.8fr_1fr_1fr_auto]">
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
        <Field label="Quantity" value={qty} onChange={setQty} inputMode="numeric" />
        <Field
          label={`Width (${UNIT_LABEL[unit]})`}
          value={width}
          onChange={setWidth}
          inputMode="decimal"
          placeholder="Optional"
        />
        <Field
          label={`Height (${UNIT_LABEL[unit]})`}
          value={height}
          onChange={setHeight}
          inputMode="decimal"
          placeholder="Optional"
        />
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

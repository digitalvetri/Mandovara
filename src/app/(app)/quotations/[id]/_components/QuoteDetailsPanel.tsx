"use client";

// Valid-until date and the notes printed under the total, inside the
// quotation editor (owner request, 2026-09-28). Saved by the editor's own
// Save Changes together with the lines, so one save is one edit.
//
// Kept out of QuotationWorkspace.tsx to hold that file under the
// line ceiling.

import type { Narration } from "@/modules/quotations/narrations";
import { NarrationPicker } from "../../_components/NarrationPicker";

/** ISO timestamp → YYYY-MM-DD as the studio reads it (India time). */
export function toDateInput(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

interface Props {
  editable:    boolean;
  validUntil:  string;
  minDate:     string;
  narrations:  Narration[];
  onValidUntil: (v: string) => void;
  onNarrations: (v: Narration[]) => void;
}

export function QuoteDetailsPanel({
  editable, validUntil, minDate, narrations, onValidUntil, onNarrations,
}: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-5 px-6 py-5 border-t border-rule">
      <div>
        <div className="text-[9.5px] uppercase tracking-[0.22em] text-text-dim font-semibold mb-2">
          Valid until
        </div>
        {editable ? (
          <input
            type="date"
            value={validUntil}
            min={minDate}
            onChange={(e) => onValidUntil(e.target.value)}
            className="w-full h-[36px] rounded-[8px] border border-rule bg-transparent px-3 text-[12.5px] tabular text-text outline-none focus:border-accent"
          />
        ) : (
          <div className="text-[12.5px] text-text tabular">
            {new Date(`${validUntil}T00:00:00`).toLocaleDateString("en-IN", {
              day: "numeric", month: "short", year: "numeric",
            })}
          </div>
        )}
      </div>

      <div>
        <div className="text-[9.5px] uppercase tracking-[0.22em] text-text-dim font-semibold mb-1">
          Notes on the quotation
        </div>
        <p className="text-[11.5px] text-text-faint mb-3">
          {editable
            ? "Tick what applies — printed under the total. You can change the wording."
            : "Printed under the total. Use Edit quotation to change them."}
        </p>
        <NarrationPicker value={narrations} onChange={onNarrations} readOnly={!editable} />
      </div>
    </div>
  );
}

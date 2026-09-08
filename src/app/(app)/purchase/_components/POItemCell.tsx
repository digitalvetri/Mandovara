"use client";

// The item half of a purchase-order line.
//
// Owner, 2026-09-08: "if they have to purchase something new they should
// have the option to create the name, so selecting option can be disabled
// and typing option can be made".
//
// A line names a catalogued colourway or carries a typed description —
// never both. The same either/or a purchase request has always allowed;
// a PO could not express it until now.

import type { ColourwayPickerRow } from "@/modules/purchase/queries";

export interface ItemCellLine {
  colourwayId: string;
  freeTextItem: string;
  mode: "catalogue" | "typed";
}

export function POItemCell({
  line,
  colourways,
  onPick,
  onType,
  onMode,
}: {
  line: ItemCellLine;
  colourways: ColourwayPickerRow[];
  onPick: (colourwayId: string) => void;
  onType: (value: string) => void;
  onMode: (mode: ItemCellLine["mode"]) => void;
}) {
  return (
    <div className="min-w-[220px] space-y-1.5">
      {line.mode === "catalogue" ? (
        <select
          value={line.colourwayId}
          onChange={(e) => onPick(e.target.value)}
          disabled={colourways.length === 0}
          className={`${cellCls} w-full disabled:opacity-50`}
        >
          <option value="">
            {colourways.length === 0 ? "— catalogue is empty —" : "— select colourway —"}
          </option>
          {colourways.map((cw) => (
            <option key={cw.id} value={cw.id}>
              {cw.code} — {cw.colourName} ({cw.design.code})
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={line.freeTextItem}
          maxLength={300}
          onChange={(e) => onType(e.target.value)}
          placeholder="e.g. Curtain hooks 19mm"
          className={`${cellCls} w-full`}
        />
      )}
      <div className="flex items-center gap-2 text-[10.5px]">
        <ModeButton active={line.mode === "catalogue"} onClick={() => onMode("catalogue")}>
          From catalogue
        </ModeButton>
        <span className="text-text-faint">·</span>
        <ModeButton active={line.mode === "typed"} onClick={() => onMode("typed")}>
          Type a new item
        </ModeButton>
      </div>
      {line.mode === "typed" && (
        <p className="text-[10.5px] text-text-faint leading-snug">
          Ordered as written. Add it to the catalogue before receiving stock.
        </p>
      )}
    </div>
  );
}

/** The two ways to name a line: pick from the catalogue, or type it. */
function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-[4px] px-1.5 py-0.5 transition-colors ${
        active ? "text-text font-medium bg-surface-2" : "text-text-faint hover:text-text-dim"
      }`}
    >
      {children}
    </button>
  );
}

// Same field styling as every other cell in the PO table.
const cellCls =
  "w-full h-[28px] px-2 bg-white/60 border border-rule rounded-[4px] text-[12.5px] outline-none focus:border-accent";

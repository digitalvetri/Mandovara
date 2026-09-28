"use client";

// Notes printed on the quotation under the total — "Transportation extra",
// the delivery period and the like (owner request, 2026-09-28).
//
// Tick a note and its wording appears, filled in with the usual text and
// free to change. "Add another note" covers anything the presets do not.
// Used by the Quick Quote builder (while creating) and the quotation
// editor (while revising), so both offer exactly the same notes.

import { Plus, X } from "lucide-react";
import {
  NARRATION_PRESETS, NARRATION_LIMITS, CUSTOM_NARRATION_PREFIX, type Narration,
} from "@/modules/quotations/narrations";

const PRESET_ORDER = new Map(NARRATION_PRESETS.map((p, i) => [p.key, i]));

/** Presets in their fixed order, then the user's own notes as added. */
function ordered(list: Narration[]): Narration[] {
  const presets = list
    .filter((n) => PRESET_ORDER.has(n.key))
    .sort((a, b) => PRESET_ORDER.get(a.key)! - PRESET_ORDER.get(b.key)!);
  return [...presets, ...list.filter((n) => !PRESET_ORDER.has(n.key))];
}

function nextCustomKey(list: Narration[]): string {
  const used = list
    .filter((n) => n.key.startsWith(CUSTOM_NARRATION_PREFIX))
    .map((n) => parseInt(n.key.slice(CUSTOM_NARRATION_PREFIX.length), 10))
    .filter((n) => Number.isFinite(n));
  return `${CUSTOM_NARRATION_PREFIX}${used.length ? Math.max(...used) + 1 : 1}`;
}

const INPUT =
  "w-full h-[36px] rounded-[8px] border bg-transparent px-3 text-[12.5px] text-text placeholder:text-text-faint outline-none focus:border-accent";

interface Props {
  value:     Narration[];
  onChange:  (next: Narration[]) => void;
  /** Read-only: lists the notes that will print, nothing to tick. */
  readOnly?: boolean;
}

export function NarrationPicker({ value, onChange, readOnly }: Props) {
  if (readOnly) {
    return value.length === 0 ? (
      <div className="text-[12px] text-text-faint">No notes on this quotation.</div>
    ) : (
      <ul className="space-y-1.5 text-[12.5px]">
        {value.map((n) => (
          <li key={n.key} className="flex gap-2">
            <span className="text-accent">•</span>
            <span className="text-text">
              {n.label && <span className="font-medium">{n.label}: </span>}
              {n.text}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  const byKey = new Map(value.map((n) => [n.key, n]));
  const custom = value.filter((n) => !PRESET_ORDER.has(n.key));
  const atMax = value.length >= NARRATION_LIMITS.max;

  function toggle(key: string, on: boolean) {
    const preset = NARRATION_PRESETS.find((p) => p.key === key)!;
    onChange(on
      ? ordered([...value, { key, label: preset.label, text: preset.defaultText }])
      : value.filter((n) => n.key !== key));
  }

  function setText(key: string, text: string) {
    onChange(value.map((n) => (n.key === key ? { ...n, text } : n)));
  }

  function addCustom() {
    onChange([...value, { key: nextCustomKey(value), label: "", text: "" }]);
  }

  return (
    <div className="space-y-2.5">
      {NARRATION_PRESETS.map((p) => {
        const n = byKey.get(p.key);
        const blank = !!n && n.text.trim() === "";
        return (
          <div key={p.key}>
            <label className={`flex items-center gap-2.5 ${!n && atMax ? "opacity-50" : "cursor-pointer"}`}>
              <input
                type="checkbox"
                checked={!!n}
                disabled={!n && atMax}
                onChange={(e) => toggle(p.key, e.target.checked)}
                className="h-[15px] w-[15px] accent-gold"
              />
              <span className="text-[13px] text-text">{p.label}</span>
            </label>
            {n && (
              <div className="mt-1.5 pl-[25px]">
                <input
                  type="text"
                  value={n.text}
                  onChange={(e) => setText(p.key, e.target.value)}
                  placeholder={p.placeholder}
                  maxLength={NARRATION_LIMITS.text}
                  aria-label={`${p.label} note`}
                  className={`${INPUT} ${blank ? "border-fault/60" : "border-rule"}`}
                />
                {blank && (
                  <div className="mt-1 text-[11px] text-fault">Empty — this note will not be printed.</div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {custom.map((n, i) => (
        <div key={n.key} className="flex items-center gap-2">
          <input
            type="text"
            value={n.text}
            onChange={(e) => setText(n.key, e.target.value)}
            placeholder="Write a note, e.g. Scaffolding to be provided by the client"
            maxLength={NARRATION_LIMITS.text}
            aria-label={`Other note ${i + 1}`}
            autoFocus={n.text === "" && i === custom.length - 1}
            className={`${INPUT} border-rule`}
          />
          <button
            type="button"
            onClick={() => onChange(value.filter((x) => x.key !== n.key))}
            aria-label="Remove this note"
            title="Remove this note"
            className="shrink-0 inline-flex h-[36px] w-[36px] items-center justify-center rounded-[8px] text-text-dim hover:text-fault hover:bg-surface-2 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addCustom}
        disabled={atMax}
        className="inline-flex items-center gap-1.5 text-[12px] text-text-dim hover:text-accent disabled:opacity-40 transition-colors"
      >
        <Plus size={13} /> Add another note
      </button>
    </div>
  );
}

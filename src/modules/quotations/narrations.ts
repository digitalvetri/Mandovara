// Notes printed on a quotation under the total — "Transportation extra",
// the delivery period and the like.
//
// Owner request, 2026-09-28: tick the notes that apply to this quotation
// and fill in their wording. A plain module, not "use server": the picker
// in the builder and the editor, the server actions and the PDF all read
// the same presets and the same rules, and a "use server" file could not
// export them.
//
// Stored as Quotation.narrations — an ordered array of Narration. The
// order is the order printed.

import { z } from "zod";

// A type alias, not an interface: Prisma's JSON input type needs an
// implicit index signature, which only aliases get.
export type Narration = {
  /** A preset key ("transport") or "note-<n>" for one the user wrote. */
  key:   string;
  /** Printed in bold before the text: "Transportation". */
  label: string;
  /** What the client reads: "Transportation charges extra". */
  text:  string;
};

export interface NarrationPreset {
  key:         string;
  label:       string;
  /** Pre-filled when the box is ticked. Always editable. */
  defaultText: string;
  /** Shown in the empty field as a hint. */
  placeholder: string;
}

/** The notes the studio adds most often, in the order they print. */
export const NARRATION_PRESETS: readonly NarrationPreset[] = [
  {
    key:         "transport",
    label:       "Transportation",
    defaultText: "Transportation charges extra",
    placeholder: "e.g. Transportation charges extra",
  },
  {
    key:         "delivery",
    label:       "Delivery period",
    defaultText: "7 to 10 working days from the date of advance payment",
    placeholder: "e.g. 7 to 10 working days from the date of advance payment",
  },
  {
    key:         "installation",
    label:       "Installation",
    defaultText: "Installation / labour charges extra",
    placeholder: "e.g. Installation / labour charges extra",
  },
];

export const NARRATION_LIMITS = { max: 12, label: 60, text: 300 } as const;

/** Prefix for notes the user writes themselves. */
export const CUSTOM_NARRATION_PREFIX = "note-";

export const narrationInput = z.object({
  key:   z.string().trim().min(1).max(40),
  label: z.string().trim().max(NARRATION_LIMITS.label),
  text:  z.string().trim().min(1, "Write the note or untick it").max(NARRATION_LIMITS.text),
});

export const narrationsInput = z
  .array(narrationInput)
  .max(NARRATION_LIMITS.max, `At most ${NARRATION_LIMITS.max} notes`)
  .refine((list) => new Set(list.map((n) => n.key)).size === list.length, {
    message: "Each note may only appear once",
  });

/**
 * Read the column back. It is JSON, so anything could be in it — a
 * malformed entry is dropped rather than failing the whole page or PDF,
 * and a repeated key keeps its first occurrence.
 */
export function readNarrations(raw: unknown): Narration[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Narration[] = [];
  for (const item of raw) {
    const parsed = narrationInput.safeParse(item);
    if (!parsed.success || seen.has(parsed.data.key)) continue;
    seen.add(parsed.data.key);
    out.push(parsed.data);
  }
  return out.slice(0, NARRATION_LIMITS.max);
}

/**
 * What to write to the column: blank notes dropped, whitespace trimmed.
 * An empty array is how an update clears the notes (writing a JSON null
 * needs Prisma.DbNull, which modules may not import); a create simply
 * leaves the column out when this comes back empty.
 */
export function toStoredNarrations(list: readonly Narration[] | undefined): Narration[] {
  return (list ?? [])
    .map((n) => ({ key: n.key.trim(), label: n.label.trim(), text: n.text.trim() }))
    .filter((n) => n.key !== "" && n.text !== "");
}

/** What the editor sends: a note left blank is not printed, so not sent. */
export function narrationsForSave(list: readonly Narration[]): Narration[] {
  return list
    .map((n) => ({ ...n, text: n.text.trim() }))
    .filter((n) => n.text !== "");
}

/** One printed line: "Transportation: Transportation charges extra". */
export function narrationLine(n: Narration): string {
  return n.label ? `${n.label}: ${n.text}` : n.text;
}

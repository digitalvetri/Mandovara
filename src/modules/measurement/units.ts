// mm ↔ inch ↔ ft — the one place the conversion lives.
//
// Storage is always millimetres (§6.1): the calc engine, the Decimal
// columns and every derived figure are mm, and none of that changes.
// What this module adds is the round trip, so a person who measured a
// window with an inch tape reads inches back off the screen instead of
// "1524 mm" — the owner's brief (2026-09-01).
//
// Lives beside the rest of the measurement domain rather than inside a
// route's _components, because both the mobile round and the desktop
// cards need it and a second copy of the arithmetic is how the two
// screens start disagreeing.

export type Unit = "mm" | "in" | "ft";

export const UNITS: readonly Unit[] = ["in", "ft", "mm"];

export const UNIT_LABEL: Record<Unit, string> = {
  mm: "mm",
  in: "inch",
  ft: "ft",
};

const MM_PER_INCH = 25.4;
const MM_PER_FOOT = 304.8;

/** Narrow an untrusted string (a DB column, an offline queue payload) to a Unit. */
export function asUnit(value: unknown): Unit | null {
  return value === "mm" || value === "in" || value === "ft" ? value : null;
}

/** Convert a user-typed string in the current unit to millimetres.
 *  Returns null if the input isn't a positive finite number. */
export function toMm(value: string, unit: Unit): number | null {
  const n = parseFloat(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (unit === "mm") return n;
  if (unit === "in") return n * MM_PER_INCH;
  return n * MM_PER_FOOT;
}

/**
 * Convert millimetres back to a display unit.
 *
 * Three decimals, then strip the trailing zeros. Both halves matter:
 *
 * - Three, because a tape reads fractions. 60¼ inch is 1530.35 mm, and
 *   one decimal place hands it back as 60.3 — a different window from
 *   the one that was measured. Three decimals round-trip every eighth
 *   of an inch and every eighth of a foot exactly. (A sixteenth does
 *   not survive, because the mm columns are Decimal(10,2); that is a
 *   storage limit, not a formatting one.)
 * - Stripped, because someone who typed 60 should read 60, not
 *   "60.000", which claims a precision they never gave.
 */
export function fromMm(mm: number, unit: Unit): string {
  if (!Number.isFinite(mm)) return "";
  const fixed =
    unit === "mm" ? Math.round(mm).toString()
  : unit === "in" ? (mm / MM_PER_INCH).toFixed(3)
  :                 (mm / MM_PER_FOOT).toFixed(3);
  return trimZeros(fixed);
}

/** "60.0" → "60", "7.50" → "7.5", "1524" → "1524". */
export function trimZeros(s: string): string {
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

/**
 * Render a stored mm value in the unit it was entered in.
 *
 * `entered` is null for every row written before this existed and for
 * anything the mobile queue serialised with an older build — those keep
 * reading in mm, which is what they were stored as and the only honest
 * thing to show.
 */
export function displayDimension(
  mm: string | number,
  entered: string | null | undefined,
): { value: string; unit: string } {
  const n = typeof mm === "number" ? mm : parseFloat(mm);
  const u = asUnit(entered) ?? "mm";
  return { value: fromMm(n, u), unit: UNIT_LABEL[u] };
}

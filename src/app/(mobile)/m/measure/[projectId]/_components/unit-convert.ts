// mm ↔ inch ↔ ft conversion at the render boundary — §6.1 rule.
// The store is always mm; this module is the ONLY conversion point
// in the field PWA.

import type { Unit } from "./types";

const MM_PER_INCH = 25.4;
const MM_PER_FOOT = 304.8;

/** Convert a user-typed string in the current unit to millimetres.
 *  Returns null if the input isn't a positive finite number. */
export function toMm(value: string, unit: Unit): number | null {
  const n = parseFloat(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (unit === "mm") return n;
  if (unit === "in") return n * MM_PER_INCH;
  return n * MM_PER_FOOT;
}

/** Convert millimetres back to the display unit, rounded sensibly. */
export function fromMm(mm: number, unit: Unit): string {
  if (unit === "mm") return Math.round(mm).toString();
  if (unit === "in") return (mm / MM_PER_INCH).toFixed(1);
  return (mm / MM_PER_FOOT).toFixed(2);
}

export const UNIT_LABEL: Record<Unit, string> = {
  mm: "mm",
  in: "inch",
  ft: "ft",
};

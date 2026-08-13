// Turn a client-side draft + display unit into the payload the
// server expects. Dimensions are always stored in mm (§6.1); the
// display unit is a UI concept only.

import type { ItemDraft, Unit } from "./types";

const MM_PER_INCH = 25.4;
const MM_PER_FOOT = 304.8;

const CURTAIN_FAMILIES = new Set(["CURTAIN_FABRIC", "SHEER"]);
const WALLPAPER_FAMILIES = new Set(["WALLPAPER"]);

function toMm(value: string, unit: Unit): number {
  const n = parseFloat(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (unit === "mm") return n;
  if (unit === "in") return n * MM_PER_INCH;
  return n * MM_PER_FOOT;
}

export function toEnqueuePayload(
  draft:         ItemDraft,
  measurementId: string,
  unit:          Unit,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    clientCuid:    draft.clientCuid,
    measurementId,
    roomId:        draft.roomId,
    label:         draft.label.trim(),
    surface:       draft.surface,
    widthMm:       toMm(draft.widthMm,  unit),
    heightMm:      toMm(draft.heightMm, unit),
    quantity:      parseInt(draft.quantity, 10) || 1,
    family:        draft.family,
  };
  if (draft.headingType) payload.headingType = draft.headingType;
  if (draft.fullness)    payload.fullness    = parseFloat(draft.fullness);
  if (draft.layPattern)  payload.layPattern  = draft.layPattern;
  if (draft.mountType)   payload.mountType   = draft.mountType;
  // §6.4: WALLPAPER requires a deductions array — send an empty one
  // if the measurer didn't add any so the server knows we asked.
  if (WALLPAPER_FAMILIES.has(draft.family)) payload.deductions = [];
  // Curtain defaults so a barebones save still passes required fields
  if (CURTAIN_FAMILIES.has(draft.family)) {
    if (!draft.headingType) payload.headingType = "EYELET";
    if (!draft.fullness)    payload.fullness    = 2.5;
  }
  if (draft.photoKey)  payload.photoKeys = [draft.photoKey];
  if (draft.sketchKey) payload.sketchKey = draft.sketchKey;
  if (draft.notes)     payload.notes     = draft.notes;
  return payload;
}

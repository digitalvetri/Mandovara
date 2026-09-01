// Turn a client-side draft + display unit into the payload the
// server expects. Dimensions are always stored in mm (§6.1); the
// display unit is a UI concept only.

import type { ItemDraft, Unit } from "./types";
import { toMm as mmFrom } from "@/modules/measurement/units";

const CURTAIN_FAMILIES = new Set(["CURTAIN_FABRIC", "SHEER"]);
const WALLPAPER_FAMILIES = new Set(["WALLPAPER"]);

// The shared helper returns null for "not a positive number"; this
// payload has always sent 0 for a blank dimension, and the server
// schema is built around that.
function toMm(value: string, unit: Unit): number {
  return mmFrom(value, unit) ?? 0;
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
    enteredUnit:   unit,
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

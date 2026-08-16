// Prefill values for the New Product form, keyed by ProductFamily.
//
// Everything here is a HINT, not a rule — the form leaves each field
// editable. HSN codes come from CLAUDE.md §4 with the note "Confirm
// each with their CA in Phase 0", so treat these as sensible starting
// points, not compliance advice.

import type { ProductFamilyEnum, SellUnitEnum } from "./schema";
import type { z } from "zod";

type Family   = z.infer<typeof ProductFamilyEnum>;
type SellUnit = z.infer<typeof SellUnitEnum>;

export interface FamilyDefaults {
  readonly hsn:      string;
  readonly gstRate:  number;
  readonly sellUnit: SellUnit;
  readonly label:    string;
}

const D: Record<Family, FamilyDefaults> = {
  CURTAIN_FABRIC:    { hsn: "5407", gstRate: 12, sellUnit: "METRE", label: "Curtain fabric" },
  SHEER:             { hsn: "5407", gstRate: 12, sellUnit: "METRE", label: "Sheer curtain" },
  LINING:            { hsn: "5407", gstRate: 12, sellUnit: "METRE", label: "Curtain lining" },
  BLIND:             { hsn: "6303", gstRate: 12, sellUnit: "SQFT",  label: "Blind" },
  WALLPAPER:         { hsn: "4814", gstRate: 12, sellUnit: "ROLL",  label: "Wallpaper" },
  FLOORING:          { hsn: "3918", gstRate: 18, sellUnit: "BOX",   label: "Flooring" },
  CARPET_ROLL:       { hsn: "5703", gstRate: 12, sellUnit: "SQFT",  label: "Carpet (roll)" },
  CARPET_TILE:       { hsn: "5703", gstRate: 12, sellUnit: "BOX",   label: "Carpet tile" },
  RUG:               { hsn: "5703", gstRate: 12, sellUnit: "PIECE", label: "Rug" },
  UPHOLSTERY_FABRIC: { hsn: "5407", gstRate: 12, sellUnit: "METRE", label: "Upholstery fabric" },
  FOAM_FILLING:      { hsn: "3921", gstRate: 18, sellUnit: "PIECE", label: "Foam & filling" },
  VERTICAL_GARDEN:   { hsn: "0602", gstRate:  5, sellUnit: "SQFT",  label: "Vertical garden" },
  INTERIOR_FILM:     { hsn: "3919", gstRate: 18, sellUnit: "SQFT",  label: "Interior film" },
  MURAL:             { hsn: "9701", gstRate: 12, sellUnit: "PIECE", label: "Mural / art" },
  HARDWARE_TRACK:    { hsn: "3925", gstRate: 18, sellUnit: "PIECE", label: "Curtain track" },
  HARDWARE_ROD:      { hsn: "8302", gstRate: 18, sellUnit: "PIECE", label: "Curtain rod" },
  MOTOR:             { hsn: "8501", gstRate: 18, sellUnit: "PIECE", label: "Motor" },
  ACCESSORY:         { hsn: "9603", gstRate: 18, sellUnit: "PIECE", label: "Accessory" },
  SERVICE:           { hsn: "9987", gstRate: 18, sellUnit: "PIECE", label: "Service" },
};

export function familyDefaults(family: Family): FamilyDefaults {
  return D[family];
}

/** Ordered list for the family dropdown — grouped visually by common use. */
export const FAMILY_ORDER: readonly Family[] = [
  "WALLPAPER",
  "CURTAIN_FABRIC", "SHEER", "LINING", "UPHOLSTERY_FABRIC",
  "BLIND",
  "FLOORING",
  "CARPET_ROLL", "CARPET_TILE", "RUG",
  "INTERIOR_FILM", "VERTICAL_GARDEN", "MURAL",
  "HARDWARE_TRACK", "HARDWARE_ROD", "MOTOR",
  "FOAM_FILLING", "ACCESSORY", "SERVICE",
] as const;

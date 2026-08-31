// What each product type asks for on the simple measurement form.
//
// The owner's brief (2026-08-31): "I just want to ask for place or wall and
// then choose the item, and if the chosen item is curtain I need height,
// width, parts and meters as optional; if I choose wallpaper it just wants
// height and width and quantity as optional."
//
// So the form is no longer one row of fields for everything. Asking a
// wallpaper job how many parts it has is noise, and asking a curtain job
// for a quantity invites the wrong number — a curtain is measured by its
// opening and split into panels, not counted.
//
// Kept out of the component so the shape is data, not markup, and out of
// actions-simple.ts because a "use server" module may only export async
// functions while the form needs this at render time.

import type { SimpleFamily } from "./simple-families";

export type SimpleField = "width" | "height" | "quantity" | "parts" | "meters";

export interface FieldSpec {
  key:      SimpleField;
  label:    string;
  /** Optional fields are labelled so nobody hunts for a value they don't have. */
  optional: boolean;
  /** Rendered as a unit-aware dimension rather than a plain number. */
  dimension: boolean;
}

const WIDTH:    FieldSpec = { key: "width",    label: "Width",    optional: false, dimension: true  };
const HEIGHT:   FieldSpec = { key: "height",   label: "Height",   optional: false, dimension: true  };
const QUANTITY: FieldSpec = { key: "quantity", label: "Quantity", optional: true,  dimension: false };
const PARTS:    FieldSpec = { key: "parts",    label: "Parts",    optional: true,  dimension: false };
const METERS:   FieldSpec = { key: "meters",   label: "Meters",   optional: true,  dimension: false };

/**
 * Curtains and sheers are the same measurement problem — an opening, split
 * into panels, with a fabric figure the measurer may already know.
 * Everything else is an area with a count.
 */
export const FIELD_PLAN: Record<SimpleFamily, FieldSpec[]> = {
  CURTAIN_FABRIC: [HEIGHT, WIDTH, PARTS, METERS],
  SHEER:          [HEIGHT, WIDTH, PARTS, METERS],
  BLIND:          [HEIGHT, WIDTH, QUANTITY],
  WALLPAPER:      [HEIGHT, WIDTH, QUANTITY],
  MURAL:          [HEIGHT, WIDTH, QUANTITY],
  FLOORING:       [HEIGHT, WIDTH, QUANTITY],
  CARPET_ROLL:    [HEIGHT, WIDTH, QUANTITY],
  // A service line has nothing to measure — how many, and that is all.
  SERVICE:        [QUANTITY],
};

/** True when this family shows the field at all. */
export function asks(family: SimpleFamily, field: SimpleField): boolean {
  return FIELD_PLAN[family].some((f) => f.key === field);
}

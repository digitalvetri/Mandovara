import type { ProductFamily } from "@prisma/client";

// Made-to-measure families (§1.1, CLAUDE.md).
// Every quotation line for these families MUST carry a measurementItemId (§0.10 / §15.1).
// Supporting families — hardware, accessories, service — may be quoted without measurement.
export const MADE_TO_MEASURE_FAMILIES = new Set<ProductFamily>([
  "CURTAIN_FABRIC",
  "SHEER",
  "LINING",
  "BLIND",
  "WALLPAPER",
  "FLOORING",
  "CARPET_ROLL",
  "CARPET_TILE",
  "UPHOLSTERY_FABRIC",
  "VERTICAL_GARDEN",
  "INTERIOR_FILM",
  "MURAL",
]);

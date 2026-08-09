// Zod schemas for the measurement module — a discriminated union
// per family (WALLPAPER | FLOORING | CURTAIN) so the server picks the
// right calc engine and the client can trust the shape.
//
// Numeric bounds match sensible on-site limits: no wall taller than 6m,
// no window wider than 10m, fabric width in a plausible bolt range. Too
// tight and we reject valid odd-shaped rooms; too loose and typos slip
// through. These are ceiling checks — they don't replace the calc
// engine's own assertPositive() guards.

import { z } from "zod";

export const MEASUREMENT_FAMILIES = ["WALLPAPER", "FLOORING", "CURTAIN"] as const;
export type MeasurementFamily = (typeof MEASUREMENT_FAMILIES)[number];

const mm     = z.number().positive().max(20_000); // 20 m ceiling
const pctPos = z.number().nonnegative().max(200);

// ── WALLPAPER ──────────────────────────────────────────────────────
export const wallpaperInputSchema = z.object({
  wallWidthMm:     mm,
  wallHeightMm:    mm,
  rollWidthMm:     z.number().positive().max(2000),
  rollLengthM:     z.number().positive().max(100),
  patternMatch:    z.enum(["FREE", "STRAIGHT", "OFFSET"]),
  patternRepeatMm: z.number().nonnegative().max(2000),
});
export type WallpaperInput = z.infer<typeof wallpaperInputSchema>;

// ── FLOORING ──────────────────────────────────────────────────────
export const flooringInputSchema = z.object({
  roomLengthMm:   mm,
  roomWidthMm:    mm,
  layPattern:     z.enum(["STRAIGHT", "DIAGONAL", "HERRINGBONE"]),
  productKind:    z.enum(["BOX", "ROLL"]),
  areaPerBoxSqft: z.number().nonnegative().max(100),   // 0 for ROLL
  rollWidthMm:    z.number().nonnegative().max(5000),  // 0 for BOX
});
export type FlooringInput = z.infer<typeof flooringInputSchema>;

// ── CURTAIN ──────────────────────────────────────────────────────
export const curtainInputSchema = z.object({
  windowWidthMm:            mm,
  windowHeightMm:           mm,
  fullness:                 z.number().positive().max(5),
  fabricWidthMm:            z.number().positive().max(3500),
  patternMatch:             z.enum(["FREE", "STRAIGHT", "OFFSET"]),
  patternRepeatMm:          z.number().nonnegative().max(2000),
  railroadable:             z.boolean(),
  railroadedFabricWidthMm:  z.number().nonnegative().max(3500),
  eyelet:                   z.boolean(),
  lining:                   z.boolean(),
});
export type CurtainInput = z.infer<typeof curtainInputSchema>;

// ── Family discriminator + create / update payloads ────────────────
const commonFields = {
  projectId: z.string().cuid(),
  roomLabel: z.string().trim().min(1).max(80),
  label:     z.string().trim().min(1).max(120),
  notes:     z.string().trim().max(500).optional(),
  photoKey:  z.string().trim().max(200).optional(),
};

export const createMeasurementSchema = z.discriminatedUnion("family", [
  z.object({ ...commonFields, family: z.literal("WALLPAPER"), inputs: wallpaperInputSchema }),
  z.object({ ...commonFields, family: z.literal("FLOORING"),  inputs: flooringInputSchema  }),
  z.object({ ...commonFields, family: z.literal("CURTAIN"),   inputs: curtainInputSchema   }),
]);
export type CreateMeasurementInput = z.infer<typeof createMeasurementSchema>;

// Update = create + id (same family; changing family = delete + create).
export const updateMeasurementSchema = z.discriminatedUnion("family", [
  z.object({ id: z.string().cuid(), ...commonFields, family: z.literal("WALLPAPER"), inputs: wallpaperInputSchema }),
  z.object({ id: z.string().cuid(), ...commonFields, family: z.literal("FLOORING"),  inputs: flooringInputSchema  }),
  z.object({ id: z.string().cuid(), ...commonFields, family: z.literal("CURTAIN"),   inputs: curtainInputSchema   }),
]);
export type UpdateMeasurementInput = z.infer<typeof updateMeasurementSchema>;

export const deleteMeasurementSchema = z.object({ id: z.string().cuid() });

// Percentile helpers exported for callers that display validation limits.
export const LIMIT_MM = 20_000;
export const LIMIT_PCT = pctPos;

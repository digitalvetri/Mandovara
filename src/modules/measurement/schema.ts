// Zod schemas for the measurement module — canonical shape (§3 of
// docs/MEASUREMENT-MODULE.md).
//
// A Measurement is a ROUND (one site visit). It carries a chain of
// MeasurementItem rows, each tied to a Room. Server actions read these
// schemas; the field PWA uses the same shapes to validate before
// enqueueing to the offline outbox.

import { z } from "zod";

// The DB accepts both cuid and uuid ids (seed uses uuid; Prisma
// `@default(cuid())` generates cuid for anything created via the
// app). The FK constraints are authoritative — this validator only
// screens obviously-wrong inputs.
const idField = z.string().min(20).max(64);

// ── Enums that the client can type-narrow against ──────────────────
export const SURFACE_TYPES = ["WINDOW", "WALL", "FLOOR", "CEILING", "FURNITURE", "GLASS"] as const;
export const OPENING_TYPES = ["WINDOW", "DOOR", "WALL", "FLOOR", "CEILING", "FURNITURE", "OTHER"] as const;
export const PRODUCT_FAMILIES = [
  "CURTAIN_FABRIC", "SHEER", "LINING", "BLIND", "WALLPAPER", "FLOORING",
  "CARPET_ROLL", "CARPET_TILE", "RUG", "UPHOLSTERY_FABRIC", "FOAM_FILLING",
  "VERTICAL_GARDEN", "INTERIOR_FILM", "MURAL", "HARDWARE_TRACK",
  "HARDWARE_ROD", "MOTOR", "ACCESSORY", "SERVICE",
] as const;
export const HEADING_TYPES = ["EYELET", "PINCH_PLEAT", "PENCIL_PLEAT", "RIPPLE_FOLD", "TAB_TOP", "ROD_POCKET"] as const;
export const MOUNT_TYPES   = ["INSIDE", "OUTSIDE", "CEILING"] as const;
export const LAY_PATTERNS  = ["STRAIGHT", "DIAGONAL", "HERRINGBONE"] as const;

// Families that require field-level extras (§6.4).
const CURTAIN_FAMILIES = new Set(["CURTAIN_FABRIC", "SHEER"]);
const FLOORING_FAMILIES = new Set(["FLOORING"]);
const WALLPAPER_FAMILIES = new Set(["WALLPAPER"]);

// Dimensions: always millimetres, positive, bounded by a 20 m ceiling
// so a typo like `18000000` fails validation instead of getting to
// the engine. The engine also asserts positivity; this is belt+braces.
const mm = z.number().positive().max(20_000);
const mmOpt = z.number().positive().max(20_000).optional();

const deductionSchema = z.object({
  label:  z.string().trim().max(80).optional(),
  widthMm: mm,
  heightMm: mm,
  qty: z.number().int().positive().max(50).default(1),
});
export type DeductionInput = z.infer<typeof deductionSchema>;

// ── Round lifecycle inputs ──────────────────────────────────────────
// Exactly one of projectId / leadId — the same party XOR the DB
// enforces on Measurement (see the 20260827000002 migration). Leads
// became measurable 2026-08-27; before that projectId was required.
export const startRoundSchema = z.object({
  projectId:   idField.optional(),
  leadId:      idField.optional(),
  visitedAt:   z.coerce.date(),
  siteVisitId: idField.optional(),
  notes:       z.string().trim().max(500).optional(),
}).refine(
  (v) => (v.projectId != null) !== (v.leadId != null),
  { message: "A measurement round belongs to exactly one project or lead." },
);
export type StartRoundInput = z.infer<typeof startRoundSchema>;

export const submitRoundSchema  = z.object({ measurementId: idField });
export type SubmitRoundInput    = z.infer<typeof submitRoundSchema>;

export const approveRoundSchema = z.object({ measurementId: idField });
export type ApproveRoundInput   = z.infer<typeof approveRoundSchema>;

export const reviseRoundSchema  = z.object({
  parentMeasurementId: idField,
  visitedAt:           z.coerce.date(),
  notes:               z.string().trim().max(500).optional(),
});
export type ReviseRoundInput    = z.infer<typeof reviseRoundSchema>;

// ── Item lifecycle inputs ──────────────────────────────────────────
// clientCuid: optional client-generated cuid for the offline outbox
// (§7 — idempotent retries). Server treats it as the row PK.
const itemCoreShape = {
  clientCuid:   idField.optional(),
  measurementId: idField,
  roomId:       idField,
  label:        z.string().trim().min(1).max(120),
  surface:      z.enum(SURFACE_TYPES),
  openingType:  z.enum(OPENING_TYPES).optional(),
  // Owner redesign (2026-08-26): dimensions no longer required from the
  // office-side add/edit form. When absent, the item is treated as a
  // qty-based label — no CalcResult is written, and the DB stores 0
  // for widthMm/heightMm (the columns are Decimal, not-null).
  widthMm:      mmOpt,
  heightMm:     mmOpt,
  depthMm:      mmOpt,
  quantity:     z.number().int().positive().max(200).default(1),
  deductions:   z.array(deductionSchema).max(20).optional(),
  family:       z.enum(PRODUCT_FAMILIES),
  headingType:  z.enum(HEADING_TYPES).optional(),
  fullness:     z.number().positive().max(5).optional(),
  layPattern:   z.enum(LAY_PATTERNS).optional(),
  mountType:    z.enum(MOUNT_TYPES).optional(),
  requiresPowerPoint: z.boolean().optional().default(false),
  photoKeys:    z.array(z.string().trim().max(200)).max(20).optional(),
  sketchKey:    z.string().trim().max(200).optional(),
  notes:        z.string().trim().max(500).optional(),
} as const;

// §6.4 family-specific required fields — enforced with a superRefine
// so field errors surface on the correct paths.
const requireFamilyExtras = (
  data: { family: string; headingType?: string; fullness?: number; layPattern?: string; deductions?: unknown[] },
  ctx: z.RefinementCtx,
): void => {
  if (CURTAIN_FAMILIES.has(data.family)) {
    if (!data.headingType) {
      ctx.addIssue({ code: "custom", path: ["headingType"], message: "Heading type required for curtains and sheers." });
    }
    if (data.fullness === undefined) {
      ctx.addIssue({ code: "custom", path: ["fullness"], message: "Fullness required for curtains and sheers." });
    }
  }
  if (FLOORING_FAMILIES.has(data.family) && !data.layPattern) {
    ctx.addIssue({ code: "custom", path: ["layPattern"], message: "Lay pattern required for flooring." });
  }
  if (WALLPAPER_FAMILIES.has(data.family) && data.deductions === undefined) {
    // Deductions array may be EMPTY, but must be present so we know the
    // measurer considered openings.
    ctx.addIssue({ code: "custom", path: ["deductions"], message: "Deductions array required for wallpaper (may be empty)." });
  }
};

export const addItemSchema = z.object(itemCoreShape).superRefine(requireFamilyExtras);
export type AddItemInput   = z.infer<typeof addItemSchema>;

// Update: same core plus the item's id. Family may change (rare) —
// the same required-extras rule applies to the new family.
export const updateItemSchema = z.object({
  id: idField,
  ...itemCoreShape,
}).superRefine(requireFamilyExtras);
export type UpdateItemInput   = z.infer<typeof updateItemSchema>;

export const deleteItemSchema = z.object({ id: idField });
export type DeleteItemInput   = z.infer<typeof deleteItemSchema>;

// Picking a product for a measurement item — writes CalcResult.colourwayId.
// Deliberately NOT gated by round-status: designers routinely swap
// colourways after a round is APPROVED, before the quote goes out.
export const pickProductSchema = z.object({
  measurementItemId: idField,
  colourwayId:       idField,
});
export type PickProductInput = z.infer<typeof pickProductSchema>;

// Convenience for the field PWA: create-or-upsert by clientCuid.
// (Reuses addItemSchema — clientCuid is already declared there.)
export const syncItemSchema = addItemSchema.and(
  z.object({ clientCuid: idField }),
);
export type SyncItemInput    = z.infer<typeof syncItemSchema>;

// Room creation (a measurer often creates a new room name on site).
// Same party XOR as startRoundSchema — a room hangs off whichever of
// project / lead is being measured.
export const createRoomSchema = z.object({
  projectId:  idField.optional(),
  leadId:     idField.optional(),
  name:       z.string().trim().min(1).max(80),
  floorLabel: z.string().trim().max(40).optional(),
}).refine(
  (v) => (v.projectId != null) !== (v.leadId != null),
  { message: "A room belongs to exactly one project or lead." },
);
export type CreateRoomInput   = z.infer<typeof createRoomSchema>;

"use server";

// Simple measurement entry — the four fields an owner actually dictates
// over the phone: where it goes, how many, how wide, how tall.
//
// The full form (AddItemPanel) asks for room, label, surface, family,
// heading/lay/mount and notes, and refuses to save until a room exists.
// The owner's report (2026-08-28): "if I click that it is asking me for
// add a room but I dont want like that ... Place or Wall of
// installation, Quantity, Width, Height, like this is enough for me".
//
// So this is not a second way to store measurements — it is a narrower
// door onto the same one. Everything below resolves the fields the
// schema requires and then hands off to addMeasurementItem, which keeps
// its round-status check, its party XOR, its permission guard and its
// CalcResult write. No duplicate business system (CLAUDE.md rule 14).
//
// The two defaults it fills in:
//
//   surface — derived from the product type. A curtain hangs at a
//             window, wallpaper goes on a wall, flooring on a floor.
//             Nobody should be asked a question the answer to which is
//             already known.
//
//   the family's required extras — §6.4 demands headingType and fullness
//             for curtains, a layPattern for flooring, and a deductions
//             array for wallpaper. Asking for those is exactly what this
//             form exists to avoid, so it fills in the ordinary answer
//             and the office corrects it when quoting if it matters.
//             Without this, picking "Curtain" would fail validation and
//             the form would look broken.

import { z } from "zod";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { addMeasurementItem } from "./actions-item";
import { type ActionResult, zodError, ensureRoomForParty } from "./actions-shared";
import { SIMPLE_FAMILIES } from "./simple-families";

const simpleItemSchema = z.object({
  measurementId: z.string().trim().min(1),
  /** "Place or Wall of installation" — stored as MeasurementItem.label. */
  place:         z.string().trim().min(1).max(120),
  quantity:      z.number().int().positive().max(200).default(1),
  // Optional so a qty-only line still saves — addMeasurementItem skips
  // the CalcResult write when dimensions are absent.
  widthMm:       z.number().positive().max(100_000).optional(),
  heightMm:      z.number().positive().max(100_000).optional(),
  // The tape the person was holding. Storage is mm either way — this
  // only decides what the card reads back to them.
  enteredUnit:   z.enum(["mm", "in", "ft"]).optional(),
  family:        z.enum(SIMPLE_FAMILIES).default("SERVICE"),
  // Curtain-only. The form only shows them for CURTAIN_FABRIC / SHEER
  // (simple-field-plan.ts); accepted here for any family rather than
  // rejected, because a stray value is worth less than a save that fails.
  parts:         z.number().int().positive().max(50).optional(),
  runningMeters: z.number().positive().max(10_000).optional(),
});

/** Where this product type lives, so the form never has to ask. */
function surfaceFor(family: string): "WINDOW" | "WALL" | "FLOOR" {
  if (family === "CURTAIN_FABRIC" || family === "SHEER" || family === "BLIND") return "WINDOW";
  if (family === "FLOORING" || family === "CARPET_ROLL") return "FLOOR";
  return "WALL";
}

/**
 * The extras §6.4 insists on, per family.
 *
 * These are defaults, not decisions: a pinch pleat at 2× fullness is the
 * ordinary curtain, straight is the ordinary lay, and an empty
 * deductions array means "no openings noted yet". The detailed form and
 * the quotation stage can change any of them. Refusing to save without
 * them is what would make this form feel broken.
 */
function familyExtras(family: string): Record<string, unknown> {
  if (family === "CURTAIN_FABRIC" || family === "SHEER") {
    return { headingType: "PINCH_PLEAT", fullness: 2 };
  }
  if (family === "FLOORING") return { layPattern: "STRAIGHT" };
  if (family === "WALLPAPER") return { deductions: [] };
  return {};
}

export async function addSimpleMeasurementItem(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "measurement.create");

  const parsed = simpleItemSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const round = await db.measurement.findUnique({
    where:  { id: d.measurementId },
    select: { id: true, projectId: true, leadId: true },
  });
  if (!round) return { ok: false, error: "Measurement round not found" };

  const party = round.projectId
    ? { projectId: round.projectId, leadId: null }
    : { projectId: null, leadId: round.leadId };
  if (!party.projectId && !party.leadId) {
    return { ok: false, error: "This round is not linked to a project or lead." };
  }
  // Same helper the round-start path uses, so "which room did this go
  // into?" has exactly one answer in the codebase.
  const roomId = await ensureRoomForParty(db, ctx.orgId, party);

  // Hand off. Every guard that protects the full form protects this one.
  return addMeasurementItem({
    measurementId: d.measurementId,
    roomId,
    label:    d.place,
    surface:  surfaceFor(d.family),
    family:   d.family,
    quantity: d.quantity,
    ...familyExtras(d.family),
    ...(d.widthMm  !== undefined && { widthMm:  d.widthMm }),
    ...(d.heightMm !== undefined && { heightMm: d.heightMm }),
    ...(d.enteredUnit !== undefined && { enteredUnit: d.enteredUnit }),
    ...(d.parts         !== undefined && { parts:         d.parts }),
    ...(d.runningMeters !== undefined && { runningMeters: d.runningMeters }),
  });
}

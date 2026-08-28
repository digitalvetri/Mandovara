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
//   surface: WALL    — the label already says where it goes, and this
//                      column drives nothing downstream on its own.
//   family:  SERVICE — the app's existing catch-all bucket (the
//                      Installation panel groups under "General /
//                      services"). Critically it is also the only sane
//                      choice: every other family triggers §6.4's
//                      required extras — curtains demand headingType
//                      and fullness, flooring a layPattern, wallpaper a
//                      deductions array — and asking for those is
//                      exactly what this form exists to avoid. The
//                      office sets the real family when quoting.

import { z } from "zod";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { addMeasurementItem } from "./actions-item";
import { type ActionResult, zodError, ensureRoomForParty } from "./actions-shared";

const simpleItemSchema = z.object({
  measurementId: z.string().trim().min(1),
  /** "Place or Wall of installation" — stored as MeasurementItem.label. */
  place:         z.string().trim().min(1).max(120),
  quantity:      z.number().int().positive().max(200).default(1),
  // Optional so a qty-only line still saves — addMeasurementItem skips
  // the CalcResult write when dimensions are absent.
  widthMm:       z.number().positive().max(100_000).optional(),
  heightMm:      z.number().positive().max(100_000).optional(),
});

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
    surface:  "WALL",
    family:   "SERVICE",
    quantity: d.quantity,
    ...(d.widthMm  !== undefined && { widthMm:  d.widthMm }),
    ...(d.heightMm !== undefined && { heightMm: d.heightMm }),
  });
}

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
import type { RequestContext } from "@/kernel/auth/context";
import { addMeasurementItem } from "./actions-item";
import { type ActionResult, zodError } from "./actions-shared";

// Name of the room auto-created when the user never picked one. NOT
// exported: a "use server" module may only export async functions.
const DEFAULT_ROOM_NAME = "General";

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

/**
 * Find the round's default room, creating it on first use.
 *
 * Rooms are still real — the office-side page groups by them and the
 * field PWA relies on them. This only means the person entering four
 * numbers is not stopped at a modal to name one first.
 */
async function ensureDefaultRoom(
  ctx: RequestContext,
  round: { projectId: string | null; leadId: string | null },
): Promise<string | null> {
  const db = scoped(ctx);
  // Party XOR, same shape createRoom uses: a room hangs off exactly one
  // of project / lead.
  const party = round.projectId
    ? { projectId: round.projectId, leadId: null }
    : { projectId: null, leadId: round.leadId };
  if (!party.projectId && !party.leadId) return null;

  // Reuse whatever room already exists rather than adding "General"
  // beside the rooms someone has already set up.
  const existing = await db.room.findFirst({
    where:   party,
    orderBy: { sortOrder: "asc" },
    select:  { id: true },
  });
  if (existing) return existing.id;

  const room = await db.room.create({
    data: {
      organizationId: ctx.orgId,
      ...party,
      name:           DEFAULT_ROOM_NAME,
      floorLabel:     null,
      sortOrder:      0,
    },
    select: { id: true },
  });
  return room.id;
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

  const roomId = await ensureDefaultRoom(ctx, round);
  if (!roomId) {
    return { ok: false, error: "This round is not linked to a project or lead." };
  }

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

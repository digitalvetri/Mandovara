// Shared helpers for the measurement server actions.
//
// Kept in a separate module so actions.ts (round lifecycle) and
// actions-item.ts (item lifecycle) stay under CLAUDE.md §10's 300-line
// ceiling and share exactly one implementation of these primitives.

import type { z } from "zod";
import { Prisma } from "@/kernel/numbering/series";
import type { TxClient } from "@/kernel/db/transaction";
import type { scoped } from "@/kernel/db/scoped";
import type { RequestContext } from "@/kernel/auth/context";
import { can } from "@/kernel/rbac/guard";
import type { AddItemInput } from "./schema";
import { computeCalcResult, type CalcResultRow } from "./engine";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/** Turn a Zod issue set into an ActionResult with fieldErrors keyed by path. */
export function zodError<T = unknown>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path
      .filter((s): s is string | number => typeof s === "string" || typeof s === "number")
      .join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}

/**
 * §6.5 edit-scope check. `measurement.update` (checked by requirePermission
 * at the top of each action) gates whether the user *may* edit anything;
 * this narrows *which* rounds a Sales/MeasureExec can edit — their own
 * only. Owners/Designers can edit any round in the org (they hold the
 * `measurement.approve` key as a proxy for "senior enough").
 */
export function canEditRound(ctx: RequestContext, measuredById: string): boolean {
  if (ctx.userId === measuredById) return true;
  return can(ctx, "measurement.approve");
}

/** Map an AddItemInput to Prisma's unchecked-create shape (Decimal casts + null defaults). */
export function itemCreateData(
  orgId: string,
  d:     AddItemInput,
): Prisma.MeasurementItemUncheckedCreateInput {
  const data: Prisma.MeasurementItemUncheckedCreateInput = {
    organizationId:     orgId,
    measurementId:      d.measurementId,
    roomId:             d.roomId,
    label:              d.label,
    surface:            d.surface,
    openingType:        d.openingType ?? null,
    widthMm:            new Prisma.Decimal(d.widthMm ?? 0),
    heightMm:           new Prisma.Decimal(d.heightMm ?? 0),
    depthMm:            d.depthMm !== undefined ? new Prisma.Decimal(d.depthMm) : null,
    quantity:           d.quantity ?? 1,
    deductions:         (d.deductions ?? null) as Prisma.InputJsonValue,
    family:             d.family,
    headingType:        d.headingType ?? null,
    fullness:           d.fullness !== undefined ? new Prisma.Decimal(d.fullness) : null,
    layPattern:         d.layPattern ?? null,
    mountType:          d.mountType ?? null,
    requiresPowerPoint: d.requiresPowerPoint ?? false,
    photoKeys:          d.photoKeys ?? [],
    sketchKey:          d.sketchKey ?? null,
    notes:              d.notes ?? null,
  };
  if (d.clientCuid) data.id = d.clientCuid;
  return data;
}

/** Same shape for a MeasurementItem.update — omits the id, mutable columns only. */
export function itemUpdateData(d: AddItemInput): Prisma.MeasurementItemUncheckedUpdateInput {
  return {
    roomId:             d.roomId,
    label:              d.label,
    surface:            d.surface,
    openingType:        d.openingType ?? null,
    widthMm:            new Prisma.Decimal(d.widthMm ?? 0),
    heightMm:           new Prisma.Decimal(d.heightMm ?? 0),
    depthMm:            d.depthMm !== undefined ? new Prisma.Decimal(d.depthMm) : null,
    quantity:           d.quantity ?? 1,
    deductions:         (d.deductions ?? null) as Prisma.InputJsonValue,
    family:             d.family,
    headingType:        d.headingType ?? null,
    fullness:           d.fullness !== undefined ? new Prisma.Decimal(d.fullness) : null,
    layPattern:         d.layPattern ?? null,
    mountType:          d.mountType ?? null,
    requiresPowerPoint: d.requiresPowerPoint ?? false,
    photoKeys:          d.photoKeys ?? [],
    sketchKey:          d.sketchKey ?? null,
    notes:              d.notes ?? null,
  };
}

/** Persist a CalcResult row for an item. Caller supplies the transaction so
 *  supersede-on-change (§6.2) is atomic. */
export async function writeCalc(
  tx:     TxClient,
  orgId:  string,
  itemId: string,
  calc:   CalcResultRow,
): Promise<void> {
  await tx.calcResult.create({
    data: {
      organizationId:    orgId,
      measurementItemId: itemId,
      engineVersion:     calc.engineVersion,
      inputs:            calc.inputs as Prisma.InputJsonValue,
      materialQty:       new Prisma.Decimal(calc.materialQty),
      materialUnit:      calc.materialUnit,
      widthsRequired:    calc.widthsRequired ?? null,
      cutLengthMm:       calc.cutLengthMm    !== undefined ? new Prisma.Decimal(calc.cutLengthMm)    : null,
      rollsRequired:     calc.rollsRequired  ?? null,
      boxesRequired:     calc.boxesRequired  ?? null,
      areaSqft:          calc.areaSqft       !== undefined ? new Prisma.Decimal(calc.areaSqft)       : null,
      billableAreaSqft:  calc.billableAreaSqft !== undefined ? new Prisma.Decimal(calc.billableAreaSqft) : null,
      wastagePct:        calc.wastagePct     !== undefined ? new Prisma.Decimal(calc.wastagePct)     : null,
      fabricRun:         calc.fabricRun      ?? null,
      seamCount:         calc.seamCount      ?? null,
      liningQty:         calc.liningQty      !== undefined ? new Prisma.Decimal(calc.liningQty)      : null,
      warnings:          calc.warnings,
    },
  });
}

/** Recompute + persist. Used by both add + update paths.
 *  Returns null when width or height is absent — the office-side form
 *  accepts qty-only entries (owner redesign, 2026-08-26) and there's
 *  nothing meaningful for the calc engine to produce without both. */
export function computeCalcRow(d: AddItemInput): CalcResultRow | null {
  if (d.widthMm === undefined || d.heightMm === undefined) return null;
  return computeCalcResult({
    ...d,
    widthMm:  d.widthMm,
    heightMm: d.heightMm,
  });
}

/** A colourway as offered in the measurement item picker. Lives here rather
 *  than beside its query in actions-catalog.ts, because a `"use server"`
 *  module may only export async functions. */
export interface ColourwayOption {
  id: string;
  code: string;
  colourName: string;
  designName: string;
  brandName: string;
}

/**
 * Stamp `siteVisitId` onto a DRAFT round that doesn't have one yet.
 *
 * Called when a round is *resumed* from the visit page: the operator may
 * have started it from the project earlier, in which case the trip and
 * its dimensions would stay unjoined — the exact gap that made site
 * visits and measurements read as two separate modules before
 * 2026-08-27. Guarded on `siteVisitId: null` so an existing link is
 * never reassigned to a different visit.
 */
export async function linkRoundToVisit(
  db: ReturnType<typeof scoped> | TxClient,
  measurementId: string,
  siteVisitId: string,
): Promise<void> {
  await db.measurement.updateMany({
    where: { id: measurementId, siteVisitId: null },
    data:  { siteVisitId },
  });
}

// ── Subject-aware helpers (leads became measurable 2026-08-27) ────────
//
// A round used to imply a project, so every action hardcoded
// `/projects/${projectId}/…` for revalidation and read the branch off
// the project. Neither holds for a lead-scoped round. These three keep
// that branch in one place instead of at every call site.

export interface RoundParty { projectId: string | null; leadId: string | null }

/** The route segment a round lives under, for revalidatePath. */
export function subjectBasePath(party: RoundParty): string | null {
  if (party.projectId) return `/projects/${party.projectId}`;
  if (party.leadId)    return `/leads/${party.leadId}`;
  return null;
}

/**
 * Revalidate a round's detail page and its parent, for either subject.
 * A no-op when the row somehow has neither (unreachable — the DB CHECK
 * forbids it — but a throw here would break an otherwise-good write).
 */
export function revalidateRound(
  revalidate: (path: string) => void,
  party: RoundParty,
  measurementId?: string,
): void {
  const base = subjectBasePath(party);
  if (!base) return;
  revalidate(base);
  revalidate(`${base}/measurements`);
  if (measurementId) revalidate(`${base}/measurements/${measurementId}`);
}

/**
 * The invoice prefix to allocate document numbers under.
 *
 * A project names its branch. A lead does not belong to one yet, so a
 * lead-scoped round numbers off the org's first branch — the same
 * fallback convertLead uses when it creates the Project.
 */
export async function branchPrefixForParty(
  db: ReturnType<typeof scoped> | TxClient,
  party: RoundParty,
): Promise<string | null> {
  if (party.projectId) {
    const project = await db.project.findUnique({
      where: { id: party.projectId }, select: { branchId: true },
    });
    if (!project) return null;
    const branch = await db.branch.findUnique({
      where: { id: project.branchId }, select: { invoicePrefix: true },
    });
    return branch?.invoicePrefix ?? null;
  }
  const branch = await db.branch.findFirst({ select: { invoicePrefix: true } });
  return branch?.invoicePrefix ?? null;
}

/**
 * Do two rows belong to the same party?
 *
 * Both ids must match, not just the project. Before leads were
 * measurable every row had a non-null projectId and `a.projectId !==
 * b.projectId` was a sound check; with the XOR, two lead-scoped rows
 * both carry projectId === null and that comparison silently passes for
 * *different* leads. Every cross-row ownership check goes through here.
 */
export function sameParty(a: RoundParty, b: RoundParty): boolean {
  return a.projectId === b.projectId && a.leadId === b.leadId;
}

// ── Default room ──────────────────────────────────────────────────────

/** Name of the room created when a measurement starts without one. */
export const DEFAULT_ROOM_NAME = "General";

/**
 * Return the party's first room, creating a "General" one if it has none.
 *
 * Replaces the old "you cannot measure without at least one room" gate.
 * The invariant it protected is still true — a round always has a room
 * to hang items on — but it is now satisfied by making one rather than
 * by stopping the operator at a setup sheet. The owner reported that
 * interruption from both directions (2026-08-28): "it is asking me for
 * add a room but I dont want like that".
 *
 * Named rooms are unaffected: an existing room always wins, and the
 * room-setup sheet still exists for people who want to lay a job out
 * room by room before measuring.
 */
export async function ensureRoomForParty(
  db: ReturnType<typeof scoped>,
  orgId: string,
  party: { projectId: string | null; leadId: string | null },
): Promise<string> {
  const existing = await db.room.findFirst({
    where:   party,
    orderBy: { sortOrder: "asc" },
    select:  { id: true },
  });
  if (existing) return existing.id;

  const room = await db.room.create({
    data: {
      organizationId: orgId,
      ...party,
      name:           DEFAULT_ROOM_NAME,
      floorLabel:     null,
      sortOrder:      0,
    },
    select: { id: true },
  });
  return room.id;
}

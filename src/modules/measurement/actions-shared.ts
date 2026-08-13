// Shared helpers for the measurement server actions.
//
// Kept in a separate module so actions.ts (round lifecycle) and
// actions-item.ts (item lifecycle) stay under CLAUDE.md §10's 300-line
// ceiling and share exactly one implementation of these primitives.

import type { z } from "zod";
import { Prisma } from "@/kernel/numbering/series";
import type { TxClient } from "@/kernel/db/transaction";
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
    widthMm:            new Prisma.Decimal(d.widthMm),
    heightMm:           new Prisma.Decimal(d.heightMm),
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
    widthMm:            new Prisma.Decimal(d.widthMm),
    heightMm:           new Prisma.Decimal(d.heightMm),
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

/** Recompute + persist. Used by both add + update paths. */
export function computeCalcRow(d: AddItemInput): CalcResultRow {
  return computeCalcResult(d);
}

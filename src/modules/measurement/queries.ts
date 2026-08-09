// Measurement repository — read side for /projects/[id]/measurements.
// Items are stored in the Measurement→Room→MeasurementItem hierarchy.
// CalcResult.inputs stores the full JSON input blob; output fields are typed.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import type { MeasurementFamily } from "./schema";

// Map canonical ProductFamily back to the simplified family string the UI uses.
const FAMILY_MAP: Record<string, MeasurementFamily | undefined> = {
  WALLPAPER:       "WALLPAPER",
  FLOORING:        "FLOORING",
  CURTAIN_FABRIC:  "CURTAIN",
  SHEER:           "CURTAIN",
};

export interface MeasurementItemRow {
  id:            string;
  projectId:     string;
  roomLabel:     string;
  label:         string;
  family:        MeasurementFamily;
  inputs:        unknown;              // family-specific JSON blob (stored in CalcResult.inputs)
  photoKey:      string | null;
  notes:         string | null;
  createdAt:     Date;
  updatedAt:     Date;
  calc: {
    engineVersion: string;
    outputs:       unknown;
    warnings:      string[];
    computedAt:    Date;
  } | null;
}

export async function listMeasurementsForProject(
  ctx: RequestContext,
  projectId: string,
): Promise<MeasurementItemRow[]> {
  requirePermission(ctx, "project.view");
  const db = scoped(ctx);

  const items = await db.measurementItem.findMany({
    where:   { measurement: { projectId } },
    orderBy: [{ room: { name: "asc" } }, { label: "asc" }],
    select: {
      id: true, label: true, family: true, photoKeys: true, notes: true,
      room:        { select: { name: true } },
      measurement: { select: { projectId: true, visitedAt: true } },
      calc: {
        select: {
          engineVersion: true, inputs: true, warnings: true, computedAt: true,
          materialQty: true, materialUnit: true,
          rollsRequired: true, boxesRequired: true, areaSqft: true,
          cutLengthMm: true, widthsRequired: true,
        },
      },
    },
  });

  return items.map((r): MeasurementItemRow => ({
    id:        r.id,
    projectId: r.measurement.projectId,
    roomLabel: r.room.name,
    label:     r.label,
    family:    FAMILY_MAP[r.family] ?? "WALLPAPER",
    inputs:    r.calc?.inputs ?? {},
    photoKey:  r.photoKeys[0] ?? null,
    notes:     r.notes,
    createdAt: r.measurement.visitedAt,
    updatedAt: r.measurement.visitedAt,
    calc:      r.calc
      ? {
          engineVersion: r.calc.engineVersion,
          outputs: {
            materialQty:    Number(r.calc.materialQty),
            materialUnit:   r.calc.materialUnit,
            rollsRequired:  r.calc.rollsRequired,
            boxesRequired:  r.calc.boxesRequired,
            areaSqft:       r.calc.areaSqft ? Number(r.calc.areaSqft) : null,
            cutLengthMm:    r.calc.cutLengthMm ? Number(r.calc.cutLengthMm) : null,
            widthsRequired: r.calc.widthsRequired,
          },
          warnings:   r.calc.warnings,
          computedAt: r.calc.computedAt,
        }
      : null,
  }));
}

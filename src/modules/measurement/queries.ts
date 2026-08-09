// @ts-nocheck — remote module, schema reconciliation pending
// Measurement repository — read side for /projects/[id]/measurements.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import type { MeasurementFamily } from "./schema";

export interface MeasurementItemRow {
  id:            string;
  projectId:     string;
  roomLabel:     string;
  label:         string;
  family:        MeasurementFamily;
  inputs:        unknown;              // family-specific — client narrows
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
  const rows = await db.measurementItem.findMany({
    where:   { projectId },
    orderBy: [{ roomLabel: "asc" }, { createdAt: "asc" }],
    select: {
      id: true, projectId: true, roomLabel: true, label: true,
      family: true, inputs: true, photoKey: true, notes: true,
      createdAt: true, updatedAt: true,
      calcResult: {
        select: {
          engineVersion: true, outputs: true, warnings: true, computedAt: true,
        },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id, projectId: r.projectId,
    roomLabel: r.roomLabel, label: r.label,
    family: r.family as MeasurementFamily,
    inputs: r.inputs,
    photoKey: r.photoKey, notes: r.notes,
    createdAt: r.createdAt, updatedAt: r.updatedAt,
    calc: r.calcResult
      ? {
          engineVersion: r.calcResult.engineVersion,
          outputs:       r.calcResult.outputs,
          warnings:      r.calcResult.warnings,
          computedAt:    r.calcResult.computedAt,
        }
      : null,
  }));
}
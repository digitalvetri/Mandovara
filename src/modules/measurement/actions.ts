"use server";

// Measurement server actions — Phase 2 gate.
//
// Every write runs the calc engine and persists MeasurementItem + CalcResult
// atomically.  Edits SUPERSEDE the CalcResult: the old row is deleted and a
// fresh one is inserted with the current engineVersion.  That preserves
// §7 rule 3 (recompute on input change) and §7 rule 1 (versioned outputs)
// without a version chain — sent quotes freeze via QuotationLine.calcSnapshot,
// not by keeping historical CalcResult rows.

import type { z } from "zod";
import { revalidatePath } from "next/cache";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import {
  createMeasurementSchema, updateMeasurementSchema, deleteMeasurementSchema,
  type CreateMeasurementInput,
} from "./schema";
import { runEngine } from "./engine";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createMeasurement(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "measurement.create");
  const parsed = createMeasurementSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  // Confirm the project exists in this org (scoped extension will 404
  // cross-tenant automatically; this is the friendly error path).
  const db = scoped(ctx);
  const project = await db.project.findUnique({
    where: { id: d.projectId }, select: { id: true },
  });
  if (!project) return { ok: false, error: "Project not found" };

  const calc = safeRun(d);
  if (!calc.ok) return { ok: false, error: calc.error };

  const item = await withTransaction(async (tx: TxClient) => {
    const created = await tx.measurementItem.create({
      data: {
        orgId:       ctx.orgId,
        projectId:   d.projectId,
        roomLabel:   d.roomLabel,
        label:       d.label,
        family:      d.family,
        inputs:      d.inputs as object,
        ...(d.notes    && { notes:    d.notes.trim() }),
        ...(d.photoKey && { photoKey: d.photoKey.trim() }),
        createdById: ctx.userId,
      },
      select: { id: true },
    });
    await tx.calcResult.create({
      data: {
        orgId:             ctx.orgId,
        measurementItemId: created.id,
        engineVersion:     calc.engineVersion,
        family:            d.family,
        inputs:            d.inputs as object,
        outputs:           calc.outputs as object,
        warnings:          calc.warnings,
      },
    });
    return created;
  });

  revalidatePath(`/projects/${d.projectId}/measurements`);
  return { ok: true, data: item };
}

export async function updateMeasurement(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "measurement.update");
  const parsed = updateMeasurementSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const existing = await db.measurementItem.findUnique({
    where: { id: d.id }, select: { id: true, projectId: true, family: true },
  });
  if (!existing) return { ok: false, error: "Measurement not found" };

  const calc = safeRun(d);
  if (!calc.ok) return { ok: false, error: calc.error };

  await withTransaction(async (tx: TxClient) => {
    await tx.measurementItem.update({
      where: { id: d.id },
      data: {
        roomLabel:   d.roomLabel,
        label:       d.label,
        family:      d.family,
        inputs:      d.inputs as object,
        notes:       d.notes?.trim() ?? null,
        photoKey:    d.photoKey?.trim() ?? null,
        updatedById: ctx.userId,
      },
    });
    // Supersede: delete old CalcResult (unique per item) + insert fresh.
    await tx.calcResult.deleteMany({ where: { measurementItemId: d.id } });
    await tx.calcResult.create({
      data: {
        orgId:             ctx.orgId,
        measurementItemId: d.id,
        engineVersion:     calc.engineVersion,
        family:            d.family,
        inputs:            d.inputs as object,
        outputs:           calc.outputs as object,
        warnings:          calc.warnings,
      },
    });
  });

  revalidatePath(`/projects/${existing.projectId}/measurements`);
  return { ok: true, data: { id: d.id } };
}

export async function deleteMeasurement(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "measurement.delete");
  const parsed = deleteMeasurementSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id } = parsed.data;

  const db = scoped(ctx);
  const existing = await db.measurementItem.findUnique({
    where: { id }, select: { id: true, projectId: true },
  });
  if (!existing) return { ok: false, error: "Measurement not found" };

  // Cascade: CalcResult.measurementItemId has onDelete: Cascade in the schema.
  await db.measurementItem.delete({ where: { id } });

  revalidatePath(`/projects/${existing.projectId}/measurements`);
  return { ok: true, data: { id } };
}

// ── helpers ─────────────────────────────────────────────────────────

type EngineOk  = { ok: true;  engineVersion: string; outputs: Record<string, unknown>; warnings: string[] };
type EngineErr = { ok: false; error: string };
function safeRun(input: CreateMeasurementInput): EngineOk | EngineErr {
  try {
    const r = runEngine(input);
    return { ok: true, engineVersion: r.engineVersion, outputs: r.outputs, warnings: r.warnings };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error
        ? `Calc engine rejected inputs: ${err.message}`
        : "Calc engine rejected inputs",
    };
  }
}

function zodError<T = unknown>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path
      .filter((s): s is string | number => typeof s === "string" || typeof s === "number")
      .join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}

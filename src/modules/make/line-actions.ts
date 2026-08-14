"use server";

import type { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { recordFabricIssueSchema, recordActualUsageSchema } from "./schema";
import type { ActionResult } from "./actions";

export async function recordFabricIssue(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "make.update");

  const parsed = recordFabricIssueSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const line = await db.makeJobLine.findUnique({
    where: { id: d.makeJobLineId },
    select: { id: true, makeJobId: true },
  });
  if (!line) return { ok: false, error: "Make job line not found" };

  await db.makeJobLine.update({
    where: { id: d.makeJobLineId },
    data: {
      fabricIssuedM: new Decimal(d.fabricIssuedM),
      ...(d.liningIssuedM !== undefined
        ? { liningIssuedM: new Decimal(d.liningIssuedM) }
        : {}),
    },
  });

  await db.makeJobEvent.create({
    data: {
      organizationId: ctx.orgId,
      makeJobId: line.makeJobId,
      actorId: ctx.userId,
      type: "FABRIC_ISSUED",
      fromStatus: null,
      toStatus: null,
      payload: {
        makeJobLineId: d.makeJobLineId,
        fabricIssuedM: d.fabricIssuedM,
        ...(d.liningIssuedM !== undefined ? { liningIssuedM: d.liningIssuedM } : {}),
      },
    },
  });

  revalidatePath(`/make/${line.makeJobId}`);
  return { ok: true, data: { id: d.makeJobLineId } };
}

export async function recordActualUsage(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "make.update");

  const parsed = recordActualUsageSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const line = await db.makeJobLine.findUnique({
    where: { id: d.makeJobLineId },
    select: { id: true, makeJobId: true },
  });
  if (!line) return { ok: false, error: "Make job line not found" };

  await db.makeJobLine.update({
    where: { id: d.makeJobLineId },
    data: {
      actualUsedM: new Decimal(d.actualUsedM),
      wastageM: new Decimal(d.wastageM),
      qcPassed: d.qcPassed,
      qcNotes: d.qcNotes?.trim() || null,
    },
  });

  revalidatePath(`/make/${line.makeJobId}`);
  return { ok: true, data: { id: d.makeJobLineId } };
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

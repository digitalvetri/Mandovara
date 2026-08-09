"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { allocateNumber, yymmFromDate } from "@/kernel/numbering/series";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { devContext } from "@/lib/dev-context";

export interface ActionResult<T = unknown> {
  ok: boolean; data?: T; error?: string; fieldErrors?: Record<string, string>;
}

const VISIT_PURPOSES = [
  "INITIAL_SURVEY", "MEASUREMENT", "SAMPLE_SHOWING", "SUPERVISION", "SNAG_FIX", "HANDOVER",
] as const;

const VISIT_STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "RESCHEDULED"] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}T/);

const createVisitSchema = z.object({
  projectId:    z.string().cuid().optional(),
  leadId:       z.string().cuid().optional(),
  purpose:      z.enum(VISIT_PURPOSES),
  scheduledAt:  isoDate,
  assignedToId: z.string().cuid("Assign to a team member"),
  observations: z.string().trim().max(2000).optional(),
});

const updateVisitStatusSchema = z.object({
  id:     z.string().cuid(),
  status: z.enum(VISIT_STATUSES),
  observations: z.string().trim().max(2000).optional(),
  customerNotes: z.string().trim().max(2000).optional(),
});

export async function createSiteVisit(
  input: unknown,
): Promise<ActionResult<{ id: string; number: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "sitelog.create");

  const parsed = createVisitSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  if (!d.projectId && !d.leadId) {
    return { ok: false, error: "Either a project or a lead must be linked" };
  }

  const created = await withTransaction(async (tx: TxClient) => {
    const number = await allocateNumber(tx, {
      orgId:  ctx.orgId,
      series: "SV",
      yymm:   yymmFromDate(new Date(d.scheduledAt)),
      prefix: "MDV",
    });
    return tx.siteVisit.create({
      data: {
        organizationId: ctx.orgId,
        number,
        projectId:    d.projectId ?? null,
        leadId:       d.leadId ?? null,
        purpose:      d.purpose,
        scheduledAt:  new Date(d.scheduledAt),
        assignedToId: d.assignedToId,
        status:       "SCHEDULED",
        photoKeys:    [],
        observations: d.observations ?? null,
      },
      select: { id: true, number: true },
    });
  });

  revalidatePath("/site-visits");
  if (d.projectId) revalidatePath(`/projects/${d.projectId}`);
  return { ok: true, data: created };
}

export async function updateSiteVisitStatus(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "sitelog.create");

  const parsed = updateVisitStatusSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id, status, observations, customerNotes } = parsed.data;

  const db = scoped(ctx);
  await db.siteVisit.update({
    where: { id },
    data: {
      status,
      ...(status === "IN_PROGRESS" ? { startedAt: new Date() }   : {}),
      ...(status === "COMPLETED"   ? { completedAt: new Date() }  : {}),
      ...(observations    !== undefined ? { observations }    : {}),
      ...(customerNotes   !== undefined ? { customerNotes }   : {}),
    },
  });

  revalidatePath("/site-visits");
  revalidatePath(`/site-visits/${id}`);
  return { ok: true, data: { id } };
}

function zodError<T = unknown>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path.filter((s): s is string | number => typeof s === "string" || typeof s === "number").join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}

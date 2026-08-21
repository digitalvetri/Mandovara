"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { allocateNumber, yymmFromDate } from "@/kernel/numbering/series";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { devContext } from "@/lib/dev-context";
import { bus } from "@/kernel/events/bus";
import "@/kernel/events/register";

export interface ActionResult<T = unknown> {
  ok: boolean; data?: T; error?: string; fieldErrors?: Record<string, string>;
}

const VISIT_PURPOSES = [
  "INITIAL_SURVEY", "MEASUREMENT", "SAMPLE_SHOWING", "SUPERVISION", "SNAG_FIX", "HANDOVER",
] as const;

const VISIT_STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "RESCHEDULED", "NO_SHOW"] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}T/);

const createVisitSchema = z.object({
  projectId:    z.string().min(1).optional(),
  leadId:       z.string().min(1).optional(),
  purpose:      z.enum(VISIT_PURPOSES),
  scheduledAt:  isoDate,
  assignedToId: z.string().min(1, "Assign to a team member"),
  observations: z.string().trim().max(2000).optional(),
});

const updateVisitStatusSchema = z.object({
  id:     z.string().min(1),
  status: z.enum(VISIT_STATUSES),
  observations: z.string().trim().max(2000).optional(),
  customerNotes: z.string().trim().max(2000).optional(),
});

export async function createSiteVisit(
  input: unknown,
): Promise<ActionResult<{ id: string; number: string; scheduledAt: Date; stageAdvanced: boolean }>> {
  const ctx = await devContext();
  requirePermission(ctx, "sitelog.create");

  const parsed = createVisitSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  if (!d.projectId && !d.leadId) {
    return { ok: false, error: "Either a project or a lead must be linked" };
  }

  // Verify the project exists and belongs to this org before entering the transaction.
  // Without this, an invalid projectId causes a DB-level FK constraint error.
  if (d.projectId) {
    const db = scoped(ctx);
    const exists = await db.project.findFirst({
      where: { id: d.projectId, organizationId: ctx.orgId },
      select: { id: true },
    });
    if (!exists) return { ok: false, error: "Selected project not found" };
  }

  try {
    const created = await withTransaction(async (tx: TxClient) => {
      const number = await allocateNumber(tx, {
        orgId:  ctx.orgId,
        series: "SV",
        yymm:   yymmFromDate(new Date(d.scheduledAt)),
        prefix: "MDV",
      });
      const visit = await tx.siteVisit.create({
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
        select: { id: true, number: true, scheduledAt: true },
      });

      // Auto-advance the project's stage when a visit is scheduled from
      // ENQUIRY. The pipeline moves by *doing the work*, not by clicking a
      // dropdown — so scheduling a site visit progresses the project. Any
      // later visit (project already at MEASUREMENT, INSTALLATION, etc.)
      // leaves the stage alone.
      let stageAdvanced = false;
      if (d.projectId) {
        const res = await tx.project.updateMany({
          where: { id: d.projectId, stage: "ENQUIRY" },
          data:  { stage: "SITE_VISIT" },
        });
        stageAdvanced = res.count > 0;
      }

      return { ...visit, stageAdvanced };
    });

    revalidatePath("/site-visits");
    revalidatePath("/projects");
    if (d.projectId) revalidatePath(`/projects/${d.projectId}`);
    if (d.leadId) revalidatePath(`/leads/${d.leadId}`);
    return { ok: true, data: created };
  } catch (e: unknown) {
    // FIXES-01 §8 doctrine — never let a create action throw silently.
    console.error("createSiteVisit failed:", e);
    return {
      ok:    false,
      error: e instanceof Error ? `Could not create site visit: ${e.message}` : "Could not create site visit",
    };
  }
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
  try {
    const visit = await db.siteVisit.update({
      where: { id },
      data: {
        status,
        ...(status === "IN_PROGRESS" ? { startedAt: new Date() }   : {}),
        ...(status === "COMPLETED"   ? { completedAt: new Date() }  : {}),
        ...(observations    !== undefined ? { observations }    : {}),
        ...(customerNotes   !== undefined ? { customerNotes }   : {}),
      },
      select: { id: true, projectId: true },
    });

    // FIXES-01 §9 — fire siteVisit.completed when transitioning to
    // COMPLETED. The kernel/milestones listener uses this to auto-tick
    // the SITE_VISIT milestone on the project.
    if (status === "COMPLETED" && visit.projectId) {
      await bus.publish({
        type:        "siteVisit.completed",
        orgId:       ctx.orgId,
        actorId:     ctx.userId,
        occurredAt:  new Date(),
        siteVisitId: id,
        projectId:   visit.projectId,
      });
      revalidatePath(`/projects/${visit.projectId}`);
    }

    revalidatePath("/site-visits");
    revalidatePath(`/site-visits/${id}`);
    return { ok: true, data: { id } };
  } catch (e: unknown) {
    console.error("updateSiteVisitStatus failed:", e);
    return {
      ok:    false,
      error: e instanceof Error ? `Could not update site visit: ${e.message}` : "Could not update site visit",
    };
  }
}

function zodError<T = unknown>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path.filter((s): s is string | number => typeof s === "string" || typeof s === "number").join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}

export interface AssignableUser { id: string; name: string; role: string; }

export async function listAssignableUsers(): Promise<AssignableUser[]> {
  const ctx = await devContext();
  const db  = scoped(ctx);
  const rows = await db.user.findMany({
    where:   { status: "ACTIVE" },
    orderBy: { name: "asc" },
    select:  { id: true, name: true, role: true },
  });
  return rows;
}

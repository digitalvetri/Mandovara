"use server";

// Project server actions. Every mutation goes through db.scoped(ctx) + audit
// via the scoped extension.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { parseINR } from "@/kernel/money/format";
import { allocateNumber, yymmFromDate, Prisma } from "@/kernel/numbering/series";
import { generateMilestonesForProject } from "@/kernel/milestones/generate";
import { devContext } from "@/lib/dev-context";
import {
  createProjectSchema, setProjectStatusSchema,
  addMilestoneSchema, setMilestoneStatusSchema,
  addTaskSchema, setTaskStatusSchema,
  addSiteLogSchema,
} from "./schema";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createProject(input: unknown): Promise<ActionResult<{ id: string; number: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "project.create");
  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const orderValue = tryParsePaise(d.orderValue);
  if (orderValue == null) {
    return { ok: false, error: "Validation failed",
             fieldErrors: { orderValue: "Could not parse order value" } };
  }

  const db = scoped(ctx);
  const branch = await db.branch.findUniqueOrThrow({
    where: { id: d.branchId },
    select: { invoicePrefix: true },
  });

  const yymm = yymmFromDate(new Date());
  const created = await withTransaction(async (tx: TxClient) => {
    const number = await allocateNumber(tx, {
      orgId:   ctx.orgId,
      series:  "PRJ",
      yymm,
      prefix:  branch.invoicePrefix,
    });
    const project = await tx.project.create({
      data: {
        organizationId: ctx.orgId,
        branchId:       d.branchId,
        number,
        name:           d.name,
        clientId:       d.clientId,
        stage:          "ENQUIRY",
        siteAddress:    {},
        ownerId:        ctx.userId,
        orderValue,
      },
      select: { id: true, number: true },
    });

    // Seed the common milestone spine (Site Visit → Measurement → Quote
    // → Advance → Procure → Install → Handover) so the panel is never
    // empty. Family-specific rows (Fabric inward, Cut & stitch, etc.)
    // are added later when measurements reveal the project's families —
    // see kernel/milestones/generate.ts.
    await generateMilestonesForProject(tx, {
      orgId:     ctx.orgId,
      projectId: project.id,
      families:  [],
    });

    return project;
  });

  revalidatePath("/projects");
  return { ok: true, data: created };
}

export async function updateProject(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "project.update");

  const parsed = z.object({
    id:                 z.string().min(1),
    name:               z.string().trim().min(2).max(200).optional(),
    orderValue:         z.string().trim().optional(),
    expectedInstallAt:  z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional().or(z.literal("")),
    siteContactName:    z.string().trim().max(120).optional(),
    siteContactMobile:  z.string().trim().max(20).optional(),
  }).safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id, name, orderValue, expectedInstallAt, siteContactName, siteContactMobile } = parsed.data;

  let orderPaise: bigint | undefined;
  if (orderValue && orderValue.trim()) {
    const v = tryParsePaise(orderValue);
    if (v == null) return { ok: false, error: "Validation failed", fieldErrors: { orderValue: "Could not parse order value" } };
    orderPaise = v;
  }

  const db = scoped(ctx);
  await db.project.update({
    where: { id },
    data: {
      ...(name != null       && { name }),
      ...(orderPaise != null && { orderValue: orderPaise }),
      ...(expectedInstallAt != null && {
        expectedInstallAt: expectedInstallAt ? new Date(expectedInstallAt) : null,
      }),
      ...(siteContactName   != null && { siteContactName:   siteContactName   || null }),
      ...(siteContactMobile != null && { siteContactMobile: siteContactMobile || null }),
    },
  });
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return { ok: true, data: { id } };
}

export async function setProjectStatus(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "project.update");
  const parsed = setProjectStatusSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id, status } = parsed.data;
  const db = scoped(ctx);
  await db.project.update({
    where: { id },
    data: { stage: status },
  });
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return { ok: true, data: { id } };
}

export async function archiveProject(id: string): Promise<ActionResult> {
  const ctx = await devContext();
  requirePermission(ctx, "project.update");
  const db = scoped(ctx);
  await db.project.update({ where: { id }, data: { stage: "CANCELLED" } });
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return { ok: true };
}

export async function addMilestone(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "project.update");
  const parsed = addMilestoneSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;
  const db = scoped(ctx);
  const existing = await db.milestone.count({ where: { projectId: d.projectId } });
  const created = await db.milestone.create({
    data: {
      organizationId: ctx.orgId,
      projectId:   d.projectId,
      name:        d.name,
      plannedDate: new Date(d.plannedDate),
      billingPct:  new Prisma.Decimal(d.billingPct),
      order:       existing + 1,
    },
    select: { id: true },
  });
  revalidatePath(`/projects/${d.projectId}`);
  return { ok: true, data: created };
}

export async function setMilestoneStatus(
  input: unknown,
): Promise<ActionResult<{ id: string; billingPct?: number; projectId?: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "project.update");
  const parsed = setMilestoneStatusSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id, status } = parsed.data;
  const db = scoped(ctx);
  const before = await db.milestone.findUniqueOrThrow({
    where: { id }, select: { projectId: true, billingPct: true },
  });
  await db.milestone.update({
    where: { id },
    data: {
      status,
      ...(status === "COMPLETED" && { actualDate: new Date() }),
    },
  });
  revalidatePath(`/projects/${before.projectId}`);
  const billingPct = before.billingPct ? Number(before.billingPct) : 0;
  return {
    ok: true,
    data: {
      id,
      billingPct: status === "COMPLETED" && billingPct > 0 ? billingPct : undefined,
      projectId:  status === "COMPLETED" && billingPct > 0 ? before.projectId : undefined,
    },
  };
}

export async function addTask(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "project.update");
  const parsed = addTaskSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;
  const yymm = yymmFromDate(new Date());
  const created = await withTransaction(async (tx: TxClient) => {
    const number = await allocateNumber(tx, {
      orgId:  ctx.orgId,
      series: "TASK",
      yymm,
      prefix: "MDV",
    });
    return tx.task.create({
      data: {
        organizationId: ctx.orgId,
        number,
        projectId:      d.projectId,
        title:          d.title,
        description:    emptyToNull(d.description),
        priority:       d.priority,
        status:         "TODO",
        assignedToId:   ctx.userId,
        createdById:    ctx.userId,
        ...(d.dueDate && d.dueDate !== "" && { dueAt: new Date(d.dueDate) }),
      },
      select: { id: true },
    });
  });
  revalidatePath(`/projects/${d.projectId}`);
  return { ok: true, data: created };
}

export async function setTaskStatus(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "project.update");
  const parsed = setTaskStatusSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id, status } = parsed.data;
  const db = scoped(ctx);
  const before = await db.task.findUniqueOrThrow({
    where: { id }, select: { projectId: true },
  });
  await db.task.update({
    where: { id },
    data: {
      status,
      ...(status === "DONE" && { completedAt: new Date() }),
    },
  });
  revalidatePath(`/projects/${before.projectId}`);
  return { ok: true, data: { id } };
}

export async function addSiteLog(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "sitelog.create");
  const parsed = addSiteLogSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;
  const db = scoped(ctx);
  const created = await db.siteLog.create({
    data: {
      organizationId: ctx.orgId,
      projectId:    d.projectId,
      loggedAt:     new Date(d.loggedAt),
      summary:      d.summary,
      weather:      emptyToNull(d.weather),
      createdById:  ctx.userId,
      ...(d.manpowerCount != null && { manpowerCount: d.manpowerCount }),
    },
    select: { id: true },
  });
  revalidatePath(`/projects/${d.projectId}`);
  return { ok: true, data: created };
}

// â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function zodError<T = unknown>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path.filter((s): s is string | number => typeof s === "string" || typeof s === "number").join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}
const tryParsePaise = (v: string): bigint | null => { try { return parseINR(v); } catch { return null; } };
const emptyToNull = (v: string | undefined | null): string | null =>
  v == null || v.trim().length === 0 ? null : v.trim();

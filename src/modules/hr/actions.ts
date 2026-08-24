"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

const LEAVE_TYPES = ["CASUAL", "SICK", "EARNED", "COMP_OFF", "UNPAID"] as const;

const applyLeaveSchema = z.object({
  employeeId: z.string().min(1),
  type:       z.enum(LEAVE_TYPES),
  fromDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  toDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  reason:     z.string().trim().max(500).optional(),
});

const approveRejectSchema = z.object({
  id:             z.string().min(1),
  rejectionReason: z.string().trim().max(500).optional(),
});

export async function applyLeave(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "leave.apply");

  const parsed = applyLeaveSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const from = new Date(d.fromDate);
  const to   = new Date(d.toDate);
  if (to < from) return { ok: false, error: "To date must be after from date." };

  const msPerDay = 86_400_000;
  const days = new Decimal(Math.round((to.getTime() - from.getTime()) / msPerDay) + 1);

  const db = scoped(ctx);
  const leave = await db.leave.create({
    data: {
      organizationId: ctx.orgId,
      employeeId:     d.employeeId,
      type:           d.type,
      fromDate:       from,
      toDate:         to,
      days,
      reason:         d.reason ?? null,
      state:          "PENDING",
    },
    select: { id: true },
  });

  revalidatePath("/leave");
  return { ok: true, data: { id: leave.id } };
}

export async function approveLeave(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "leave.approve");

  const parsed = approveRejectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { id } = parsed.data;

  const db = scoped(ctx);
  const leave = await db.leave.findUnique({ where: { id }, select: { state: true } });
  if (!leave) return { ok: false, error: "Leave not found." };
  if (leave.state !== "PENDING") return { ok: false, error: "Only PENDING leaves can be approved." };

  await db.leave.update({
    where: { id },
    data: {
      state:       "APPROVED",
      approvedById: ctx.userId,
      decidedAt:    new Date(),
    },
  });

  revalidatePath("/leave");
  return { ok: true, data: { id } };
}

export async function rejectLeave(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "leave.approve");

  const parsed = approveRejectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { id, rejectionReason } = parsed.data;

  const db = scoped(ctx);
  const leave = await db.leave.findUnique({ where: { id }, select: { state: true } });
  if (!leave) return { ok: false, error: "Leave not found." };
  if (leave.state !== "PENDING") return { ok: false, error: "Only PENDING leaves can be rejected." };

  await db.leave.update({
    where: { id },
    data: {
      state:           "REJECTED",
      approvedById:    ctx.userId,
      decidedAt:       new Date(),
      rejectionReason: rejectionReason ?? null,
    },
  });

  revalidatePath("/leave");
  return { ok: true, data: { id } };
}

// ── helpers ──────────────────────────────────────────────────────────────────

function zodError<T>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path.filter((s): s is string | number => typeof s === "string" || typeof s === "number").join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}

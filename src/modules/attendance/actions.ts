"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";

export interface ActionResult<T = unknown> {
  ok: boolean; data?: T; error?: string; fieldErrors?: Record<string, string>;
}

const markPunchSchema = z.object({
  employeeId: z.string().min(1),
  date:       z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  status:     z.enum(["PRESENT", "HALF_DAY", "ABSENT", "LEAVE", "HOLIDAY", "WEEK_OFF"]),
  inTime:     z.string().optional().or(z.literal("")),
  outTime:    z.string().optional().or(z.literal("")),
});

export async function markPunch(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "attendance.punch");
  const parsed = markPunchSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const day     = new Date(`${d.date}T00:00:00.000Z`);
  const inAt    = d.inTime?.trim() ? new Date(`${d.date}T${padHM(d.inTime)}:00.000Z`) : null;
  const outAt   = d.outTime?.trim() ? new Date(`${d.date}T${padHM(d.outTime)}:00.000Z`) : null;

  const db = scoped(ctx);

  // Reject edits to locked records
  const existing = await db.attendance.findUnique({
    where: { employeeId_date: { employeeId: d.employeeId, date: day } },
    select: { lockedAt: true },
  });
  if (existing?.lockedAt) {
    return { ok: false, error: "This attendance record is locked and cannot be edited." };
  }

  const record = await db.attendance.upsert({
    where:  { employeeId_date: { employeeId: d.employeeId, date: day } },
    create: {
      organizationId: ctx.orgId,
      employeeId:     d.employeeId,
      date:           day,
      status:         d.status,
      inAt,
      outAt,
    },
    update: { status: d.status, inAt, outAt },
    select: { id: true },
  });

  revalidatePath("/attendance");
  return { ok: true, data: record };
}

const lockMonthSchema = z.object({
  month: z.number().int().min(1).max(12),
  year:  z.number().int().min(2020).max(2100),
});

/**
 * Lock all attendance records for a month-year so they can no longer be edited.
 * Must be done before running payroll for that month.
 */
export async function lockMonth(input: unknown): Promise<ActionResult<{ count: number }>> {
  const ctx = await devContext();
  requirePermission(ctx, "attendance.lock");
  const parsed = lockMonthSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { month, year } = parsed.data;

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd   = new Date(Date.UTC(year, month, 1));
  const now        = new Date();

  const db = scoped(ctx);
  const result = await db.attendance.updateMany({
    where: {
      organizationId: ctx.orgId,
      date:           { gte: monthStart, lt: monthEnd },
      lockedAt:       null,
    },
    data: { lockedAt: now },
  });

  revalidatePath("/attendance");
  return { ok: true, data: { count: result.count } };
}

// ── Self-service punch (field PWA) ────────────────────────────────────────────

const punchSelfSchema = z.object({
  clientId:  z.string().min(1),
  type:      z.enum(["in", "out"]),
  timestamp: z.string().datetime(),
  lat:       z.number().optional(),
  lng:       z.number().optional(),
});

/**
 * Self-service punch for the mobile attendance PWA.
 * Resolves the employee from the logged-in user (Employee.userId).
 * Idempotent: punch-in upserts, punch-out updates only if inAt exists.
 */
export async function punchSelf(
  input: unknown,
): Promise<ActionResult<{ id: string; type: "in" | "out" }>> {
  const ctx = await devContext();
  requirePermission(ctx, "attendance.punch");

  const parsed = punchSelfSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);

  const employee = await db.employee.findUnique({
    where:  { userId: ctx.userId },
    select: { id: true },
  });
  if (!employee) {
    return { ok: false, error: "No employee profile is linked to your account." };
  }

  const ts        = new Date(d.timestamp);
  const dayStart  = new Date(Date.UTC(ts.getUTCFullYear(), ts.getUTCMonth(), ts.getUTCDate()));

  const existing = await db.attendance.findUnique({
    where:  { employeeId_date: { employeeId: employee.id, date: dayStart } },
    select: { id: true, lockedAt: true, inAt: true },
  });
  if (existing?.lockedAt) {
    return { ok: false, error: "Attendance for this day is locked and cannot be edited." };
  }

  const latDec = d.lat !== undefined ? new Decimal(d.lat.toFixed(7)) : null;
  const lngDec = d.lng !== undefined ? new Decimal(d.lng.toFixed(7)) : null;

  if (d.type === "in") {
    const record = await db.attendance.upsert({
      where:  { employeeId_date: { employeeId: employee.id, date: dayStart } },
      create: {
        organizationId: ctx.orgId,
        employeeId:     employee.id,
        date:           dayStart,
        status:         "PRESENT",
        inAt:           ts,
        inLat:          latDec,
        inLng:          lngDec,
      },
      update: { status: "PRESENT", inAt: ts, inLat: latDec, inLng: lngDec },
      select: { id: true },
    });
    revalidatePath("/attendance");
    return { ok: true, data: { id: record.id, type: "in" } };
  }

  // punch-out
  if (!existing?.inAt) {
    return { ok: false, error: "No punch-in found for today. Please punch in first." };
  }
  const record = await db.attendance.update({
    where: { employeeId_date: { employeeId: employee.id, date: dayStart } },
    data:  { outAt: ts },
    select: { id: true },
  });
  revalidatePath("/attendance");
  return { ok: true, data: { id: record.id, type: "out" } };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function padHM(s: string): string {
  const parts = s.split(":");
  const h = String(parts[0] ?? "0").padStart(2, "0");
  const m = String(parts[1] ?? "0").padStart(2, "0");
  return `${h}:${m}`;
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

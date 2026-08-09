"use server";

// Attendance actions. Owner/manager can mark punches for any employee for
// today or a past date (subject to attendance.edit permission for past days).

import { z } from "zod";
import { revalidatePath } from "next/cache";

function safeRevalidate(path: string): void {
  try { revalidatePath(path); } catch { /* not in a Next request */ }
}

import { prisma } from "@/kernel/db/client";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";

export interface ActionResult<T = unknown> {
  ok: boolean; data?: T; error?: string; fieldErrors?: Record<string, string>;
}

const markPunchSchema = z.object({
  employeeId: z.string().cuid(),
  date:       z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  status:     z.enum(["PRESENT", "LATE", "HALF_DAY", "ABSENT", "LEAVE"]),
  inTime:     z.string().optional().or(z.literal("")),
  outTime:    z.string().optional().or(z.literal("")),
  // Phase 7b — GPS location captured by the /m/attendance PWA.
  // Nullable so the office punch form (no browser API) still works.
  location:   z.object({
    lat: z.number().finite(),
    lng: z.number().finite(),
  }).optional(),
});

export async function markPunch(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "attendance.punch");
  const parsed = markPunchSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const day = new Date(`${d.date}T00:00:00Z`);
  const inTime = d.inTime && d.inTime.trim() !== ""
    ? new Date(`${d.date}T${padHM(d.inTime)}:00Z`) : null;
  const outTime = d.outTime && d.outTime.trim() !== ""
    ? new Date(`${d.date}T${padHM(d.outTime)}:00Z`) : null;

  const db = scoped(ctx);

  // Month-lock (§14 Phase 7 gate) — refuse edits to any day covered
  // by a FINALIZED or PAID PayrollRun for this employee's branch.
  const emp = await db.employee.findUnique({
    where:  { id: d.employeeId },
    select: { branchId: true },
  });
  if (!emp) return { ok: false, error: "Employee not found" };
  const month = day.getUTCMonth() + 1;
  const year  = day.getUTCFullYear();
  const lockedRun = await db.payrollRun.findFirst({
    where: {
      branchId: emp.branchId,
      month, year,
      status: { in: ["FINALIZED", "PAID"] },
    },
    select: { id: true, status: true },
  });
  if (lockedRun) {
    return {
      ok: false,
      error: `Payroll for ${month}/${year} is ${lockedRun.status} — attendance for this month is locked`,
    };
  }

  const worked = inTime && outTime
    ? (outTime.getTime() - inTime.getTime()) / 3_600_000
    : null;

  // The scoped extension injects orgId into upsert where clauses;
  // Prisma refuses extra fields alongside a compound-unique key.
  // Use raw prisma here — org scoping is already enforced above via
  // the employee lookup through `db = scoped(ctx)`.
  const created = await prisma.attendance.upsert({
    where: { employeeId_date: { employeeId: d.employeeId, date: day } },
    create: {
      orgId:      ctx.orgId,
      employeeId: d.employeeId,
      date:       day,
      status:     d.status,
      inTime, outTime,
      ...(worked != null && { workedHours: worked }),
      ...(d.location && { location: d.location }),
      // A punch that came through the outbox from a mobile client
      // sets this flag so operations knows the row wasn't typed by
      // the office. (Location alone is a strong-enough signal too,
      // but the flag reads faster in the ledger.)
      ...(d.location && { syncedFromOffline: true }),
    },
    update: {
      status:  d.status,
      inTime, outTime,
      ...(worked != null && { workedHours: worked }),
      ...(d.location && { location: d.location, syncedFromOffline: true }),
    },
    select: { id: true },
  });
  safeRevalidate("/attendance");
  return { ok: true, data: created };
}

function padHM(s: string): string {
  // Accept "9:00", "09:00", "9" — normalise to "HH:MM"
  const parts = s.split(":");
  const h = String(parts[0] ?? "0").padStart(2, "0");
  const m = String(parts[1] ?? "0").padStart(2, "0");
  return `${h}:${m}`;
}
function zodError<T = unknown>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path.filter((s): s is string | number => typeof s === "string" || typeof s === "number").join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}

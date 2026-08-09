"use server";

// Employee lifecycle actions.
//   - createEmployee: enter a person into HR. Auto-generates a code if the
//     owner doesn't set one.
//   - deleteEmployee: HARD delete only if there's no attendance / payslip
//     history. Otherwise refuse and point at setEmployeeStatus(SUSPENDED)
//     for a soft archive — payroll history must remain intact.

import type { z } from "zod";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { prisma } from "@/kernel/db/client";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import type { RequestContext } from "@/kernel/auth/context";
import {
  createEmployeeSchema, deleteEmployeeSchema, setEmployeeStatusSchema,
} from "./schema";

export interface ActionResult<T = unknown> {
  ok: boolean; data?: T; error?: string; fieldErrors?: Record<string, string>;
}

export async function createEmployee(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "employee.create");
  const parsed = createEmployeeSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const mobile = d.mobile.startsWith("+91") ? d.mobile : `+91${d.mobile}`;
  const code = d.code && d.code.trim() !== ""
    ? d.code.trim().toUpperCase()
    : await nextEmployeeCode(ctx);

  const created = await db.employee.create({
    data: {
      organizationId: ctx.orgId,
      code,
      name:           d.name,
      mobile,
      designation:    nullish(d.designation) ?? "",
      department:     nullish(d.department) ?? "",
      doj:            new Date(d.joinDate),
      status:         "ACTIVE",
    },
    select: { id: true },
  });

  revalidatePath("/admin");
  revalidatePath("/payroll");
  revalidatePath("/attendance");
  return { ok: true, data: created };
}

export async function deleteEmployee(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "employee.terminate");
  const parsed = deleteEmployeeSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id } = parsed.data;

  const db = scoped(ctx);
  await db.employee.findUniqueOrThrow({ where: { id }, select: { id: true } });

  const [attendanceCount, payslipCount] = await Promise.all([
    prisma.attendance.count({ where: { employeeId: id } }),
    prisma.payslip.count({ where: { employeeId: id } }),
  ]);
  if (attendanceCount > 0 || payslipCount > 0) {
    return {
      ok: false,
      error: "This employee has attendance / payroll history. Mark them Suspended instead so payroll records stay intact.",
    };
  }
  await db.employee.delete({ where: { id } });
  revalidatePath("/admin");
  revalidatePath("/payroll");
  revalidatePath("/attendance");
  return { ok: true, data: { id } };
}

export async function setEmployeeStatus(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "employee.terminate");
  const parsed = setEmployeeStatusSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id, status } = parsed.data;

  // DB uses UserStatus enum (ACTIVE | SUSPENDED). Map UI statuses to DB values.
  const dbStatus: "ACTIVE" | "SUSPENDED" = status === "ACTIVE" ? "ACTIVE" : "SUSPENDED";

  const db = scoped(ctx);
  await db.employee.update({
    where: { id },
    data: { status: dbStatus },
  });
  revalidatePath("/admin");
  revalidatePath("/payroll");
  revalidatePath("/attendance");
  return { ok: true, data: { id } };
}

// ── helpers ────────────────────────────────────────────────────────────────────

async function nextEmployeeCode(ctx: RequestContext): Promise<string> {
  const highest = await prisma.employee.findFirst({
    where: { organizationId: ctx.orgId, code: { startsWith: "EMP" } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const lastNum = highest
    ? Number(highest.code.replace("EMP", "").replace(/\D/g, "")) || 0
    : 0;
  return `EMP${String(lastNum + 1).padStart(4, "0")}`;
}

function nullish(v: string | undefined | null): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}
function zodError<T = unknown>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path.filter((s): s is string | number => typeof s === "string" || typeof s === "number").join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}

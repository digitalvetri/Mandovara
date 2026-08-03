"use server";

// Payroll actions — create/update a salary structure for an employee.
// The actual payroll run computation lands with the payroll runner (Session
// 19); this covers the setup half so owners can enter CTCs.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { parseINR } from "@/kernel/money/format";
import { devContext } from "@/lib/dev-context";

export interface ActionResult<T = unknown> {
  ok: boolean; data?: T; error?: string; fieldErrors?: Record<string, string>;
}

const setStructureSchema = z.object({
  employeeId:    z.string().cuid(),
  ctc:           z.string().trim().min(1, "Enter CTC (annual)"),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
});

export async function setSalaryStructure(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "employee.viewSalary");
  const parsed = setStructureSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  let ctcPaise: bigint;
  try { ctcPaise = parseINR(d.ctc); }
  catch { return { ok: false, error: "Validation failed",
                   fieldErrors: { ctc: "Could not parse amount" } }; }

  const db = scoped(ctx);
  const created = await db.salaryStructure.upsert({
    where: { employeeId: d.employeeId },
    create: {
      orgId:         ctx.orgId,
      employeeId:    d.employeeId,
      effectiveFrom: new Date(d.effectiveFrom),
      ctc:           ctcPaise,
    },
    update: {
      effectiveFrom: new Date(d.effectiveFrom),
      ctc:           ctcPaise,
    },
    select: { id: true },
  });
  revalidatePath("/payroll");
  return { ok: true, data: created };
}

function zodError<T = unknown>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path.filter((s): s is string | number => typeof s === "string" || typeof s === "number").join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}

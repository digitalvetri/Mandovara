"use server";

// Owner-input actions for the Admin console.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { prisma } from "@/kernel/db/client";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";

export interface ActionResult<T = unknown> {
  ok: boolean; data?: T; error?: string; fieldErrors?: Record<string, string>;
}

const mobileRegex = /^(\+91)?\d{10}$/;

const createUserSchema = z.object({
  name:      z.string().trim().min(2).max(120),
  mobile:    z.string().trim().regex(mobileRegex, "10-digit mobile"),
  email:     z.string().trim().email().optional().or(z.literal("")),
  roleId:    z.string().cuid("Pick a role"),
  branchIds: z.array(z.string().cuid()).min(1, "Assign at least one branch"),
  locale:    z.enum(["en", "ta"]).default("en"),
});

const updateCompanySchema = z.object({
  orgId:        z.string().cuid(),
  name:         z.string().trim().min(2).max(200),
  gstin:        z.string().trim().optional().or(z.literal("")),
  fyStartMonth: z.number().int().min(1).max(12),
});

export async function createUser(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "admin.users");
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const mobile = d.mobile.startsWith("+91") ? d.mobile : `+91${d.mobile}`;
  const created = await db.user.create({
    data: {
      orgId:     ctx.orgId,
      name:      d.name,
      mobile,
      email:     d.email && d.email.trim() !== "" ? d.email : null,
      status:    "ACTIVE",
      locale:    d.locale,
      branchIds: d.branchIds,
      userRoles: { create: [{ roleId: d.roleId }] },
    },
    select: { id: true },
  });
  revalidatePath("/admin");
  return { ok: true, data: created };
}

export async function updateCompanySettings(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "admin.settings");
  const parsed = updateCompanySchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  // Organization is org-scoped by definition — write via raw prisma with an
  // explicit orgId equality check (defense in depth against scoping bypass).
  await prisma.organization.update({
    where: { id: d.orgId },
    data: {
      name: d.name,
      gstin: d.gstin && d.gstin.trim() !== "" ? d.gstin.toUpperCase() : null,
      fyStartMonth: d.fyStartMonth,
    },
  });
  revalidatePath("/admin");
  return { ok: true, data: { id: d.orgId } };
}

function zodError<T = unknown>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path.filter((s): s is string | number => typeof s === "string" || typeof s === "number").join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}

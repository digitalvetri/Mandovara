"use server";

// Owner-input actions for the Admin console.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { orgPrisma } from "@/kernel/db/rls";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";

export interface ActionResult<T = unknown> {
  ok: boolean; data?: T; error?: string; fieldErrors?: Record<string, string>;
}

const mobileRegex = /^(\+91)?\d{10}$/;

// roleId carries the AppRole enum value (e.g. "OWNER", "DESIGNER") — no Role model exists.
const APP_ROLE_VALUES = [
  "OWNER", "DESIGNER", "SALES", "MEASURE_EXEC", "STORE",
  "MAKE_SUPERVISOR", "ACCOUNTS", "HR",
] as const;

const createUserSchema = z.object({
  name:      z.string().trim().min(2).max(120),
  mobile:    z.string().trim().regex(mobileRegex, "10-digit mobile"),
  email:     z.string().trim().email().optional().or(z.literal("")),
  roleId:    z.enum(APP_ROLE_VALUES),
  branchIds: z.array(z.string().min(1)).min(1, "Assign at least one branch"),
  locale:    z.enum(["en", "ta"]).default("en"),
});

const updateCompanySchema = z.object({
  orgId:        z.string().min(1),
  name:         z.string().trim().min(2).max(200),
  gstin:        z.string().trim().optional().or(z.literal("")),
  fyStartMonth: z.number().int().min(1).max(12),
});

// Geofence: null on any field clears the fence for that branch.
const setBranchGeofenceSchema = z.object({
  branchId:  z.string().min(1),
  latitude:  z.number().gte(-90).lte(90).nullable(),
  longitude: z.number().gte(-180).lte(180).nullable(),
  radiusM:   z.number().int().min(10).max(50_000).nullable(),
});

export async function createUser(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "admin.users");
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const mobile = d.mobile.startsWith("+91") ? d.mobile : `+91${d.mobile}`;

  // Resolve dynamic Role row matching this AppRole (for the new RBAC system)
  const ROLE_NAME_MAP: Record<string, string> = {
    OWNER: "Owner", DESIGNER: "Designer", SALES: "Sales",
    MEASURE_EXEC: "Measure Executive", STORE: "Store",
    MAKE_SUPERVISOR: "Make Supervisor",
    ACCOUNTS: "Accounts", HR: "HR",
  };
  const dynamicRole = await db.role.findFirst({
    where: { organizationId: ctx.orgId, name: ROLE_NAME_MAP[d.roleId] },
    select: { id: true },
  });

  const created = await db.user.create({
    data: {
      organizationId: ctx.orgId,
      name:           d.name,
      mobile,
      email:          d.email && d.email.trim() !== "" ? d.email : null,
      status:         "ACTIVE",
      locale:         d.locale,
      branchIds:      d.branchIds,
      role:           d.roleId,
      roleId:         dynamicRole?.id ?? null,
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

  await orgPrisma(ctx.orgId).organization.update({
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

export async function setBranchGeofence(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "admin.settings");
  const parsed = setBranchGeofenceSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { branchId, latitude, longitude, radiusM } = parsed.data;

  // XOR-ish rule: either all three are set (fence enabled) or all three
  // cleared (fence disabled). A half-configured fence would silently
  // fall through to legacy accept-any-GPS.
  const anySet = latitude != null || longitude != null || radiusM != null;
  const allSet = latitude != null && longitude != null && radiusM != null;
  if (anySet && !allSet) {
    return { ok: false, error: "Set latitude, longitude AND radius together (or clear all three to disable the fence)." };
  }

  await scoped(ctx).branch.update({
    where: { id: branchId },
    data: {
      latitude:          latitude,
      longitude:         longitude,
      attendanceRadiusM: radiusM,
    },
  });
  revalidatePath("/admin");
  return { ok: true, data: { id: branchId } };
}

function zodError<T = unknown>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path.filter((s): s is string | number => typeof s === "string" || typeof s === "number").join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}

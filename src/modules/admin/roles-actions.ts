"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { isPermissionKey } from "@/kernel/rbac/permissions";
import { devContext } from "@/lib/dev-context";

export interface ActionResult<T = unknown> {
  ok: boolean; data?: T; error?: string;
}

const toggleSchema = z.object({
  roleId: z.string().cuid(),
  key:    z.string().min(3),
  grant:  z.boolean(),
});

export async function togglePermission(input: unknown): Promise<ActionResult> {
  const ctx = await devContext();
  requirePermission(ctx, "admin.permissions");

  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { roleId, key, grant } = parsed.data;

  if (!isPermissionKey(key)) return { ok: false, error: `Unknown permission key: ${key}` };

  const db = scoped(ctx);

  // Block editing the owner role's permissions — it always gets everything via isOwnerRole
  const role = await db.role.findUnique({ where: { id: roleId }, select: { isOwnerRole: true } });
  if (!role) return { ok: false, error: "Role not found" };
  if (role.isOwnerRole) return { ok: false, error: "Owner role permissions are not editable" };

  if (grant) {
    await db.rolePermission.upsert({
      where:  { roleId_key: { roleId, key } },
      create: { roleId, key, scope: "FULL" },
      update: { scope: "FULL" },
    });
  } else {
    await db.rolePermission.deleteMany({ where: { roleId, key } });
  }

  revalidatePath("/admin/roles");
  return { ok: true };
}

const createRoleSchema = z.object({
  name:        z.string().trim().min(2).max(80),
  description: z.string().trim().max(200).optional(),
});

export async function createRole(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "admin.permissions");

  const parsed = createRoleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { name, description } = parsed.data;

  const db = scoped(ctx);
  const role = await db.role.create({
    data: { organizationId: ctx.orgId, name, description: description ?? null, isOwnerRole: false, isSystem: false },
    select: { id: true },
  });

  revalidatePath("/admin/roles");
  return { ok: true, data: role };
}

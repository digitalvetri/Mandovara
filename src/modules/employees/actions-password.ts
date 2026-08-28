"use server";

// Setting an employee's login password from Admin & Roles.
//
// The owner asked for this directly (2026-08-29): people forget their
// password, and the only route that could reset one was
// /api/admin/reset-password — a token-gated endpoint meant for
// operators with shell access, not something an owner can reach from
// the screen where the employees are listed.
//
// Deliberately a SET, not a reveal: nothing here can read an existing
// password, because bcrypt hashes are one-way and the app should never
// be able to tell anyone what their password is. The owner types a new
// one and tells the employee.

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";

export interface ActionResult<T = unknown> {
  ok: boolean; data?: T; error?: string;
}

/** Cost 12 — matches every other place this app hashes a password. */
const BCRYPT_COST = 12;

const schema = z.object({
  employeeId: z.string().trim().min(1),
  password:   z.string().min(8, "Use at least 8 characters.").max(128),
});

export async function setEmployeePassword(input: unknown): Promise<ActionResult> {
  const ctx = await devContext();
  // Same authority that creates and terminates people.
  requirePermission(ctx, "employee.update");

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid password." };
  }
  const { employeeId, password } = parsed.data;

  const db = scoped(ctx);
  const emp = await db.employee.findUnique({
    where:  { id: employeeId },
    select: { id: true, name: true, userId: true },
  });
  if (!emp) return { ok: false, error: "Employee not found." };
  if (!emp.userId) {
    return {
      ok: false,
      error: `${emp.name} has no login account yet, so there is no password to change.`,
    };
  }

  // scoped() constrains the org; confirm the user row is really in it
  // before writing a credential.
  const user = await db.user.findUnique({
    where:  { id: emp.userId },
    select: { id: true },
  });
  if (!user) return { ok: false, error: "That employee's login account is missing." };

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  await db.user.update({ where: { id: user.id }, data: { passwordHash } });

  revalidatePath("/admin");
  return { ok: true };
}

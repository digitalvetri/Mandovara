"use server";

// Giving an existing employee a way to sign in, or changing the one they
// have.
//
// Owner, 2026-08-30: "i give to add their email for loginin to the
// application". The add form can set an email and password for a new
// person, but everyone already on the roster was created before that
// existed — and for them the only control was "set a password", which
// refused outright for anyone with no login account, telling the owner
// something was wrong without offering any way to fix it.
//
// So this does both halves: it sets the address someone signs in with,
// and creates the account itself when there isn't one. Replaces
// actions-password.ts, whose single job is now the `password`-only case
// of this.
//
// Deliberately still a SET, never a reveal — bcrypt is one-way and the
// app should never be able to tell anyone what their password is.

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { resolveDynamicRoleId } from "@/kernel/people/role-name";
import { APP_ROLE_VALUES } from "./schema";

export interface ActionResult<T = unknown> {
  ok: boolean; data?: T; error?: string;
}

/** Cost 12 — matches every other place this app hashes a password. */
const BCRYPT_COST = 12;

const schema = z.object({
  employeeId: z.string().trim().min(1),
  email:      z.string().trim().email("Enter a valid email.").max(160).optional().or(z.literal("")),
  password:   z.string().min(8, "Use at least 8 characters.").max(128).optional().or(z.literal("")),
  /** Required only when creating a login for someone who has none. */
  roleId:     z.enum(APP_ROLE_VALUES).optional().or(z.literal("")),
});

export async function setEmployeeLogin(input: unknown): Promise<ActionResult> {
  const ctx = await devContext();
  // Same authority that creates and terminates people.
  requirePermission(ctx, "employee.update");

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const { employeeId } = parsed.data;
  const email    = parsed.data.email?.trim().toLowerCase() || null;
  const password = parsed.data.password || null;
  const roleId   = parsed.data.roleId || null;

  if (!email && !password) {
    return { ok: false, error: "Enter an email, a password, or both." };
  }

  const db = scoped(ctx);
  const emp = await db.employee.findUnique({
    where:  { id: employeeId },
    select: { id: true, name: true, mobile: true, userId: true },
  });
  if (!emp) return { ok: false, error: "Employee not found." };

  // An address may only answer for one account, or sign-in becomes ambiguous.
  if (email) {
    const clash = await db.user.findFirst({
      where:  { email, ...(emp.userId ? { NOT: { id: emp.userId } } : {}) },
      select: { id: true },
    });
    if (clash) return { ok: false, error: `Another account already uses ${email}.` };
  }

  const passwordHash = password ? await bcrypt.hash(password, BCRYPT_COST) : null;

  // ── They already sign in: update the address and/or the password ──
  if (emp.userId) {
    // scoped() constrains the org; confirm the row is really in it before
    // writing a credential to it.
    const user = await db.user.findUnique({ where: { id: emp.userId }, select: { id: true } });
    if (!user) return { ok: false, error: "That employee's login account is missing." };

    await db.user.update({
      where: { id: user.id },
      data: {
        ...(email        ? { email } : {}),
        ...(passwordHash ? { passwordHash } : {}),
      },
    });
    revalidatePath("/admin");
    return { ok: true };
  }

  // ── No login yet: create one and link it ──
  //
  // A role is required here and nowhere else: User.roleId is what carries
  // permissions, and an account created without one can sign in and then
  // see nothing, which reads as a broken app rather than a missing choice.
  if (!roleId) {
    return {
      ok: false,
      error: `${emp.name} has no login yet — pick a role to create one.`,
    };
  }
  if (!password) {
    return { ok: false, error: `Set a first password for ${emp.name}.` };
  }

  const dynamicRoleId = await resolveDynamicRoleId(db, ctx.orgId, roleId);

  // The clash check above covered the email; the mobile carries a unique
  // constraint of its own, so check it before the write rather than
  // surfacing a Prisma error to the owner.
  const mobileClash = await db.user.findFirst({
    where:  { mobile: emp.mobile },
    select: { id: true },
  });
  if (mobileClash) {
    return {
      ok: false,
      error: `Someone already signs in with ${emp.mobile}. Link that account instead of creating a second one.`,
    };
  }

  await withTransaction(async (tx: TxClient) => {
    const user = await tx.user.create({
      data: {
        organizationId: ctx.orgId,
        name:           emp.name,
        mobile:         emp.mobile,
        email,
        status:         "ACTIVE",
        branchIds:      [],
        role:           roleId,
        roleId:         dynamicRoleId,
        passwordHash,
      },
      select: { id: true },
    });
    await tx.employee.update({ where: { id: emp.id }, data: { userId: user.id } });
  }, { orgId: ctx.orgId });

  revalidatePath("/admin");
  revalidatePath("/attendance");
  revalidatePath("/payroll");
  return { ok: true };
}

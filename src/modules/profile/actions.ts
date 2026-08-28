"use server";

// What an employee may change about themselves.
//
// The profile page was entirely read-only (owner, 2026-08-29). These are
// deliberately the fields a person owns — how to reach them, and who to
// call in an emergency. Name, employee code, designation, department,
// joining date and role stay under HR in Admin: letting someone edit
// their own start date or job title is not a profile feature.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { orgPrisma } from "@/kernel/db/rls";
import { devContext } from "@/lib/dev-context";

export interface ActionResult<T = unknown> {
  ok: boolean; data?: T; error?: string; fieldErrors?: Record<string, string>;
}

const profileSchema = z.object({
  mobile: z.string().trim().regex(/^[\d+\-\s]{6,20}$/, "Enter a valid mobile number."),
  email:  z.string().trim().email("Enter a valid email.").max(160).optional().or(z.literal("")),
  emergencyName:     z.string().trim().max(120).optional().or(z.literal("")),
  emergencyMobile:   z.string().trim().max(20).optional().or(z.literal("")),
  emergencyRelation: z.string().trim().max(60).optional().or(z.literal("")),
});

function zerr(e: z.ZodError): ActionResult {
  const out: Record<string, string> = {};
  for (const i of e.issues) {
    const k = i.path.join(".");
    if (k && !out[k]) out[k] = i.message;
  }
  return { ok: false, error: "Check the highlighted fields.", fieldErrors: out };
}

export async function updateMyProfile(input: unknown): Promise<ActionResult> {
  const ctx = await devContext();
  // No permission check: the subject IS the caller. Every write below is
  // pinned to ctx.userId, so this cannot reach anyone else's record.
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return zerr(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);

  await orgPrisma(ctx.orgId).user.update({
    where: { id: ctx.userId },
    data: {
      mobile: d.mobile,
      email:  d.email?.trim() ? d.email.trim() : null,
    },
  });

  // The employee record carries the work mobile and the emergency
  // contact. Updated only when one exists — an owner with no HR record
  // still gets to edit their login details above.
  const emp = await db.employee.findUnique({
    where: { userId: ctx.userId }, select: { id: true },
  });
  if (emp) {
    const hasEmergency =
      !!d.emergencyName?.trim() || !!d.emergencyMobile?.trim() || !!d.emergencyRelation?.trim();
    await db.employee.update({
      where: { id: emp.id },
      data: {
        mobile: d.mobile,
        emergencyContact: hasEmergency
          ? {
              name:     d.emergencyName?.trim()     ?? "",
              mobile:   d.emergencyMobile?.trim()   ?? "",
              relation: d.emergencyRelation?.trim() ?? "",
            }
          : undefined,
      },
    });
  }

  revalidatePath("/profile");
  return { ok: true };
}

const notifySchema = z.object({
  email: z.boolean(),
  app:   z.boolean(),
});

/** Notification preferences, stored on User.notifyPrefs (already in the
 *  schema — nothing read it until now). */
export async function updateMyNotifyPrefs(input: unknown): Promise<ActionResult> {
  const ctx = await devContext();
  const parsed = notifySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid preferences." };

  await orgPrisma(ctx.orgId).user.update({
    where: { id: ctx.userId },
    data:  { notifyPrefs: parsed.data },
  });

  revalidatePath("/profile");
  return { ok: true };
}

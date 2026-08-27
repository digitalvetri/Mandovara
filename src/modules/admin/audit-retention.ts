"use server";

// Audit-log retention: read the window, change it, run the purge.
//
// Owner instruction 2026-08-27: keep only the last five days. The
// database enforces the same window (see migration
// 20260827000003_audit_retention) so nothing here can delete a row that
// is still inside it — the purge and the guard cannot drift apart,
// because the guard is a trigger and the purge is just a DELETE.
//
// Rows can still never be UPDATED. That property is untouched.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { orgPrisma } from "@/kernel/db/rls";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import type { ActionResult } from "./actions";

// Not exported: a "use server" module may only export async functions,
// and Next fails the build otherwise. The key is also written by the
// 20260827000003_audit_retention migration — keep the two in step.
const AUDIT_RETENTION_KEY = "audit.retentionDays";
const DEFAULT_RETENTION_DAYS = 5;

export async function getAuditRetentionDays(): Promise<number> {
  const ctx = await devContext();
  const row = await scoped(ctx).setting.findFirst({
    where:  { key: AUDIT_RETENTION_KEY },
    select: { value: true },
  });
  const v = row?.value as { days?: number } | null;
  return v?.days ?? DEFAULT_RETENTION_DAYS;
}

const setSchema = z.object({
  // Floor of 1: zero would delete the current day's activity as it
  // happens, which would make the log actively misleading rather than
  // merely short. Ceiling of 3650 keeps the interval arithmetic sane.
  days: z.number().int().min(1).max(3650),
});

export async function setAuditRetentionDays(input: unknown): Promise<ActionResult<{ days: number }>> {
  const ctx = await devContext();
  requirePermission(ctx, "admin.settings");
  const parsed = setSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Retention must be between 1 and 3650 days." };
  const { days } = parsed.data;

  await orgPrisma(ctx.orgId).setting.upsert({
    where:  { organizationId_key: { organizationId: ctx.orgId, key: AUDIT_RETENTION_KEY } },
    create: { organizationId: ctx.orgId, key: AUDIT_RETENTION_KEY, value: { days } },
    update: { value: { days } },
  });

  revalidatePath("/admin");
  return { ok: true, data: { days } };
}

/**
 * Delete audit rows older than the retention window.
 *
 * Returns the number removed so the caller can report it rather than
 * claiming a purge happened silently. Safe to run repeatedly; a second
 * run immediately after the first deletes nothing.
 */
export async function purgeAuditLog(): Promise<ActionResult<{ deleted: number; days: number }>> {
  const ctx = await devContext();
  requirePermission(ctx, "admin.settings");

  const days = await getAuditRetentionDays();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const res = await orgPrisma(ctx.orgId).auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    revalidatePath("/admin");
    return { ok: true, data: { deleted: res.count, days } };
  } catch (e) {
    // The trigger fires if the window moved between read and delete.
    console.error("purgeAuditLog failed:", e);
    return { ok: false, error: "Could not purge the audit log — the retention window may have changed. Try again." };
  }
}

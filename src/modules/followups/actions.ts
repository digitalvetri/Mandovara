"use server";

// Follow-up server actions.
// §11 acceptance: completeFollowUp requires an outcome — cannot close without one.

import type { z } from "zod";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import {
  createFollowUpSchema, completeFollowUpSchema, rescheduleFollowUpSchema,
  FOLLOWUP_OUTCOMES,
} from "./schema";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createFollowUp(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "followup.create");
  const parsed = createFollowUpSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  // Convert leadId/clientId/quotationId form input to refType/refId (schema uses the latter)
  let refType: string;
  let refId: string;
  if (d.leadId && d.leadId !== "") {
    refType = "LEAD";      refId = d.leadId;
  } else if (d.clientId && d.clientId !== "") {
    refType = "CLIENT";    refId = d.clientId;
  } else {
    refType = "QUOTATION"; refId = d.quotationId!;
  }

  const db = scoped(ctx);
  const created = await db.followUp.create({
    data: {
      organizationId: ctx.orgId,
      ownerId:        ctx.userId,
      dueAt:          new Date(d.dueAt),
      note:           d.note?.trim() || "",
      refType,
      refId,
    },
    select: { id: true },
  });
  revalidatePath("/followups");
  return { ok: true, data: created };
}

export async function completeFollowUp(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "followup.close");
  const parsed = completeFollowUpSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id, outcome, note } = parsed.data;

  if (!(FOLLOWUP_OUTCOMES as readonly string[]).includes(outcome)) {
    return { ok: false, error: "Outcome is required" };
  }

  const db = scoped(ctx);
  await db.followUp.update({
    where: { id },
    data: {
      outcome,
      completedAt: new Date(),
      ...(note != null && note.trim() !== "" && { note: note.trim() }),
    },
  });
  revalidatePath("/followups");
  return { ok: true, data: { id } };
}

export async function rescheduleFollowUp(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "followup.close");
  const parsed = rescheduleFollowUpSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id, dueAt, note } = parsed.data;
  const db = scoped(ctx);
  await db.followUp.update({
    where: { id },
    data: {
      dueAt:       new Date(dueAt),
      completedAt: null,
      ...(note != null && note.trim() !== "" && { note: note.trim() }),
    },
  });
  revalidatePath("/followups");
  return { ok: true, data: { id } };
}

function zodError<T = unknown>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path
      .filter((s): s is string | number => typeof s === "string" || typeof s === "number")
      .join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";

export interface ActionResult<T = unknown> {
  ok: boolean; data?: T; error?: string; fieldErrors?: Record<string, string>;
}

const createRuleSchema = z.object({
  name:      z.string().trim().min(2).max(120),
  eventType: z.string().trim().min(2).max(60),
  action:    z.string().trim().min(2).max(60),
});

const createTemplateSchema = z.object({
  name:     z.string().trim().min(2).max(60).regex(/^[a-z0-9_]+$/, "lower_snake_case only"),
  language: z.enum(["en", "ta"]),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
  body:     z.string().trim().min(2).max(1024),
});

const toggleRuleSchema = z.object({
  id:      z.string().min(1),
  enabled: z.boolean(),
});

export async function createAutomationRule(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "automation.rule.create");
  const parsed = createRuleSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;
  const db = scoped(ctx);
  const created = await db.automationRule.create({
    data: {
      orgId:      ctx.orgId,
      name:       d.name,
      eventType:  d.eventType,
      conditions: {},
      actions:    [{ kind: d.action }],
      enabled:    true,
    },
    select: { id: true },
  });
  revalidatePath("/whatsapp");
  return { ok: true, data: created };
}

export async function toggleAutomationRule(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "automation.rule.disable");
  const parsed = toggleRuleSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id, enabled } = parsed.data;
  const db = scoped(ctx);
  await db.automationRule.update({ where: { id }, data: { enabled } });
  revalidatePath("/whatsapp");
  return { ok: true, data: { id } };
}

export async function createTemplate(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "whatsapp.template.create");
  const parsed = createTemplateSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;
  const db = scoped(ctx);
  const created = await db.messageTemplate.create({
    data: {
      orgId:     ctx.orgId,
      name:      d.name,
      category:  d.category,
      language:  d.language,
      body:      d.body,
      variables: [],
      status:    "DRAFT",
    },
    select: { id: true },
  });
  revalidatePath("/whatsapp");
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

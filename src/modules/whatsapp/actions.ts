"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";

export interface ActionResult<T = unknown> {
  ok: boolean; data?: T; error?: string; fieldErrors?: Record<string, string>;
}

// ── Cost per message category (paise, approximate) ────────────────────────────
// Utility ₹0.115 = 12 paise  ·  Marketing ₹0.8631 = 86 paise  (§0.8)
const CATEGORY_COST_PAISE: Record<string, bigint> = {
  UTILITY:        12n,
  MARKETING:      86n,
  AUTHENTICATION: 12n,
  SERVICE:        0n,
};

// ── Schema ────────────────────────────────────────────────────────────────────

const createRuleSchema = z.object({
  name:         z.string().trim().min(2).max(120),
  triggerEvent: z.string().trim().min(2).max(60),
  action:       z.string().trim().min(2).max(60),
});

const createTemplateSchema = z.object({
  metaTemplateName: z.string().trim().min(2).max(60).regex(/^[a-z0-9_]+$/, "lower_snake_case only"),
  language:         z.enum(["en", "ta"]),
  category:         z.enum(["MARKETING", "UTILITY", "AUTHENTICATION", "SERVICE"]),
  bodyText:         z.string().trim().min(2).max(1024),
});

const toggleRuleSchema = z.object({
  id:       z.string().min(1),
  isActive: z.boolean(),
});

const sendMessageSchema = z.object({
  templateId:      z.string().min(1),
  toMobile:        z.string().min(10).max(15),
  idempotencyKey:  z.string().min(8).max(120),
  refType:         z.string().optional(),
  refId:           z.string().optional(),
  variables:       z.record(z.string(), z.string()).optional(),
});

// ── Actions ───────────────────────────────────────────────────────────────────

export async function createAutomationRule(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "automation.rule.create");
  const parsed = createRuleSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;
  const db = scoped(ctx);
  const created = await db.automationRule.create({
    data: {
      organizationId: ctx.orgId,
      name:           d.name,
      triggerEvent:   d.triggerEvent,
      conditions:     {},
      actions:        [{ kind: d.action }],
      isActive:       true,
    },
    select: { id: true },
  });
  revalidatePath("/whatsapp");
  return { ok: true, data: created };
}

export async function toggleAutomationRule(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "automation.rule.disable");
  const parsed = toggleRuleSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id, isActive } = parsed.data;
  const db = scoped(ctx);
  await db.automationRule.update({ where: { id }, data: { isActive } });
  revalidatePath("/whatsapp");
  return { ok: true, data: { id } };
}

export async function createTemplate(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "whatsapp.template.create");
  const parsed = createTemplateSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;
  const db = scoped(ctx);
  const created = await db.messageTemplate.create({
    data: {
      organizationId:   ctx.orgId,
      name:             d.metaTemplateName,
      metaTemplateName: d.metaTemplateName,
      category:         d.category,
      language:         d.language,
      bodyText:         d.bodyText,
      variables:        [],
      metaStatus:       "DRAFT",
    },
    select: { id: true },
  });
  revalidatePath("/whatsapp");
  return { ok: true, data: created };
}

/**
 * Send a WhatsApp message via an approved template.
 *
 * Gate (§0.8, §14 Phase 8):
 *  1. Template metaStatus must be "APPROVED" — hard block otherwise.
 *  2. AutomationLog row is written (with costPaise) BEFORE the actual send.
 *  3. Same idempotencyKey is a no-op (idempotent retry).
 */
export async function sendWhatsAppMessage(
  input: unknown,
): Promise<ActionResult<{ logId: string; alreadySent: boolean }>> {
  const ctx = await devContext();
  requirePermission(ctx, "whatsapp.broadcast.send");
  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);

  // ── Idempotency: return early if already processed ────────────────────────
  const existing = await db.automationLog.findUnique({
    where:  { idempotencyKey: d.idempotencyKey },
    select: { id: true },
  });
  if (existing) {
    return { ok: true, data: { logId: existing.id, alreadySent: true } };
  }

  // ── Template must be APPROVED ─────────────────────────────────────────────
  const template = await db.messageTemplate.findUnique({
    where:  { id: d.templateId },
    select: { id: true, category: true, metaStatus: true },
  });
  if (!template) {
    return { ok: false, error: "Template not found." };
  }
  if (template.metaStatus !== "APPROVED") {
    return {
      ok:    false,
      error: `Template is not approved (status: ${template.metaStatus}). ` +
             `Submit it to Meta for approval before sending.`,
    };
  }

  // ── Write AutomationLog BEFORE send (§0.8) ────────────────────────────────
  const category  = template.category as string;
  const costPaise = CATEGORY_COST_PAISE[category] ?? 0n;

  const log = await db.automationLog.create({
    data: {
      organizationId: ctx.orgId,
      idempotencyKey: d.idempotencyKey,
      templateId:     d.templateId,
      category:       template.category,
      toMobile:       d.toMobile,
      refType:        d.refType ?? null,
      refId:          d.refId ?? null,
      status:         "QUEUED",
      costPaise,
    },
    select: { id: true },
  });

  // ── Dispatch (enqueue via BullMQ / n8n webhook in production) ────────────
  // In the current dev environment the actual send is deferred; the log row
  // is already written so idempotency is guaranteed even if this process dies.

  return { ok: true, data: { logId: log.id, alreadySent: false } };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

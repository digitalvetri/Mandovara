"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

function safeRevalidate(path: string): void {
  try { revalidatePath(path); } catch { /* not in a Next request */ }
}

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";

// §14 Phase 8 gate — per-message cost by Meta category. Values in
// paise per outbound message, from Meta's India pricing table
// (rounded to nearest paise from published rates: utility ₹0.115,
// marketing ₹0.8631, authentication ₹0.115, service = free within
// the 24h customer-service window).
//
// Kept as a module-level constant so a reconciliation smoke can
// import + assert against it. When Meta bumps the rate card, this
// object is the single point of update.
export const COST_PAISE_BY_CATEGORY = {
  UTILITY:        12n,   // 11.5p → 12
  MARKETING:      87n,   // 86.31p → 87
  AUTHENTICATION: 12n,   // 11.5p → 12
  SERVICE:         0n,   // free while the customer's service window is open
} as const;

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
  safeRevalidate("/whatsapp");
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
  safeRevalidate("/whatsapp");
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
  safeRevalidate("/whatsapp");
  return { ok: true, data: created };
}

// ── Template approval (mock Meta) ────────────────────────────────
//
// Real approval is a Meta round-trip via the WhatsApp Cloud API;
// this session's approveTemplate / rejectTemplate flip the local
// status so QA + smokes can prove the sendWhatsAppMessage gate
// without a live WABA. When the Meta webhook lands, that handler
// calls the same underlying update in one place.

const approveTemplateSchema = z.object({ id: z.string().cuid() });
const rejectTemplateSchema  = z.object({
  id: z.string().cuid(),
  reason: z.string().trim().max(500).optional(),
});

export async function approveTemplate(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "whatsapp.template.approve");
  const parsed = approveTemplateSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id } = parsed.data;

  const db = scoped(ctx);
  const t = await db.messageTemplate.findUnique({
    where: { id }, select: { id: true, status: true, name: true },
  });
  if (!t) return { ok: false, error: "Template not found" };
  if (t.status === "APPROVED") return { ok: true, data: { id } };

  await db.messageTemplate.update({
    where: { id },
    data:  { status: "APPROVED", approvedAt: new Date() },
  });
  safeRevalidate("/whatsapp");
  return { ok: true, data: { id } };
}

export async function rejectTemplate(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "whatsapp.template.approve");
  const parsed = rejectTemplateSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id } = parsed.data;

  const db = scoped(ctx);
  await db.messageTemplate.update({
    where: { id }, data: { status: "REJECTED" },
  });
  safeRevalidate("/whatsapp");
  return { ok: true, data: { id } };
}

// ── sendWhatsAppMessage — §14 Phase 8 gate load-bearing action ──
//
// Three invariants (per §14 gate + §0.8 idempotency):
//   1. Template must be APPROVED. DRAFT / SUBMITTED / REJECTED /
//      PAUSED / DISABLED all refuse with a clear error.
//   2. costPaise is set from the template's Meta category — hardcoded
//      in COST_PAISE_BY_CATEGORY. Utility ₹0.115 vs marketing
//      ₹0.8631 is a 7.5× cost difference (§9); logging it wrong
//      is the load-bearing bookkeeping failure Phase 8 exists to
//      prevent.
//   3. idempotencyKey: if the caller supplies one and a MessageLog
//      already exists for (orgId, key), we short-circuit and return
//      the existing log's id. No re-send, no duplicate cost.
//
// This session's action stops at MessageLog.create — no Meta HTTP
// call, no waMessageId back-fill. That's a follow-up when n8n +
// the WABA credentials land in the environment. The write is
// authoritative for cost accounting; the send-status transitions
// (SENT → DELIVERED → READ) come in via the Meta webhook later.

const sendWhatsAppMessageSchema = z.object({
  templateName:   z.string().trim().min(1),
  language:       z.enum(["en", "ta"]).default("en"),
  toMobile:       z.string().trim().min(10).max(20),
  params:         z.record(z.string(), z.string()).optional(),
  idempotencyKey: z.string().trim().min(1).max(120).optional(),
  entityType:     z.string().trim().max(40).optional(),
  entityId:       z.string().trim().max(40).optional(),
});

export interface SendResult {
  messageLogId: string;
  status:       string;
  costPaise:    string;
  deduped:      boolean;
}

export async function sendWhatsAppMessage(
  input: unknown,
): Promise<ActionResult<SendResult>> {
  const ctx = await devContext();
  requirePermission(ctx, "whatsapp.broadcast.send");

  const parsed = sendWhatsAppMessageSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);

  // ── Idempotency check FIRST (before template load) ────────────
  if (d.idempotencyKey) {
    const existing = await db.messageLog.findFirst({
      where:  { idempotencyKey: d.idempotencyKey },
      select: { id: true, status: true, costPaise: true },
    });
    if (existing) {
      return {
        ok: true,
        data: {
          messageLogId: existing.id,
          status:       existing.status,
          costPaise:    existing.costPaise.toString(),
          deduped:      true,
        },
      };
    }
  }

  // ── Template gate ────────────────────────────────────────────
  const template = await db.messageTemplate.findFirst({
    where:  { name: d.templateName, language: d.language },
    select: { id: true, name: true, status: true, category: true, body: true },
  });
  if (!template) {
    return {
      ok: false,
      error: `Template "${d.templateName}" (${d.language}) not found`,
    };
  }
  if (template.status !== "APPROVED") {
    return {
      ok: false,
      error: `Template "${template.name}" is ${template.status} — Meta must approve it before it can be sent`,
    };
  }

  // ── Cost from category (hardcoded rate card) ────────────────
  const category = template.category as keyof typeof COST_PAISE_BY_CATEGORY;
  const costPaise = COST_PAISE_BY_CATEGORY[category];
  if (costPaise === undefined) {
    return { ok: false, error: `Unknown template category: ${template.category}` };
  }

  // ── Body variable substitution (best-effort) ────────────────
  // Meta templates use {{1}}, {{2}} placeholders. This substitutes
  // by name from d.params if the caller passed named keys, and also
  // supports positional {{1}} if params has "1", "2", … . Leaves
  // unsubstituted vars in place — Meta rejects unfilled ones at
  // send time anyway.
  let body = template.body;
  if (d.params) {
    for (const [k, v] of Object.entries(d.params)) {
      body = body.replaceAll(`{{${k}}}`, v);
    }
  }

  const log = await db.messageLog.create({
    data: {
      orgId:          ctx.orgId,
      templateId:     template.id,
      toNumber:       d.toMobile,
      direction:      "OUTBOUND",
      category:       template.category,
      body,
      status:         "QUEUED",     // Meta webhook flips to SENT/DELIVERED later
      costPaise,
      ...(d.entityType && { entityType: d.entityType }),
      ...(d.entityId   && { entityId:   d.entityId }),
      ...(d.idempotencyKey && { idempotencyKey: d.idempotencyKey }),
    },
    select: { id: true, status: true },
  });

  safeRevalidate("/whatsapp");
  return {
    ok: true,
    data: {
      messageLogId: log.id,
      status:       log.status,
      costPaise:    costPaise.toString(),
      deduped:      false,
    },
  };
}

function zodError<T = unknown>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path.filter((s): s is string | number => typeof s === "string" || typeof s === "number").join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}

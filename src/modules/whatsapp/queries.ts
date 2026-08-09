// WhatsApp automation console — real reads only.
// Empty tables render as empty states with owner-entry CTAs.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import type { Prisma } from "@prisma/client";

export interface WARule {
  id:      string;
  name:    string;
  trigger: string;
  action:  string;
  active:  boolean;
}

export interface WATemplate {
  id:       string;
  name:     string;
  language: string;
  approved: boolean;
  category: string;
}

export interface WAInboxMsg {
  id:                 string;
  contact:            string;
  body:               string;
  when:               string;
  unread:             number;
  serviceWindowMins:  number | null; // minutes remaining in 24h free reply window; null = closed
}

export interface WAView {
  sentToday:     number;
  delivered:     number;
  read:          number;
  templateCount: number;
  rules:         WARule[];
  templates:     WATemplate[];
  inbox:         WAInboxMsg[];
}

export async function loadWhatsApp(ctx: RequestContext): Promise<WAView> {
  requirePermission(ctx, "whatsapp.view");
  const db         = scoped(ctx);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  const [sentToday, delivered, read, templateCount, templates, rules, conversations] =
    await Promise.all([
      db.automationLog.count({
        where: { organizationId: ctx.orgId, sentAt: { gte: todayStart } },
      }),
      db.automationLog.count({
        where: { organizationId: ctx.orgId, status: "DELIVERED" },
      }),
      db.automationLog.count({
        where: { organizationId: ctx.orgId, status: "READ" },
      }),
      db.messageTemplate.count({ where: { organizationId: ctx.orgId } }),
      db.messageTemplate.findMany({
        where:   { organizationId: ctx.orgId },
        orderBy: { name: "asc" },
        take:    12,
        select:  { id: true, name: true, language: true, metaStatus: true, category: true },
      }),
      db.automationRule.findMany({
        where:   { organizationId: ctx.orgId },
        orderBy: { name: "asc" },
        take:    40,
        select:  { id: true, name: true, triggerEvent: true, actions: true, isActive: true },
      }),
      db.whatsAppConversation.findMany({
        where:   { organizationId: ctx.orgId },
        orderBy: { lastMessageAt: "desc" },
        take:    8,
        select:  { id: true, mobile: true, lastMessageAt: true, serviceWindowExpiresAt: true },
      }),
    ]);

  return {
    sentToday,
    delivered,
    read,
    templateCount,
    rules: rules.map((r) => ({
      id:      r.id,
      name:    r.name,
      trigger: `→ ${r.triggerEvent}`,
      action:  readActionLabel(r.actions),
      active:  r.isActive,
    })),
    templates: templates.map((t) => ({
      id:       t.id,
      name:     t.name,
      language: t.language,
      approved: t.metaStatus === "APPROVED",
      category: t.category,
    })),
    inbox: conversations.map((c) => {
      const windowMs = c.serviceWindowExpiresAt
        ? c.serviceWindowExpiresAt.getTime() - Date.now()
        : null;
      const serviceWindowMins = windowMs != null && windowMs > 0
        ? Math.floor(windowMs / 60_000)
        : null;
      return {
        id:                c.id,
        contact:           c.mobile,
        body:              "—", // WhatsAppConversation has no messages relation in schema
        when:              relTime(c.lastMessageAt),
        unread:            0,
        serviceWindowMins,
      };
    }),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function readActionLabel(actions: Prisma.JsonValue): string {
  if (Array.isArray(actions) && actions.length > 0) {
    const a = actions[0];
    if (a && typeof a === "object" && !Array.isArray(a) && "kind" in a) {
      const k = (a as Record<string, unknown>).kind;
      if (typeof k === "string") return k;
    }
  }
  return "—";
}

function relTime(when: Date): string {
  const mins = Math.floor((Date.now() - when.getTime()) / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

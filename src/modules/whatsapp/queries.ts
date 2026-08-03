// WhatsApp automation console — real reads only. Empty tables render as
// empty states with owner-entry CTAs.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface WARule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  active: boolean;
}
export interface WATemplate {
  id: string;
  name: string;
  language: string;
  approved: boolean;
}
export interface WAInboxMsg {
  id: string;
  contact: string;
  body: string;
  when: string;
  unread: number;
}
export interface WAView {
  sentToday: number;
  delivered: number;
  read: number;
  templateCount: number;
  rules: WARule[];
  templates: WATemplate[];
  inbox: WAInboxMsg[];
}

export async function loadWhatsApp(ctx: RequestContext): Promise<WAView> {
  requirePermission(ctx, "whatsapp.view");
  const db = scoped(ctx);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  const [sentToday, delivered, read, templateCount, templates, rules, conversations] = await Promise.all([
    db.messageLog.count({ where: { sentAt: { gte: todayStart } } }),
    db.messageLog.count({ where: { status: "DELIVERED" } }),
    db.messageLog.count({ where: { status: "READ" } }),
    db.messageTemplate.count(),
    db.messageTemplate.findMany({
      orderBy: { name: "asc" }, take: 12,
      select: { id: true, name: true, language: true, status: true },
    }),
    db.automationRule.findMany({
      orderBy: { createdAt: "asc" }, take: 40,
      select: { id: true, name: true, eventType: true, actions: true, enabled: true },
    }),
    db.whatsAppConversation.findMany({
      orderBy: { lastMessageAt: "desc" }, take: 8,
      select: {
        id: true, peerName: true, peerNumber: true, lastMessageAt: true,
        messages: {
          orderBy: { sentAt: "desc" }, take: 1,
          select: { body: true },
        },
      },
    }),
  ]);

  return {
    sentToday, delivered, read, templateCount,
    rules: rules.map((r) => ({
      id: r.id, name: r.name, trigger: `→ ${r.eventType}`,
      action: readActionLabel(r.actions), active: r.enabled,
    })),
    templates: templates.map((t) => ({
      id: t.id, name: t.name, language: t.language,
      approved: t.status === "APPROVED",
    })),
    inbox: conversations.map((c) => ({
      id: c.id,
      contact: c.peerName ?? c.peerNumber,
      body: c.messages[0]?.body ?? "—",
      when: relTime(c.lastMessageAt), unread: 0,
    })),
  };
}

function readActionLabel(actions: unknown): string {
  if (Array.isArray(actions) && actions.length > 0) {
    const a = actions[0];
    if (a && typeof a === "object" && "kind" in a) {
      const k = (a as { kind: unknown }).kind;
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

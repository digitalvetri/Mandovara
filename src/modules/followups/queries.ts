// Follow-ups repository.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface AutomationRuleRow {
  id: string;
  name: string;
  cadence: string;
  active: boolean;
}

export async function listAutomationRules(ctx: RequestContext): Promise<AutomationRuleRow[]> {
  requirePermission(ctx, "automation.view");
  const db = scoped(ctx);
  const rows = await db.automationRule.findMany({
    orderBy: { createdAt: "asc" },
    take: 40,
    select: { id: true, name: true, eventType: true, actions: true, enabled: true },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    cadence: `${r.eventType}${describeActions(r.actions)}`,
    active: r.enabled,
  }));
}

function describeActions(actions: unknown): string {
  if (!Array.isArray(actions) || actions.length === 0) return "";
  const first = actions[0] as { kind?: unknown } | undefined;
  const kind = first && typeof first.kind === "string" ? first.kind : "";
  return kind ? ` · ${kind}` : "";
}

export interface ListFollowUpsQuery {
  bucket?: "OPEN" | "TODAY" | "OVERDUE" | "COMPLETED" | "ALL";
  mineOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export interface FollowUpRow {
  id: string;
  dueAt: Date;
  status: string;
  outcome: string | null;
  note: string | null;
  ownerId: string;
  ownerName: string;
  completedAt: Date | null;
  leadId: string | null;
  leadName: string | null;
  clientId: string | null;
  clientName: string | null;
  quotationId: string | null;
  quotationNumber: string | null;
  daysOverdue: number;
}

export interface ListFollowUpsResult {
  rows: FollowUpRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: { open: number; today: number; overdue: number; completed: number };
}

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

export async function listFollowUps(
  ctx: RequestContext,
  q: ListFollowUpsQuery,
): Promise<ListFollowUpsResult> {
  requirePermission(ctx, "followup.view");
  const db = scoped(ctx);
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);

  const bucket = q.bucket ?? "OPEN";
  const where: Record<string, unknown> = {};
  if (q.mineOnly) where["ownerId"] = ctx.userId;

  switch (bucket) {
    case "TODAY":
      where["status"] = { in: ["OPEN", "OVERDUE"] };
      where["dueAt"] = { gte: todayStart, lte: todayEnd };
      break;
    case "OVERDUE":
      where["status"] = { in: ["OPEN", "OVERDUE"] };
      where["dueAt"] = { lt: todayStart };
      break;
    case "COMPLETED":
      where["status"] = "COMPLETED";
      break;
    case "ALL":
      break;
    case "OPEN":
    default:
      where["status"] = { in: ["OPEN", "OVERDUE"] };
      break;
  }

  const pageSize = Math.min(q.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const page = Math.max(1, q.page ?? 1);
  const skip = (page - 1) * pageSize;

  const [rows, total, counts] = await Promise.all([
    db.followUp.findMany({
      where, orderBy: { dueAt: "asc" }, skip, take: pageSize,
      select: {
        id: true, dueAt: true, status: true, outcome: true, note: true,
        ownerId: true, completedAt: true,
        leadId: true, clientId: true, quotationId: true,
        lead: { select: { id: true, name: true } },
      },
    }),
    db.followUp.count({ where }),
    loadCounts(ctx, todayStart, todayEnd),
  ]);

  // Resolve owner names + client/quotation names in follow-up queries
  const ownerIds = [...new Set(rows.map((r) => r.ownerId))];
  const clientIds = [...new Set(rows.map((r) => r.clientId).filter((x): x is string => x != null))];
  const quotationIds = [...new Set(rows.map((r) => r.quotationId).filter((x): x is string => x != null))];

  const [owners, clients, quotations] = await Promise.all([
    ownerIds.length
      ? db.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
    clientIds.length
      ? db.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
    quotationIds.length
      ? db.quotation.findMany({ where: { id: { in: quotationIds } }, select: { id: true, number: true } })
      : Promise.resolve([]),
  ]);
  const ownerMap = new Map(owners.map((o) => [o.id, o.name]));
  const clientMap = new Map(clients.map((c) => [c.id, c.name]));
  const quoMap = new Map(quotations.map((q) => [q.id, q.number]));

  return {
    rows: rows.map((r) => {
      const daysOverdue = Math.max(0, Math.floor((now.getTime() - r.dueAt.getTime()) / 86_400_000));
      return {
        id: r.id, dueAt: r.dueAt, status: r.status,
        outcome: r.outcome, note: r.note,
        ownerId: r.ownerId, ownerName: ownerMap.get(r.ownerId) ?? "Unknown",
        completedAt: r.completedAt,
        leadId: r.leadId, leadName: r.lead?.name ?? null,
        clientId: r.clientId, clientName: r.clientId ? clientMap.get(r.clientId) ?? null : null,
        quotationId: r.quotationId, quotationNumber: r.quotationId ? quoMap.get(r.quotationId) ?? null : null,
        daysOverdue,
      };
    }),
    total, page, pageSize, counts,
  };
}

async function loadCounts(
  ctx: RequestContext,
  todayStart: Date,
  todayEnd: Date,
): Promise<ListFollowUpsResult["counts"]> {
  const db = scoped(ctx);
  const [open, today, overdue, completed] = await Promise.all([
    db.followUp.count({ where: { status: { in: ["OPEN", "OVERDUE"] } } }),
    db.followUp.count({
      where: {
        status: { in: ["OPEN", "OVERDUE"] },
        dueAt: { gte: todayStart, lte: todayEnd },
      },
    }),
    db.followUp.count({
      where: {
        status: { in: ["OPEN", "OVERDUE"] },
        dueAt: { lt: todayStart },
      },
    }),
    db.followUp.count({ where: { status: "COMPLETED" } }),
  ]);
  return { open, today, overdue, completed };
}

export interface LeadFollowUpRow {
  id: string;
  dueAt: Date;
  status: string;
  outcome: string | null;
  note: string | null;
  completedAt: Date | null;
}

export async function listFollowUpsForLead(
  ctx: RequestContext,
  leadId: string,
): Promise<LeadFollowUpRow[]> {
  requirePermission(ctx, "followup.view");
  const db = scoped(ctx);
  return db.followUp.findMany({
    where: { leadId },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    take: 50,
    select: {
      id: true, dueAt: true, status: true, outcome: true, note: true,
      completedAt: true,
    },
  });
}

export interface FollowUpPickerLead {
  id: string; name: string; mobile: string;
}
export async function listLeadsForFollowUp(ctx: RequestContext): Promise<FollowUpPickerLead[]> {
  requirePermission(ctx, "lead.view");
  const db = scoped(ctx);
  const rows = await db.lead.findMany({
    where: { status: { in: ["NEW", "CONTACTED", "QUALIFIED", "PROPOSED", "NEGOTIATION"] } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, name: true, mobile: true },
  });
  return rows;
}

export interface FollowUpPickerClient {
  id: string; name: string; mobile: string;
}
export async function listClientsForFollowUp(ctx: RequestContext): Promise<FollowUpPickerClient[]> {
  requirePermission(ctx, "client.view");
  const db = scoped(ctx);
  const rows = await db.client.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    take: 200,
    select: { id: true, name: true, primaryMobile: true },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, mobile: r.primaryMobile }));
}

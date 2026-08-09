// Follow-ups repository.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import type { Prisma } from "@prisma/client";

// ── Automation rules ─────────────────────────────────────────────────────────

export interface AutomationRuleRow {
  id:      string;
  name:    string;
  cadence: string;
  active:  boolean;
}

export async function listAutomationRules(ctx: RequestContext): Promise<AutomationRuleRow[]> {
  requirePermission(ctx, "automation.view");
  const db = scoped(ctx);
  const rows = await db.automationRule.findMany({
    orderBy: { name: "asc" },
    take: 40,
    select: { id: true, name: true, triggerEvent: true, actions: true, isActive: true },
  });
  return rows.map((r) => ({
    id:      r.id,
    name:    r.name,
    cadence: `${r.triggerEvent}${describeActions(r.actions)}`,
    active:  r.isActive,
  }));
}

function describeActions(actions: Prisma.JsonValue): string {
  if (!Array.isArray(actions) || actions.length === 0) return "";
  const first = actions[0] as { kind?: unknown } | undefined;
  const kind = first && typeof first.kind === "string" ? first.kind : "";
  return kind ? ` · ${kind}` : "";
}

// ── Follow-up list ────────────────────────────────────────────────────────────

export interface ListFollowUpsQuery {
  bucket?:   "OPEN" | "TODAY" | "OVERDUE" | "COMPLETED" | "ALL";
  mineOnly?: boolean;
  page?:     number;
  pageSize?: number;
}

export interface FollowUpRow {
  id:          string;
  dueAt:       Date;
  status:      string;    // derived: OPEN | OVERDUE | COMPLETED
  outcome:     string | null;
  note:        string;
  ownerId:     string;
  ownerName:   string;
  completedAt: Date | null;
  refType:     string;
  refId:       string;
  refLabel:    string | null;  // lead name / client name / quotation number
  daysOverdue: number;
}

export interface ListFollowUpsResult {
  rows:     FollowUpRow[];
  total:    number;
  page:     number;
  pageSize: number;
  counts:   { open: number; today: number; overdue: number; completed: number };
}

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE     = 100;

export async function listFollowUps(
  ctx: RequestContext,
  q:   ListFollowUpsQuery,
): Promise<ListFollowUpsResult> {
  requirePermission(ctx, "followup.view");
  const db = scoped(ctx);
  const now        = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);

  const bucket = q.bucket ?? "OPEN";
  let where: Prisma.FollowUpWhereInput = {};
  if (q.mineOnly) where = { ...where, ownerId: ctx.userId };

  switch (bucket) {
    case "TODAY":
      where = { ...where, completedAt: null, dueAt: { gte: todayStart, lte: todayEnd } };
      break;
    case "OVERDUE":
      where = { ...where, completedAt: null, dueAt: { lt: todayStart } };
      break;
    case "COMPLETED":
      where = { ...where, completedAt: { not: null } };
      break;
    case "OPEN":
      where = { ...where, completedAt: null };
      break;
    case "ALL":
      break;
  }

  const pageSize = Math.min(q.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const page     = Math.max(1, q.page ?? 1);
  const skip     = (page - 1) * pageSize;

  const [rows, total, counts] = await Promise.all([
    db.followUp.findMany({
      where,
      orderBy: { dueAt: "asc" },
      skip,
      take: pageSize,
      select: {
        id: true, dueAt: true, outcome: true, note: true,
        ownerId: true, completedAt: true, refType: true, refId: true,
      },
    }),
    db.followUp.count({ where }),
    loadCounts(ctx, todayStart, todayEnd),
  ]);

  // Batch-resolve owner names and ref-entity labels
  const ownerIds     = [...new Set(rows.map((r) => r.ownerId))];
  const leadIds      = rows.filter((r) => r.refType === "LEAD").map((r) => r.refId);
  const clientIds    = rows.filter((r) => r.refType === "CLIENT").map((r) => r.refId);
  const quotationIds = rows.filter((r) => r.refType === "QUOTATION").map((r) => r.refId);

  const [owners, leads, clients, quotations] = await Promise.all([
    ownerIds.length
      ? db.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, name: true } })
      : ([] as { id: string; name: string }[]),
    leadIds.length
      ? db.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, name: true } })
      : ([] as { id: string; name: string }[]),
    clientIds.length
      ? db.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } })
      : ([] as { id: string; name: string }[]),
    quotationIds.length
      ? db.quotation.findMany({ where: { id: { in: quotationIds } }, select: { id: true, number: true } })
      : ([] as { id: string; number: string }[]),
  ]);

  const ownerMap    = new Map(owners.map((o) => [o.id, o.name]));
  const refLabelMap = new Map<string, string>();
  for (const l of leads)      refLabelMap.set(l.id, l.name);
  for (const c of clients)    refLabelMap.set(c.id, c.name);
  for (const qt of quotations) refLabelMap.set(qt.id, qt.number);

  return {
    rows: rows.map((r) => {
      const daysOverdue = r.completedAt == null
        ? Math.max(0, Math.floor((now.getTime() - r.dueAt.getTime()) / 86_400_000))
        : 0;
      const status = r.completedAt != null
        ? "COMPLETED"
        : r.dueAt < todayStart ? "OVERDUE" : "OPEN";
      return {
        id: r.id, dueAt: r.dueAt, status,
        outcome: r.outcome, note: r.note,
        ownerId: r.ownerId, ownerName: ownerMap.get(r.ownerId) ?? "Unknown",
        completedAt: r.completedAt,
        refType: r.refType, refId: r.refId,
        refLabel: refLabelMap.get(r.refId) ?? null,
        daysOverdue,
      };
    }),
    total, page, pageSize, counts,
  };
}

async function loadCounts(
  ctx:        RequestContext,
  todayStart: Date,
  todayEnd:   Date,
): Promise<ListFollowUpsResult["counts"]> {
  const db = scoped(ctx);
  const [open, today, overdue, completed] = await Promise.all([
    db.followUp.count({ where: { completedAt: null } }),
    db.followUp.count({ where: { completedAt: null, dueAt: { gte: todayStart, lte: todayEnd } } }),
    db.followUp.count({ where: { completedAt: null, dueAt: { lt: todayStart } } }),
    db.followUp.count({ where: { completedAt: { not: null } } }),
  ]);
  return { open, today, overdue, completed };
}

// ── Per-lead follow-up list ───────────────────────────────────────────────────

export interface LeadFollowUpRow {
  id:          string;
  dueAt:       Date;
  status:      string;
  outcome:     string | null;
  note:        string;
  completedAt: Date | null;
}

export async function listFollowUpsForLead(
  ctx:    RequestContext,
  leadId: string,
): Promise<LeadFollowUpRow[]> {
  requirePermission(ctx, "followup.view");
  const db         = scoped(ctx);
  const now        = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);

  const rows = await db.followUp.findMany({
    where:   { refType: "LEAD", refId: leadId },
    orderBy: [{ completedAt: "asc" }, { dueAt: "asc" }],
    take:    50,
    select:  { id: true, dueAt: true, outcome: true, note: true, completedAt: true },
  });
  return rows.map((r) => ({
    ...r,
    status: r.completedAt != null ? "COMPLETED" : r.dueAt < todayStart ? "OVERDUE" : "OPEN",
  }));
}

// ── Pickers ───────────────────────────────────────────────────────────────────

export interface FollowUpPickerLead {
  id: string; name: string; mobile: string;
}
export async function listLeadsForFollowUp(ctx: RequestContext): Promise<FollowUpPickerLead[]> {
  requirePermission(ctx, "lead.view");
  const db = scoped(ctx);
  return db.lead.findMany({
    where: {
      stage: {
        in: ["NEW", "CONTACTED", "MEASUREMENT_SCHEDULED", "MEASURED", "QUOTED", "NEGOTIATION"],
      },
    },
    orderBy: { createdAt: "desc" },
    take:    200,
    select:  { id: true, name: true, mobile: true },
  });
}

export interface FollowUpPickerClient {
  id: string; name: string; mobile: string;
}
export async function listClientsForFollowUp(ctx: RequestContext): Promise<FollowUpPickerClient[]> {
  requirePermission(ctx, "client.view");
  const db = scoped(ctx);
  return db.client.findMany({
    orderBy: { name: "asc" },
    take:    200,
    select:  { id: true, name: true, mobile: true },
  });
}

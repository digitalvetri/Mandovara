// Project money and team blocks — permission-gated (§3.1 cost/margin).

// Project detail read models — milestones, tasks and site logs.

// Projects repository.
// Schema: Project has `stage ProjectStage`, `siteAddress Json`, `orderValue BigInt`.
// No status, startDate, targetEndDate, milestones, tasks, or siteLogs fields.
// Client relation exists via clientId; Branch via branchId.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { computeOutstanding } from "@/kernel/money/outstanding";
import type { RequestContext } from "@/kernel/auth/context";

// ── Redesign — money block. Loader-gated on permission so the row IDs
// and paisa values never even leave the DB for roles that shouldn't see
// them (Rule 8: cost/margin stripped server-side, never CSS-hidden).
export type ProjectMoney = {
  orderValue: bigint;
  advanceReceived: bigint;
  advanceRequired: bigint;
  outstanding: bigint;
  invoiceTotal: bigint;
  receiptTotal: bigint;
};

export function canViewProjectMoney(ctx: RequestContext): boolean {
  return (
    ctx.permissions.has("order.viewMargin") ||
    ctx.permissions.has("invoice.viewMargin") ||
    ctx.permissions.has("client.viewOutstanding")
  );
}

export async function getProjectMoney(
  ctx: RequestContext,
  projectId: string,
): Promise<ProjectMoney | null> {
  if (!canViewProjectMoney(ctx)) return null;
  const db = scoped(ctx);

  // Fetch non-cancelled invoices first — we need IDs for the allocation join,
  // and we want to exclude cancelled invoices from the totals.
  const [order, advances, receipts, invRows] = await Promise.all([
    db.order.aggregate({
      where: { projectId },
      _sum:  { totalValue: true, advanceRequired: true, advanceReceived: true },
    }),
    db.advance.aggregate({ where: { projectId }, _sum: { amount: true } }),
    db.receipt.aggregate({ where: { projectId }, _sum: { amount: true } }),
    db.invoice.findMany({
      where:  { projectId, status: { not: "CANCELLED" } },
      select: { id: true, total: true, advanceAdjusted: true },
    }),
  ]);

  const invoiceTotal  = invRows.reduce((s, i) => s + i.total, 0n);
  const advAdjTotal   = invRows.reduce((s, i) => s + i.advanceAdjusted, 0n);
  const invIds        = invRows.map((i) => i.id);

  const allocationSum = invIds.length === 0 ? 0n :
    await db.receiptAllocation.aggregate({
      where: { invoiceId: { in: invIds } },
      _sum:  { amount: true },
    }).then((r) => r._sum.amount ?? 0n);

  const orderValue     = order._sum.totalValue      ?? 0n;
  const advanceReq     = order._sum.advanceRequired ?? 0n;
  const advanceRecvOrd = order._sum.advanceReceived ?? 0n;
  const advanceRecvOwn = advances._sum.amount       ?? 0n;
  const receiptTotal   = receipts._sum.amount       ?? 0n;

  // Owner canonical flow (2026-08-25): "advance received" spans BOTH
  // the legacy Advance table AND receipts recorded via /accounts/new
  // (the modern invoice → payment → install path). Take the larger of
  // (order.advanceReceived, sum-of-advances) — those two tend to track
  // the same event — then always add receiptTotal on top.
  const legacyAdvance = advanceRecvOrd > 0n ? advanceRecvOrd : advanceRecvOwn;
  const advanceReceived = legacyAdvance + receiptTotal;

  return {
    orderValue,
    advanceReceived,
    advanceRequired: advanceReq,
    outstanding:     computeOutstanding(invoiceTotal, advAdjTotal, allocationSum),
    invoiceTotal,
    receiptTotal,
  };
}

// ── Redesign — team (owner + measurers + installers on the project).
// Simple list; the right-rail card renders name + role-on-project.
export type ProjectTeamRow = {
  userId: string;
  name: string;
  role: string;
  isOwner: boolean;
};

export async function getProjectTeam(
  ctx: RequestContext,
  projectId: string,
): Promise<ProjectTeamRow[]> {
  requirePermission(ctx, "project.view");
  const db = scoped(ctx);
  const project = await db.project.findUnique({
    where:  { id: projectId },
    select: {
      ownerId: true,
      members: { select: { userId: true, roleOnProject: true } },
    },
  });
  if (!project) return [];

  // Neither Project.owner nor ProjectMember.user is a defined Prisma
  // relation — fetch every referenced user in one query and stitch.
  const userIds = Array.from(
    new Set([project.ownerId, ...project.members.map((m) => m.userId)]),
  );
  const users = userIds.length === 0 ? [] :
    await db.user.findMany({
      where:  { id: { in: userIds } },
      select: { id: true, name: true, role: true },
    });
  const byId = new Map(users.map((u) => [u.id, u]));

  const rows: ProjectTeamRow[] = [];
  const ownerUser = byId.get(project.ownerId);
  rows.push({
    userId:  project.ownerId,
    name:    ownerUser?.name ?? "—",
    role:    ownerUser?.role ?? "OWNER",
    isOwner: true,
  });
  for (const m of project.members) {
    if (m.userId === project.ownerId) continue;
    const u = byId.get(m.userId);
    rows.push({
      userId:  m.userId,
      name:    u?.name ?? "—",
      role:    m.roleOnProject ?? u?.role ?? "MEMBER",
      isOwner: false,
    });
  }
  return rows;
}

// ── Redesign — quotation / order summary tile on the project page.
export type ProjectQuoteOrderSummary = {
  quotations: { id: string; number: string; status: string; total: bigint; date: Date }[];
  order: { id: string; number: string; status: string; totalValue: bigint; date: Date } | null;
};

export async function getProjectQuoteOrderSummary(
  ctx: RequestContext,
  projectId: string,
): Promise<ProjectQuoteOrderSummary> {
  requirePermission(ctx, "project.view");
  const db = scoped(ctx);
  const [quotations, order] = await Promise.all([
    db.quotation.findMany({
      where:   { projectId },
      orderBy: { date: "desc" },
      take:    3,
      select:  { id: true, number: true, status: true, total: true, date: true },
    }),
    db.order.findFirst({
      where:   { projectId },
      orderBy: { date: "desc" },
      select:  { id: true, number: true, status: true, totalValue: true, date: true },
    }),
  ]);
  return { quotations, order };
}

export * from "./queries-detail-money-payments";

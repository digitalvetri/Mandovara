// PurchaseRequest — read side.
// Employees raise requests, Owner/STORE approves, then a PO is created.
// Note: PurchaseRequest.projectId and PurchaseRequestLine.colourwayId are raw FK fields
// with no Prisma relations defined on the project/colourway side — we do manual lookups.

import type { RequestStatus } from "@/kernel/db/client";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission, can } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface RequestRow {
  id:            string;
  number:        string;
  reason:        string;
  status:        string;
  raisedBy:      string;
  neededBy:      Date | null;
  projectName:   string | null;
  lineCount:     number;
  approvedBy:    string | null;
  approvedAt:    Date | null;
}

export interface RequestDetail extends RequestRow {
  lines: {
    id:           string;
    colourwayId:  string | null;
    colourCode:   string | null;
    colourName:   string | null;
    freeTextItem: string | null;
    quantity:     string;
    unit:         string;
  }[];
  rejectionReason: string | null;
  canApprove:      boolean;
}

export async function listPurchaseRequests(
  ctx: RequestContext,
  opts?: { mine?: boolean; status?: string },
): Promise<RequestRow[]> {
  requirePermission(ctx, "requisition.view");
  const db = scoped(ctx);

  const rows = await db.purchaseRequest.findMany({
    where: {
      ...(opts?.mine   ? { raisedById: ctx.userId }                       : {}),
      ...(opts?.status ? { status: opts.status as RequestStatus }         : {}),
    },
    orderBy: { number: "desc" },
    take: 100,
    select: {
      id: true, number: true, reason: true, status: true,
      raisedById: true, neededBy: true, approvedAt: true, approvedById: true,
      projectId: true,
      lines: { select: { id: true } },
    },
  });

  // Resolve user names
  const userIds = [
    ...new Set([
      ...rows.map((r) => r.raisedById),
      ...rows.flatMap((r) => r.approvedById ? [r.approvedById] : []),
    ]),
  ];
  const users = await db.user.findMany({
    where:  { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  // Resolve project names
  const projectIds = [...new Set(
    rows.map((r) => r.projectId).filter((id): id is string => id != null),
  )];
  const projectNameById = new Map<string, string>();
  if (projectIds.length > 0) {
    const projects = await db.project.findMany({
      where:  { id: { in: projectIds } },
      select: { id: true, name: true },
    });
    for (const p of projects) projectNameById.set(p.id, p.name);
  }

  return rows.map((r) => ({
    id:          r.id,
    number:      r.number,
    reason:      r.reason,
    status:      r.status,
    raisedBy:    nameById.get(r.raisedById) ?? "—",
    neededBy:    r.neededBy,
    projectName: r.projectId ? (projectNameById.get(r.projectId) ?? null) : null,
    lineCount:   r.lines.length,
    approvedBy:  r.approvedById ? (nameById.get(r.approvedById) ?? "—") : null,
    approvedAt:  r.approvedAt,
  }));
}

export async function getPurchaseRequest(
  ctx: RequestContext,
  id: string,
): Promise<RequestDetail | null> {
  requirePermission(ctx, "requisition.view");
  const db = scoped(ctx);

  const r = await db.purchaseRequest.findUnique({
    where: { id },
    select: {
      id: true, number: true, reason: true, status: true, neededBy: true,
      raisedById: true, approvedById: true, approvedAt: true, rejectionReason: true,
      projectId: true,
      lines: {
        select: {
          id: true, colourwayId: true, freeTextItem: true, quantity: true, unit: true,
        },
      },
    },
  });
  if (!r) return null;

  // Resolve user names
  const userIds = [r.raisedById, r.approvedById].filter((x): x is string => x != null);
  const users = await db.user.findMany({
    where:  { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  // Resolve project name
  let projectName: string | null = null;
  if (r.projectId) {
    const proj = await db.project.findUnique({
      where:  { id: r.projectId },
      select: { name: true },
    });
    projectName = proj?.name ?? null;
  }

  // Resolve colourway details
  const colourwayIds = [...new Set(
    r.lines.map((l) => l.colourwayId).filter((x): x is string => x != null),
  )];
  const colourwayById = new Map<string, { code: string; colourName: string }>();
  if (colourwayIds.length > 0) {
    const colourways = await db.colourway.findMany({
      where:  { id: { in: colourwayIds } },
      select: { id: true, code: true, colourName: true },
    });
    for (const c of colourways) colourwayById.set(c.id, { code: c.code, colourName: c.colourName });
  }

  return {
    id:              r.id,
    number:          r.number,
    reason:          r.reason,
    status:          r.status,
    raisedBy:        nameById.get(r.raisedById) ?? "—",
    neededBy:        r.neededBy,
    projectName,
    lineCount:       r.lines.length,
    approvedBy:      r.approvedById ? (nameById.get(r.approvedById) ?? "—") : null,
    approvedAt:      r.approvedAt,
    rejectionReason: r.rejectionReason,
    canApprove:      can(ctx, "requisition.approve"),
    lines: r.lines.map((l) => {
      const cw = l.colourwayId ? colourwayById.get(l.colourwayId) : undefined;
      return {
        id:           l.id,
        colourwayId:  l.colourwayId,
        colourCode:   cw?.code ?? null,
        colourName:   cw?.colourName ?? null,
        freeTextItem: l.freeTextItem,
        quantity:     Number(l.quantity).toString(),
        unit:         l.unit,
      };
    }),
  };
}

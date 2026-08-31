// Architect repository — list, detail, picker.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import { resolveClients, UNKNOWN_CLIENT } from "@/kernel/db/resolve-clients";

export interface ArchitectRow {
  id:               string;
  code:             string;
  firmName:         string;
  contactName:      string;
  mobile:           string;
  email:            string | null;
  commissionPct:    string;
  isActive:         boolean;
  clientCount:      number;
  commissionCount:  number;
  earnedTotal:      bigint;
  paidTotal:        bigint;
  outstandingTotal: bigint;
}

export interface ArchitectDetail extends ArchitectRow {
  createdAt:   Date;
  commissions: CommissionRow[];
  clients:     { id: string; name: string; mobile: string }[];
}

export interface CommissionRow {
  id:            string;
  projectId:     string;
  projectNumber: string;
  clientId:      string;
  clientName:    string;
  createdAt:     Date;
  baseAmount:    bigint;
  pct:           string;
  amount:        bigint;
  paidAt:        Date | null;
  paymentRef:    string | null;
  cancelledAt:   Date | null;
  cancelReason:  string | null;
}

export async function listArchitects(ctx: RequestContext): Promise<ArchitectRow[]> {
  requirePermission(ctx, "architect.view");
  const db = scoped(ctx);

  const rows = await db.architect.findMany({
    orderBy: [{ isActive: "desc" }, { firmName: "asc" }],
    select: {
      id: true, code: true, firmName: true, contactName: true,
      mobile: true, email: true, commissionPct: true, isActive: true,
      _count: { select: { clients: true } },
      commissions: {
        where: { cancelledAt: null },
        select: { amount: true, paidAt: true },
      },
    },
  });

  return rows.map((r) => {
    const earnedTotal = r.commissions.reduce((s, c) => s + c.amount, 0n);
    const paidTotal   = r.commissions.reduce(
      (s, c) => s + (c.paidAt != null ? c.amount : 0n), 0n,
    );
    return {
      id: r.id, code: r.code, firmName: r.firmName, contactName: r.contactName,
      mobile: r.mobile, email: r.email,
      commissionPct: r.commissionPct.toString(),
      isActive: r.isActive,
      clientCount: r._count.clients,
      commissionCount: r.commissions.length,
      earnedTotal,
      paidTotal,
      outstandingTotal: earnedTotal - paidTotal,
    };
  });
}

export async function getArchitect(
  ctx: RequestContext, id: string,
): Promise<ArchitectDetail | null> {
  requirePermission(ctx, "architect.view");
  const db = scoped(ctx);

  const row = await db.architect.findUnique({
    where: { id },
    select: {
      id: true, code: true, firmName: true, contactName: true,
      mobile: true, email: true, commissionPct: true, isActive: true,
      createdAt: true,
      clients: {
        orderBy: { createdAt: "desc" }, take: 50,
        select: { id: true, name: true, mobile: true },
      },
      commissions: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true, projectId: true,
          baseAmount: true, pct: true, amount: true,
          paidAt: true, paymentRef: true,
          cancelledAt: true, cancelReason: true, createdAt: true,
          project: {
            select: {
              number: true,
              clientId: true,
            },
          },
        },
      },
    },
  });
  if (!row) return null;

  const activeCommissions = row.commissions.filter((c) => c.cancelledAt == null);
  const clientMap = await resolveClients(db, row.commissions.map((c) => c.project.clientId));
  const earnedTotal = activeCommissions.reduce((s, c) => s + c.amount, 0n);
  const paidTotal   = activeCommissions.reduce(
    (s, c) => s + (c.paidAt != null ? c.amount : 0n), 0n,
  );

  return {
    id: row.id, code: row.code, firmName: row.firmName, contactName: row.contactName,
    mobile: row.mobile, email: row.email,
    commissionPct: row.commissionPct.toString(),
    isActive: row.isActive,
    createdAt: row.createdAt,
    clientCount: row.clients.length,
    commissionCount: activeCommissions.length,
    earnedTotal, paidTotal, outstandingTotal: earnedTotal - paidTotal,
    clients: row.clients,
    commissions: row.commissions.map((c) => ({
      id:            c.id,
      projectId:     c.projectId,
      projectNumber: c.project.number,
      clientId:      c.project.clientId,
      clientName:    clientMap.get(c.project.clientId)?.name ?? UNKNOWN_CLIENT,
      createdAt:     c.createdAt,
      baseAmount:    c.baseAmount,
      pct:           c.pct.toString(),
      amount:        c.amount,
      paidAt:        c.paidAt,
      paymentRef:    c.paymentRef,
      cancelledAt:   c.cancelledAt,
      cancelReason:  c.cancelReason,
    })),
  };
}

export interface ArchitectPickerRow {
  id: string; code: string; firmName: string; commissionPct: string;
}

export async function listArchitectsForPicker(
  ctx: RequestContext,
): Promise<ArchitectPickerRow[]> {
  requirePermission(ctx, "architect.view");
  const db = scoped(ctx);
  const rows = await db.architect.findMany({
    where:   { isActive: true },
    orderBy: { firmName: "asc" },
    take:    500,
    select:  { id: true, code: true, firmName: true, commissionPct: true },
  });
  return rows.map((r) => ({ ...r, commissionPct: r.commissionPct.toString() }));
}

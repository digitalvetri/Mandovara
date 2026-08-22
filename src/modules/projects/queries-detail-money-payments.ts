// Project payments panel.

// Project money and team blocks — permission-gated (§3.1 cost/margin).

// Project detail read models — milestones, tasks and site logs.

// Projects repository.
// Schema: Project has `stage ProjectStage`, `siteAddress Json`, `orderValue BigInt`.
// No status, startDate, targetEndDate, milestones, tasks, or siteLogs fields.
// Client relation exists via clientId; Branch via branchId.

import { scoped } from "@/kernel/db/scoped";
import { canViewProjectMoney } from "./queries-detail-money";
import { requirePermission } from "@/kernel/rbac/guard";
import { computeOutstanding } from "@/kernel/money/outstanding";
import type { RequestContext } from "@/kernel/auth/context";

// ── Payments panel data. Everything the "Payments" card needs so we
// don't have to re-aggregate on the client.
export type ProjectPaymentInvoice = {
  id:              string;
  number:          string;
  status:          string;   // InvoiceStatus (DRAFT / ISSUED / PARTIALLY_PAID / PAID / CANCELLED)
  date:            Date;
  dueDate:         Date;
  total:           bigint;
  advanceAdjusted: bigint;   // advance portion absorbed at invoice creation
  paid:            bigint;   // sum of ReceiptAllocation.amount for this invoice
  outstanding:     bigint;   // total − advanceAdjusted − paid (canonical formula)
  isOverdue:       boolean;
};

export type ProjectPayments = {
  invoiced:       bigint;
  received:       bigint;
  outstanding:    bigint;
  overdue:        bigint;
  orderValue:     bigint;
  latestOrderId:  string | null;
  invoices:       ProjectPaymentInvoice[];
  nextDue:        ProjectPaymentInvoice | null;
};

export async function getProjectPayments(
  ctx: RequestContext,
  projectId: string,
): Promise<ProjectPayments | null> {
  if (!canViewProjectMoney(ctx)) return null;
  const db = scoped(ctx);
  const now = new Date();

  const [invoices, order] = await Promise.all([
    db.invoice.findMany({
      where:   { projectId, status: { not: "CANCELLED" } },
      orderBy: { date: "desc" },
      select:  {
        id: true, number: true, status: true, date: true,
        dueDate: true, total: true, advanceAdjusted: true,
      },
    }),
    db.order.findFirst({
      where:   { projectId, status: { not: "CANCELLED" } },
      orderBy: { date: "desc" },
      select:  { id: true, totalValue: true },
    }),
  ]);

  // ReceiptAllocation has no back-relation to Invoice in the schema, so
  // look up allocations by the invoice ids we just fetched.
  const invoiceIds = invoices.map((i) => i.id);
  const allocations = invoiceIds.length === 0 ? [] :
    await db.receiptAllocation.findMany({
      where:  { invoiceId: { in: invoiceIds } },
      select: { invoiceId: true, amount: true },
    });

  const paidById = new Map<string, bigint>();
  for (const a of allocations) {
    paidById.set(a.invoiceId, (paidById.get(a.invoiceId) ?? 0n) + a.amount);
  }

  const rows: ProjectPaymentInvoice[] = invoices.map((inv) => {
    const paid        = paidById.get(inv.id) ?? 0n;
    const outstanding = computeOutstanding(inv.total, inv.advanceAdjusted, paid);
    const isOverdue   = outstanding > 0n && inv.dueDate.getTime() < now.getTime();
    return {
      id:              inv.id,
      number:          inv.number,
      status:          inv.status,
      date:            inv.date,
      dueDate:         inv.dueDate,
      total:           inv.total,
      advanceAdjusted: inv.advanceAdjusted,
      paid,
      outstanding,
      isOverdue,
    };
  });

  const invoiced    = rows.reduce((s, r) => s + r.total,       0n);
  const received    = rows.reduce((s, r) => s + r.paid,        0n);
  const outstanding = rows.reduce((s, r) => s + r.outstanding, 0n);
  const overdue     = rows.filter((r) => r.isOverdue)
                          .reduce((s, r) => s + r.outstanding, 0n);
  const nextDue     = rows
    .filter((r) => r.outstanding > 0n)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0] ?? null;

  return {
    invoiced,
    received,
    outstanding,
    overdue,
    orderValue:    order?.totalValue ?? 0n,
    latestOrderId: order?.id ?? null,
    invoices:      rows,
    nextDue,
  };
}

// ── Chosen items panel — one row per active MeasurementItem on the
// project's latest (non-superseded) measurement round. Shows the fixed
// site dimensions and the chosen product (colourway + design + image).
// Rendered on the project detail page so client + owner can see, at a
// glance, what was picked without diving into the measurement round.
export type ProjectChosenItem = {
  id:              string;
  label:           string;
  roomName:        string;
  family:          string;
  widthMm:         string;
  heightMm:        string;
  quantity:        number;
  photoKey:        string | null;
  colourwayId:     string | null;
  colourwayCode:   string | null;
  colourName:      string | null;
  hex:             string | null;
  imageKey:        string | null;
  designName:      string | null;
  brandName:       string | null;
  materialQty:     string | null;
  materialUnit:    string | null;
};

export async function getProjectChosenItems(
  ctx: RequestContext,
  projectId: string,
): Promise<ProjectChosenItem[]> {
  requirePermission(ctx, "project.view");
  const db = scoped(ctx);

  // Take the newest non-superseded measurement round; its items are
  // the "current" ones for the project.
  const round = await db.measurement.findFirst({
    where:   {
      projectId,
      status:  { in: ["DRAFT", "SUBMITTED", "APPROVED"] },
    },
    orderBy: [{ revision: "desc" }, { visitedAt: "desc" }],
    select:  { id: true },
  });
  if (!round) return [];

  const items = await db.measurementItem.findMany({
    where:   { measurementId: round.id },
    orderBy: [{ roomId: "asc" }, { label: "asc" }],
    select: {
      id: true, label: true, family: true, quantity: true,
      widthMm: true, heightMm: true, photoKeys: true,
      room: { select: { name: true } },
      calc: {
        select: {
          colourwayId: true,
          materialQty: true, materialUnit: true,
        },
      },
    },
  });

  const colourwayIds = Array.from(new Set(
    items.map((i) => i.calc?.colourwayId).filter((v): v is string => !!v),
  ));
  const colourways = colourwayIds.length === 0 ? [] :
    await db.colourway.findMany({
      where:  { id: { in: colourwayIds } },
      select: {
        id: true, code: true, colourName: true, hex: true, imageKey: true,
        design: {
          select: {
            name: true,
            collection: { select: { brand: { select: { name: true } } } },
          },
        },
      },
    });
  const byId = new Map(colourways.map((c) => [c.id, c]));

  return items.map((i) => {
    const cw = i.calc?.colourwayId ? byId.get(i.calc.colourwayId) : undefined;
    return {
      id:            i.id,
      label:         i.label,
      roomName:      i.room.name,
      family:        i.family,
      widthMm:       i.widthMm.toString(),
      heightMm:      i.heightMm.toString(),
      quantity:      i.quantity,
      photoKey:      i.photoKeys[0] ?? null,
      colourwayId:   cw?.id ?? null,
      colourwayCode: cw?.code ?? null,
      colourName:    cw?.colourName ?? null,
      hex:           cw?.hex ?? null,
      imageKey:      cw?.imageKey ?? null,
      designName:    cw?.design.name ?? null,
      brandName:     cw?.design.collection.brand.name ?? null,
      materialQty:   i.calc?.materialQty.toString() ?? null,
      materialUnit:  i.calc?.materialUnit ?? null,
    };
  });
}

// ── Redesign — has-rooms flag for the "needs rooms" gate on the button.
export async function getProjectRoomCount(
  ctx: RequestContext,
  projectId: string,
): Promise<number> {
  requirePermission(ctx, "project.view");
  const db = scoped(ctx);
  return db.room.count({ where: { projectId } });
}

export interface ClientPickerRow {
  id: string; name: string; mobile: string;
}

export async function listClientsForProject(ctx: RequestContext): Promise<ClientPickerRow[]> {
  requirePermission(ctx, "client.view");
  const db = scoped(ctx);
  const rows = await db.client.findMany({
    orderBy: { name: "asc" },
    take: 200,
    select: { id: true, name: true, mobile: true },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, mobile: r.mobile }));
}

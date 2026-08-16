// Projects repository.
// Schema: Project has `stage ProjectStage`, `siteAddress Json`, `orderValue BigInt`.
// No status, startDate, targetEndDate, milestones, tasks, or siteLogs fields.
// Client relation exists via clientId; Branch via branchId.

import { scoped } from "@/kernel/db/scoped";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface ListProjectsQuery {
  search?: string;
  stage?: string | "ACTIVE" | "ALL";
  page?: number;
  pageSize?: number;
}

export interface ProjectRow {
  id: string;
  number: string;
  name: string;
  clientId: string;
  clientName: string;
  stage: string;
  orderValue: bigint;
  expectedInstallAt: Date | null;
  createdAt: Date;
  milestonesDone: number;
  milestonesTotal: number;
  nextMilestoneName: string | null;
}

export interface ListProjectsResult {
  rows: ProjectRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProjectDetail {
  id: string;
  number: string;
  name: string;
  stage: string;
  clientId: string;
  clientName: string;
  clientMobile: string;
  branchId: string;
  ownerId: string;
  siteAddress: Record<string, unknown> | null;
  siteContactName: string | null;
  siteContactMobile: string | null;
  expectedInstallAt: Date | null;
  orderValue: bigint;
  createdAt: Date;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

// Active stages — post-enquiry, real work underway
const ACTIVE_STAGES = [
  "ORDERED", "PROCUREMENT", "MAKE", "INSTALLATION", "SNAGGING",
] as const;

// ── Landing-page KPI tiles ──────────────────────────────────────
export interface ProjectKpis {
  activeCount:            number;
  awaitingMeasurement:    number;    // ENQUIRY / SITE_VISIT / MEASUREMENT
  paymentsOverdueCount:   number;    // projects with at least one overdue invoice
  receivablesTotal:       bigint;    // sum of invoice outstanding across all projects
}

export async function getProjectKpis(ctx: RequestContext): Promise<ProjectKpis> {
  requirePermission(ctx, "project.view");
  const db = scoped(ctx);
  const now = new Date();

  const [
    active,
    preMeasure,
    overdueInvoices,
    invoices,
    receipts,
  ] = await Promise.all([
    db.project.count({ where: { stage: { in: [...ACTIVE_STAGES] } } }),
    db.project.count({ where: { stage: { in: ["ENQUIRY", "SITE_VISIT", "MEASUREMENT"] } } }),
    db.invoice.findMany({
      where: {
        dueDate:  { lt: now },
        status:   { notIn: ["PAID", "CANCELLED"] },
      },
      select: { projectId: true, total: true, advanceAdjusted: true },
    }),
    db.invoice.aggregate({
      where: { status: { notIn: ["CANCELLED", "DRAFT"] } },
      _sum:  { total: true, advanceAdjusted: true },
    }),
    db.receiptAllocation.aggregate({ _sum: { amount: true } }),
  ]);

  const projectsWithOverdue = new Set(
    overdueInvoices.filter((i) => i.projectId).map((i) => i.projectId as string),
  );
  const invoicedTotal   = invoices._sum.total           ?? 0n;
  const advanceTotal    = invoices._sum.advanceAdjusted ?? 0n;
  const receiptsTotal   = receipts._sum.amount          ?? 0n;
  const receivables     = invoicedTotal - advanceTotal - receiptsTotal;

  return {
    activeCount:          active,
    awaitingMeasurement:  preMeasure,
    paymentsOverdueCount: projectsWithOverdue.size,
    receivablesTotal:     receivables > 0n ? receivables : 0n,
  };
}

export async function listProjects(
  ctx: RequestContext,
  q: ListProjectsQuery,
): Promise<ListProjectsResult> {
  requirePermission(ctx, "project.view");
  const db = scoped(ctx);

  const pageSize = Math.min(q.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const page = Math.max(1, q.page ?? 1);
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (q.search && q.search.trim().length > 0) {
    const s = q.search.trim();
    where["OR"] = [
      { name:   { contains: s, mode: "insensitive" } },
      { number: { contains: s, mode: "insensitive" } },
      { client: { name: { contains: s, mode: "insensitive" } } },
    ];
  }
  if (q.stage && q.stage !== "ALL") {
    if (q.stage === "ACTIVE") where["stage"] = { in: [...ACTIVE_STAGES] };
    else where["stage"] = q.stage;
  }

  const [rows, total] = await Promise.all([
    db.project.findMany({
      where, orderBy: { createdAt: "desc" }, skip, take: pageSize,
      select: {
        id: true, number: true, name: true, stage: true,
        orderValue: true, expectedInstallAt: true, createdAt: true,
        client: { select: { id: true, name: true } },
        milestones: {
          orderBy: { order: "asc" },
          select: { id: true, name: true, status: true, order: true },
        },
      },
    }),
    db.project.count({ where }),
  ]);

  return {
    rows: rows.map((r) => {
      const done  = r.milestones.filter((m) => m.status === "COMPLETED").length;
      const total = r.milestones.length;
      const next  = r.milestones.find((m) => m.status !== "COMPLETED") ?? null;
      return {
        id: r.id, number: r.number, name: r.name, stage: r.stage,
        clientId: r.client.id, clientName: r.client.name,
        orderValue: r.orderValue,
        expectedInstallAt: r.expectedInstallAt,
        createdAt: r.createdAt,
        milestonesDone:    done,
        milestonesTotal:   total,
        nextMilestoneName: next?.name ?? null,
      };
    }),
    total, page, pageSize,
  };
}

export async function getProject(ctx: RequestContext, id: string): Promise<ProjectDetail | null> {
  requirePermission(ctx, "project.view");
  const db = scoped(ctx);
  const row = await db.project.findUnique({
    where: { id },
    select: {
      id: true, number: true, name: true, stage: true, branchId: true, ownerId: true,
      siteAddress: true, siteContactName: true, siteContactMobile: true,
      expectedInstallAt: true, orderValue: true, createdAt: true,
      client: { select: { id: true, name: true, mobile: true } },
    },
  });
  if (!row) return null;

  return {
    id: row.id, number: row.number, name: row.name, stage: row.stage,
    clientId: row.client.id, clientName: row.client.name, clientMobile: row.client.mobile,
    branchId: row.branchId, ownerId: row.ownerId,
    siteAddress: row.siteAddress as Record<string, unknown> | null,
    siteContactName: row.siteContactName,
    siteContactMobile: row.siteContactMobile,
    expectedInstallAt: row.expectedInstallAt,
    orderValue: row.orderValue,
    createdAt: row.createdAt,
  };
}

export type ProjectMilestone = {
  id: string;
  name: string;
  order: number;
  plannedDate: Date;
  actualDate: Date | null;
  /** Legacy % — kept for callers not yet migrated. New UI reads billingWeightPct. */
  billingPct: string;
  billingWeightPct: string | null;
  status: string;
  templateCode: string | null;
  family: string | null;
  autoCompleted: boolean;
  sourceEvent: string | null;
  completedAt: Date | null;
};

export type ProjectTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  completedAt: Date | null;
};

export type ProjectSiteLog = {
  id: string;
  loggedAt: Date;
  summary: string;
  weather: string | null;
  manpowerCount: number | null;
};

export async function getProjectMilestones(
  ctx: RequestContext,
  projectId: string,
): Promise<ProjectMilestone[]> {
  requirePermission(ctx, "project.view");
  const db = scoped(ctx);

  // Lazy backfill: legacy projects created before milestones were auto-
  // seeded still exist in the DB with zero rows. Seed the common spine
  // the first time the detail page is opened so the panel is never empty.
  const existing = await db.milestone.count({ where: { projectId } });
  if (existing === 0) {
    const { generateMilestonesForProject } = await import("@/kernel/milestones/generate");
    await withTransaction(async (tx: TxClient) => {
      await generateMilestonesForProject(tx, {
        orgId:     ctx.orgId,
        projectId,
        families:  [],
      });
    });
  }

  const rows = await db.milestone.findMany({
    where: { projectId },
    orderBy: { order: "asc" },
    select: {
      id: true, name: true, order: true, plannedDate: true,
      actualDate: true, billingPct: true, status: true,
      templateCode: true, family: true, autoCompleted: true,
      sourceEvent: true, completedAt: true, billingWeightPct: true,
    },
  });
  return rows.map((r) => ({
    ...r,
    billingPct: r.billingPct.toString(),
    billingWeightPct: r.billingWeightPct ? r.billingWeightPct.toString() : null,
  }));
}

export async function getProjectTasks(
  ctx: RequestContext,
  projectId: string,
): Promise<ProjectTask[]> {
  requirePermission(ctx, "project.view");
  const db = scoped(ctx);
  const rows = await db.task.findMany({
    where: { projectId },
    orderBy: { id: "asc" },
    select: {
      id: true, title: true, description: true,
      status: true, priority: true, dueAt: true, completedAt: true,
    },
  });
  return rows.map((r) => ({ ...r, dueDate: r.dueAt }));
}

export async function getProjectSiteLogs(
  ctx: RequestContext,
  projectId: string,
): Promise<ProjectSiteLog[]> {
  requirePermission(ctx, "project.view");
  const db = scoped(ctx);
  return db.siteLog.findMany({
    where: { projectId },
    orderBy: { loggedAt: "desc" },
    select: {
      id: true, loggedAt: true, summary: true, weather: true, manpowerCount: true,
    },
  });
}

// ── Redesign — measurement rounds shown on the project detail page ──
export type ProjectMeasurementRow = {
  id: string;
  number: string;
  visitedAt: Date;
  status: string; // MeasurementStatus
  revision: number;
  supersedesId: string | null;
  measuredByName: string;
  itemCount: number;
  roomsCovered: number;
};

export async function getProjectMeasurements(
  ctx: RequestContext,
  projectId: string,
): Promise<ProjectMeasurementRow[]> {
  requirePermission(ctx, "project.view");
  const db = scoped(ctx);
  const rows = await db.measurement.findMany({
    where:   { projectId },
    orderBy: [{ revision: "desc" }, { visitedAt: "desc" }],
    select: {
      id: true, number: true, visitedAt: true, status: true, revision: true,
      supersedesId: true, measuredById: true,
      _count: { select: { items: true } },
      items: { select: { roomId: true }, distinct: ["roomId"] },
    },
  });
  // Measurement has no `measuredBy` relation defined in schema — fetch
  // the measurer names in one round-trip and stitch them in.
  const measurerIds = Array.from(new Set(rows.map((r) => r.measuredById)));
  const measurers = measurerIds.length === 0 ? [] :
    await db.user.findMany({
      where:  { id: { in: measurerIds } },
      select: { id: true, name: true },
    });
  const nameById = new Map(measurers.map((u) => [u.id, u.name]));
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    visitedAt: r.visitedAt,
    status: r.status,
    revision: r.revision,
    supersedesId: r.supersedesId,
    measuredByName: nameById.get(r.measuredById) ?? "—",
    itemCount: r._count.items,
    roomsCovered: new Set(r.items.map((i) => i.roomId)).size,
  }));
}

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
  const [order, advances, invoices, receipts] = await Promise.all([
    db.order.aggregate({
      where: { projectId },
      _sum:  { totalValue: true, advanceRequired: true, advanceReceived: true },
    }),
    db.advance.aggregate({ where: { projectId }, _sum: { amount: true } }),
    db.invoice.aggregate({ where: { projectId }, _sum: { total: true } }),
    db.receipt.aggregate({ where: { projectId }, _sum: { amount: true } }),
  ]);
  const orderValue      = order._sum.totalValue      ?? 0n;
  const advanceReq      = order._sum.advanceRequired ?? 0n;
  const advanceRecvOrd  = order._sum.advanceReceived ?? 0n;
  const advanceRecvOwn  = advances._sum.amount       ?? 0n;
  const invoiceTotal    = invoices._sum.total        ?? 0n;
  const receiptTotal    = receipts._sum.amount       ?? 0n;
  return {
    orderValue,
    advanceReceived: advanceRecvOrd > 0n ? advanceRecvOrd : advanceRecvOwn,
    advanceRequired: advanceReq,
    outstanding:     invoiceTotal - receiptTotal,
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

// ── Payments panel data. Everything the "Payments" card needs so we
// don't have to re-aggregate on the client.
export type ProjectPaymentInvoice = {
  id:            string;
  number:        string;
  status:        string;   // InvoiceStatus (DRAFT / ISSUED / PARTIALLY_PAID / PAID / CANCELLED)
  date:          Date;
  dueDate:       Date;
  total:         bigint;
  paid:          bigint;   // sum of ReceiptAllocation.amount for this invoice
  outstanding:   bigint;   // total − paid
  isOverdue:     boolean;
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
        dueDate: true, total: true,
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
    const outstanding = inv.total - paid;
    const isOverdue   = outstanding > 0n && inv.dueDate.getTime() < now.getTime();
    return {
      id:          inv.id,
      number:      inv.number,
      status:      inv.status,
      date:        inv.date,
      dueDate:     inv.dueDate,
      total:       inv.total,
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

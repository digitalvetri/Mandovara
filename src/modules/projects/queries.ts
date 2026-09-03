// Projects repository.
// Schema: Project has `stage ProjectStage`, `siteAddress Json`, `orderValue BigInt`.
// No status, startDate, targetEndDate, milestones, tasks, or siteLogs fields.
// Client relation exists via clientId; Branch via branchId.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import { resolveClients, resolveClient, UNKNOWN_CLIENT } from "@/kernel/db/resolve-clients";

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
  "ORDERED", "PROCUREMENT", "MAKE",
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
        clientId: true,
        milestones: {
          orderBy: { order: "asc" },
          select: { id: true, name: true, status: true, order: true },
        },
      },
    }),
    db.project.count({ where }),
  ]);

  const projectIds = rows.map((r) => r.id);

  // The card's money figure, from the same three sources and in the same
  // priority order as the project detail header (see [id]/page.tsx —
  // `headerOrderValue`): confirmed order first, then what has been
  // quoted, and only then the stored Project.orderValue column.
  //
  // The column alone was already unreliable — nothing keeps it current
  // once orders and invoices start moving, so a live project could show
  // ₹0 on the card while its own page showed the real total. Since
  // 2026-09-04 the create form no longer asks for a figure at all, so
  // every new project would have read ₹0 forever. Two grouped queries
  // per page (max 200 rows) rather than a per-card lookup.
  const [orderSums, quoteSums, clientMap] = await Promise.all([
    projectIds.length === 0 ? [] : db.order.groupBy({
      by:    ["projectId"],
      // No status filter, matching getProjectMoney's order aggregate
      // exactly. Excluding cancelled orders here would arguably be more
      // correct — and would put the card back to disagreeing with the
      // page it links to, which is the bug this whole block exists to
      // fix. If cancelled orders should stop counting, change both
      // together.
      where: { projectId: { in: projectIds } },
      _sum:  { totalValue: true },
    }),
    projectIds.length === 0 ? [] : db.quotation.groupBy({
      by:    ["projectId"],
      // The same three statuses getProjectLedger counts as "quoted".
      where: { projectId: { in: projectIds }, status: { in: ["SENT", "ACCEPTED", "REVISED"] } },
      _sum:  { total: true },
    }),
    resolveClients(db, rows.map((r) => r.clientId)),
  ]);

  const orderedBy = new Map<string, bigint>();
  for (const o of orderSums) {
    if (o.projectId) orderedBy.set(o.projectId, o._sum.totalValue ?? 0n);
  }
  const quotedBy = new Map<string, bigint>();
  for (const q2 of quoteSums) {
    if (q2.projectId) quotedBy.set(q2.projectId, q2._sum.total ?? 0n);
  }

  return {
    rows: rows.map((r) => {
      const done  = r.milestones.filter((m) => m.status === "COMPLETED").length;
      const total = r.milestones.length;
      const next  = r.milestones.find((m) => m.status !== "COMPLETED") ?? null;
      const ordered = orderedBy.get(r.id) ?? 0n;
      const quoted  = quotedBy.get(r.id)  ?? 0n;
      return {
        id: r.id, number: r.number, name: r.name, stage: r.stage,
        clientId: r.clientId, clientName: clientMap.get(r.clientId)?.name ?? UNKNOWN_CLIENT,
        orderValue: ordered > 0n ? ordered : quoted > 0n ? quoted : r.orderValue,
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

export interface ProjectSelectOption { id: string; name: string; number: string }

export async function listProjectsForSelect(
  ctx: RequestContext,
): Promise<ProjectSelectOption[]> {
  requirePermission(ctx, "project.view");
  const db = scoped(ctx);
  return db.project.findMany({
    select: { id: true, name: true, number: true },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
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
      clientId: true,
    },
  });
  if (!row) return null;

  const client = await resolveClient(db, row.clientId);

  return {
    id: row.id, number: row.number, name: row.name, stage: row.stage,
    clientId: row.clientId,
    clientName: client?.name ?? UNKNOWN_CLIENT,
    clientMobile: client?.mobile ?? "",
    branchId: row.branchId, ownerId: row.ownerId,
    siteAddress: row.siteAddress as Record<string, unknown> | null,
    siteContactName: row.siteContactName,
    siteContactMobile: row.siteContactMobile,
    expectedInstallAt: row.expectedInstallAt,
    orderValue: row.orderValue,
    createdAt: row.createdAt,
  };
}

export * from "./queries-detail";
export * from "./queries-quotations";

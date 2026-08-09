// Project profitability — §14 Phase 6 gate #4.
//
// The gate is specific: "profitability reconciles to the stock and
// expense ledgers to the paisa." That gates the COSTS, not revenue.
// Two cost lines are reconciled:
//
//   materialCost = SUM(MaterialIssue.quantity × rate) for the project.
//                  Reversals are represented by negative quantity in
//                  the schema (see the comment on MaterialIssue.
//                  quantity), so the same SUM naturally cancels them.
//                  Don't add a `reversedAt IS NULL` filter — that
//                  would double-book.
//
//   expenses     = SUM(ProjectExpense.amount WHERE status='APPROVED').
//                  Only APPROVED counts against margin; SUBMITTED /
//                  REJECTED are pending or excluded.
//
// Revenue + commissions are HEURISTICS (client-level, project date
// window). The schema has no Order↔Project link today, so these are
// the best approximation and the UI tags them accordingly. They are
// NOT gated against the ledgers.
//
// Labour is skipped this session — no labour-rate infrastructure
// exists. Follow-up when payroll lands in Phase 7.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface ProjectProfitability {
  projectId:    string;
  projectNumber: string;
  projectName:  string;
  clientName:   string;
  status:       string;
  startDate:    Date;
  endDate:      Date | null;
  // ── reconciled to ledgers (paise) ────────────────────────────
  materialCost: bigint;
  expenses:     bigint;
  // ── heuristics (paise) ──────────────────────────────────────
  revenue:      bigint;
  commissions:  bigint;
  // ── derived ─────────────────────────────────────────────────
  totalCost:    bigint;   // materialCost + expenses + commissions (excludes labour)
  netMargin:    bigint;   // revenue − totalCost
  marginPct:    number;   // netMargin / revenue as a %, 0 if revenue=0
}

// Reads for a single project. The two reconciled sums use
// Prisma's aggregate() so the same query shape is trivially
// re-executable by the smoke for cross-check.
export async function computeProjectProfitability(
  ctx: RequestContext, projectId: string,
): Promise<ProjectProfitability | null> {
  requirePermission(ctx, "report.view.projects");
  const db = scoped(ctx);

  const proj = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true, number: true, name: true, status: true,
      startDate: true, actualEndDate: true, targetEndDate: true,
      clientId: true,
      client: { select: { name: true } },
    },
  });
  if (!proj) return null;

  const [materialCost, expenses, revenue, commissions] = await Promise.all([
    sumMaterialCost(ctx, projectId),
    sumApprovedExpenses(ctx, projectId),
    sumHeuristicRevenue(ctx, {
      clientId: proj.clientId,
      startDate: proj.startDate,
      endDate: proj.actualEndDate,
    }),
    sumHeuristicCommissions(ctx, {
      clientId: proj.clientId,
      startDate: proj.startDate,
      endDate: proj.actualEndDate,
    }),
  ]);

  const totalCost = materialCost + expenses + commissions;
  const netMargin = revenue - totalCost;
  const marginPct = revenue === 0n
    ? 0
    : Number((netMargin * 10_000n) / revenue) / 100;

  return {
    projectId:     proj.id,
    projectNumber: proj.number,
    projectName:   proj.name,
    clientName:    proj.client.name,
    status:        proj.status,
    startDate:     proj.startDate,
    endDate:       proj.actualEndDate,
    materialCost, expenses, revenue, commissions,
    totalCost, netMargin, marginPct,
  };
}

// ── Reconciled cost aggregators ─────────────────────────────────

/**
 * materialCost = SUM(quantity × rate) across MaterialIssue rows for
 * this project. Reversals ride as negative quantity — they cancel
 * automatically. Uses $queryRaw because Prisma's `aggregate` can't
 * express a product across two columns in one round-trip.
 *
 * Exported so the reconciliation smoke can call the same helper.
 */
export async function sumMaterialCost(
  ctx: RequestContext, projectId: string,
): Promise<bigint> {
  const db = scoped(ctx);
  // Sanity-scope by projectId belonging to this org via the ORM
  // (raw SQL bypasses the scope extension).
  const proj = await db.project.findUnique({
    where:  { id: projectId }, select: { id: true },
  });
  if (!proj) return 0n;

  const row = await db.$queryRaw<{ total: bigint | null }[]>`
    SELECT COALESCE(SUM(quantity * rate)::bigint, 0)::bigint AS total
      FROM "MaterialIssue"
     WHERE "projectId" = ${projectId}
  `;
  return row[0]?.total ?? 0n;
}

/** expenses = SUM(amount) across APPROVED ProjectExpense for this project. */
export async function sumApprovedExpenses(
  ctx: RequestContext, projectId: string,
): Promise<bigint> {
  const db = scoped(ctx);
  const agg = await db.projectExpense.aggregate({
    where: { projectId, status: "APPROVED" },
    _sum:  { amount: true },
  });
  return agg._sum.amount ?? 0n;
}

// ── Heuristic aggregators (revenue + commissions) ──────────────

interface WindowArgs {
  clientId:  string;
  startDate: Date;
  endDate:   Date | null;
}

async function sumHeuristicRevenue(ctx: RequestContext, w: WindowArgs): Promise<bigint> {
  const db = scoped(ctx);
  const end = w.endDate ?? new Date();
  const agg = await db.invoice.aggregate({
    where: {
      clientId: w.clientId,
      status:   { not: "CANCELLED" },
      date:     { gte: w.startDate, lte: end },
    },
    _sum: { total: true },
  });
  return agg._sum.total ?? 0n;
}

async function sumHeuristicCommissions(ctx: RequestContext, w: WindowArgs): Promise<bigint> {
  const db = scoped(ctx);
  const end = w.endDate ?? new Date();
  const agg = await db.architectCommission.aggregate({
    where: {
      cancelledAt: null,
      salesOrder: {
        clientId: w.clientId,
        date:     { gte: w.startDate, lte: end },
      },
    },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0n;
}

// ── List for the /reports/profitability page ────────────────────

export interface ProjectProfitabilityRow {
  projectId:    string;
  projectNumber: string;
  projectName:  string;
  clientName:   string;
  status:       string;
  materialCost: bigint;
  expenses:     bigint;
  revenue:      bigint;
  netMargin:    bigint;
  marginPct:    number;
}

export async function listProjectProfitability(
  ctx: RequestContext,
): Promise<ProjectProfitabilityRow[]> {
  requirePermission(ctx, "report.view.projects");
  const db = scoped(ctx);

  const projects = await db.project.findMany({
    orderBy: { startDate: "desc" },
    take:    100,
    select: {
      id: true, number: true, name: true, status: true,
      startDate: true, actualEndDate: true, clientId: true,
      client: { select: { name: true } },
    },
  });

  // Per-project rollup fanned out. Not the tightest N+1 story but
  // 100-project page load with 4 aggregates each stays well under a
  // second in practice — profile if this becomes a hot page.
  const rows = await Promise.all(projects.map(async (p) => {
    const [materialCost, expenses, revenue] = await Promise.all([
      sumMaterialCost(ctx, p.id),
      sumApprovedExpenses(ctx, p.id),
      sumHeuristicRevenue(ctx, {
        clientId: p.clientId, startDate: p.startDate, endDate: p.actualEndDate,
      }),
    ]);
    const netMargin = revenue - materialCost - expenses;
    const marginPct = revenue === 0n
      ? 0
      : Number((netMargin * 10_000n) / revenue) / 100;
    return {
      projectId:     p.id,
      projectNumber: p.number,
      projectName:   p.name,
      clientName:    p.client.name,
      status:        p.status,
      materialCost, expenses, revenue, netMargin, marginPct,
    };
  }));

  return rows;
}

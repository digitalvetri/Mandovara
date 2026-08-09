import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface ProjectExpenseRow {
  id:            string;
  projectId:     string;
  projectName:   string;
  head:          string;
  description:   string;
  amount:        bigint;
  incurredAt:    Date;
  approvalState: string;
  billKey:       string | null;
}

export interface ListProjectExpensesQuery {
  projectId?:     string;
  approvalState?: string;
  page?:          number;
  pageSize?:      number;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE     = 100;

export async function listProjectExpenses(
  ctx: RequestContext,
  q: ListProjectExpensesQuery,
): Promise<{ rows: ProjectExpenseRow[]; total: number; page: number; pageSize: number }> {
  requirePermission(ctx, "expense.view");
  const db       = scoped(ctx);
  const pageSize = Math.min(q.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const page     = Math.max(1, q.page ?? 1);
  const skip     = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (q.projectId)     where["projectId"]     = q.projectId;
  if (q.approvalState) where["approvalState"] = q.approvalState;

  const [expenses, total] = await Promise.all([
    db.projectExpense.findMany({
      where, skip, take: pageSize, orderBy: { incurredAt: "desc" },
      select: {
        id: true, projectId: true, head: true, description: true,
        amount: true, incurredAt: true, approvalState: true, billKey: true,
      },
    }),
    db.projectExpense.count({ where }),
  ]);

  if (expenses.length === 0) return { rows: [], total, page, pageSize };

  const projectIds = [...new Set(expenses.map((e) => e.projectId))];
  const projects   = await db.project.findMany({
    where: { id: { in: projectIds } },
    select: { id: true, name: true },
  });
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const rows: ProjectExpenseRow[] = expenses.map((e) => ({
    id: e.id, projectId: e.projectId,
    projectName: projectMap.get(e.projectId)?.name ?? "—",
    head: e.head, description: e.description,
    amount: e.amount, incurredAt: e.incurredAt,
    approvalState: e.approvalState, billKey: e.billKey,
  }));

  return { rows, total, page, pageSize };
}

/** Sum of approved project expenses for a given project — used in profitability. */
export async function sumProjectExpenses(
  ctx: RequestContext,
  projectId: string,
): Promise<bigint> {
  requirePermission(ctx, "expense.view");
  const db  = scoped(ctx);
  const agg = await db.projectExpense.aggregate({
    where: { projectId, approvalState: "APPROVED" },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0n;
}

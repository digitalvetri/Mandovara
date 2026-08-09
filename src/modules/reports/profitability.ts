// Project profitability — reads the actual ledgers, never derives from columns.
//
// Revenue       = Σ Invoice.taxableAmount (ex-GST; GST is passthrough)
// Material COGS = Σ StockMove quantity×rate where projectId=P
//                 ISSUE_TO_MAKE | ISSUE_TO_SITE → add
//                 RETURN_TO_STOCK → subtract
//                 (quantity always positive; type gives direction — §5 schema comment)
// Expenses      = Σ ProjectExpense.amount (APPROVED only)
// Commission    = Σ ArchitectCommission.amount
// Margin        = Revenue − COGS − Expenses − Commission
//
// quantity is Decimal(12,3), rate is BigInt paise.
// Multiply in Decimal, round half-up once, convert to BigInt — never Number×Number.

import { Decimal } from "@prisma/client/runtime/library";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface ProjectProfitability {
  projectId:         string;
  revenue:           bigint;   // taxable invoice total (ex-GST)
  materialCogs:      bigint;   // net stock cost (issues − returns)
  expensesTotal:     bigint;   // approved project expenses
  commissionTotal:   bigint;   // architect commissions
  grossMargin:       bigint;   // revenue − all costs
  grossMarginPct:    string;   // "42.50" — empty string when revenue = 0
  invoiceCount:      number;
  stockMoveCount:    number;
  expenseCount:      number;
}

const COST_TYPES    = new Set(["ISSUE_TO_MAKE", "ISSUE_TO_SITE"]);
const RETURN_TYPES  = new Set(["RETURN_TO_STOCK"]);

function moveCostPaise(qty: Decimal, ratePaise: bigint): bigint {
  // Decimal × string(BigInt) — stays in Decimal arithmetic until the final integer
  return BigInt(
    new Decimal(ratePaise.toString()).mul(qty).toDecimalPlaces(0).toString(),
  );
}

export async function getProjectProfitability(
  ctx: RequestContext,
  projectId: string,
): Promise<ProjectProfitability> {
  requirePermission(ctx, "report.view.projects");
  const db = scoped(ctx);

  const [invoices, stockMoves, expenses, commissions] = await Promise.all([
    db.invoice.findMany({
      where: { organizationId: ctx.orgId, projectId, status: { not: "CANCELLED" } },
      select: { id: true, taxableAmount: true },
    }),
    db.stockMove.findMany({
      where: { organizationId: ctx.orgId, projectId },
      select: { id: true, type: true, quantity: true, rate: true },
    }),
    db.projectExpense.findMany({
      where: { organizationId: ctx.orgId, projectId, approvalState: "APPROVED" },
      select: { id: true, amount: true },
    }),
    db.architectCommission.findMany({
      where: { organizationId: ctx.orgId, projectId },
      select: { id: true, amount: true },
    }),
  ]);

  const revenue = invoices.reduce((s, i) => s + i.taxableAmount, 0n);

  let materialCogs = 0n;
  for (const m of stockMoves) {
    const cost = moveCostPaise(m.quantity, m.rate);
    if (COST_TYPES.has(m.type))   materialCogs += cost;
    if (RETURN_TYPES.has(m.type)) materialCogs -= cost;
  }
  if (materialCogs < 0n) materialCogs = 0n; // clamp — net returns can't exceed issues

  const expensesTotal   = expenses.reduce((s, e) => s + e.amount, 0n);
  const commissionTotal = commissions.reduce((s, c) => s + c.amount, 0n);
  const grossMargin     = revenue - materialCogs - expensesTotal - commissionTotal;

  let grossMarginPct = "";
  if (revenue > 0n) {
    grossMarginPct = new Decimal(grossMargin.toString())
      .div(revenue.toString())
      .mul(100)
      .toDecimalPlaces(2)
      .toString();
  }

  return {
    projectId,
    revenue,
    materialCogs,
    expensesTotal,
    commissionTotal,
    grossMargin,
    grossMarginPct,
    invoiceCount:    invoices.length,
    stockMoveCount:  stockMoves.length,
    expenseCount:    expenses.length,
  };
}

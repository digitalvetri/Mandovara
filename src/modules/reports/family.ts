// Family-wise margin report.
// Revenue: Σ InvoiceLine.taxable where invoice is not CANCELLED, resolved to ProductFamily via
//          InvoiceLine → OrderLine → OrderLine.colourwayId → Colourway → Design.family
// COGS:    Σ StockMove.quantity × rate where type = ISSUE_TO_MAKE | ISSUE_TO_SITE,
//          resolved to ProductFamily the same way.
// Lines without a resolvable colourway are grouped as "SERVICE".

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import { Decimal } from "@prisma/client/runtime/library";

export interface FamilyMarginRow {
  family:     string;
  revenue:    bigint;
  cogs:       bigint;
  margin:     bigint;
  marginPct:  string;  // "42.50" — empty when revenue = 0
}


export async function listFamilyMarginReport(ctx: RequestContext): Promise<FamilyMarginRow[]> {
  requirePermission(ctx, "report.view.projects");
  const db = scoped(ctx);

  // ── Revenue via InvoiceLine → OrderLine → Colourway → Design ─────────────
  const [invoiceLines, orderLines, stockMoves, colourways] = await Promise.all([
    db.invoiceLine.findMany({
      where: {
        organizationId: ctx.orgId,
        invoice: { status: { not: "CANCELLED" } },
      },
      select: { orderLineId: true, taxable: true },
    }),
    db.orderLine.findMany({
      where:  { organizationId: ctx.orgId, colourwayId: { not: null } },
      select: { id: true, colourwayId: true },
    }),
    db.stockMove.findMany({
      where:  { organizationId: ctx.orgId, type: { in: ["ISSUE_TO_MAKE", "ISSUE_TO_SITE"] } },
      select: { colourwayId: true, quantity: true, rate: true },
    }),
    db.colourway.findMany({
      where:  { organizationId: ctx.orgId },
      select: { id: true, design: { select: { family: true } } },
    }),
  ]);

  // colourwayId → family
  const familyByColourway = new Map<string, string>();
  for (const cw of colourways) familyByColourway.set(cw.id, cw.design.family);

  // orderLineId → colourwayId
  const colourwayByOrder = new Map<string, string>();
  for (const ol of orderLines) {
    if (ol.colourwayId) colourwayByOrder.set(ol.id, ol.colourwayId);
  }

  // Revenue by family
  const revenueByFamily = new Map<string, bigint>();
  for (const il of invoiceLines) {
    const cwId  = il.orderLineId ? colourwayByOrder.get(il.orderLineId) : undefined;
    const fam   = cwId ? (familyByColourway.get(cwId) ?? "SERVICE") : "SERVICE";
    revenueByFamily.set(fam, (revenueByFamily.get(fam) ?? 0n) + il.taxable);
  }

  // COGS by family (all stockMoves already filtered to ISSUE_TO_MAKE | ISSUE_TO_SITE)
  const cogsByFamily = new Map<string, bigint>();
  for (const sm of stockMoves) {
    const fam  = familyByColourway.get(sm.colourwayId) ?? "SERVICE";
    const cost = BigInt(
      new Decimal(sm.rate.toString()).mul(sm.quantity).toDecimalPlaces(0).toString(),
    );
    cogsByFamily.set(fam, (cogsByFamily.get(fam) ?? 0n) + cost);
  }

  // Merge all known families
  const allFamilies = new Set([...revenueByFamily.keys(), ...cogsByFamily.keys()]);

  return [...allFamilies]
    .sort()
    .map((fam) => {
      const revenue = revenueByFamily.get(fam) ?? 0n;
      const cogs    = cogsByFamily.get(fam) ?? 0n;
      const margin  = revenue - cogs;
      const pct     = revenue > 0n
        ? new Decimal(margin.toString()).div(revenue.toString()).mul(100).toDecimalPlaces(2).toString()
        : "";
      return { family: fam, revenue, cogs, margin, marginPct: pct };
    });
}

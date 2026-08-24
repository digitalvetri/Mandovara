"use server";

// Issue material from stock against an order line — the "use stock first"
// half of the owner's procurement mental model. Wraps kernel/inventory/issue.
// The PO half remains the existing /purchase flow.

import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { issueStock } from "@/kernel/inventory/issue";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

interface IssueParams {
  orderLineId: string;
  qty:         number;  // decimal from the form; validated below
}

export async function issueMaterialFromStock(
  input: IssueParams,
): Promise<ActionResult<{ issued: string }>> {
  const ctx = await devContext();
  // Same permission as the existing kernel/inventory issue helper — this
  // action is the project-scoped wrapper around it.
  requirePermission(ctx, "project.materialIssue");

  if (!input?.orderLineId) return { ok: false, error: "Missing order line" };
  if (!Number.isFinite(input.qty) || input.qty <= 0) {
    return { ok: false, error: "Quantity must be greater than zero" };
  }

  const db = scoped(ctx);
  const line = await db.orderLine.findUnique({
    where:  { id: input.orderLineId },
    select: {
      id: true, orderId: true, colourwayId: true, rate: true,
      quantity: true, procuredQty: true,
      order: { select: { projectId: true } },
    },
  });
  if (!line) return { ok: false, error: "Order line not found" };
  if (!line.colourwayId) {
    return { ok: false, error: "This line has no catalogue item — cannot issue from stock." };
  }

  const stillNeeded = Number(line.quantity.toString()) - Number(line.procuredQty.toString());
  if (input.qty > stillNeeded + 1e-6) {
    return { ok: false, error: `Only ${stillNeeded.toFixed(3)} still needed on this line.` };
  }

  // Pick the largest-available lot for this colourway. Simpler than the old
  // Allocation console — the owner asked for "just take from stock", and
  // dye-lot reservation was removed 19 Aug 2026 (§0.6).
  const lots = await db.stockBalance.findMany({
    where:   { colourwayId: line.colourwayId, quantity: { gt: 0 } },
    orderBy: { quantity: "desc" },
    select:  { dyeLot: true, quantity: true, reserved: true },
  });
  if (lots.length === 0) {
    return { ok: false, error: "No stock available for this colourway." };
  }

  // Consume from lots largest-first until we've covered the requested qty.
  let remaining = new Decimal(input.qty.toString());
  const plan: { dyeLot: string | null; take: Decimal }[] = [];
  for (const lot of lots) {
    const avail = new Decimal(lot.quantity.toString()).minus(new Decimal(lot.reserved.toString()));
    if (avail.lte(0)) continue;
    const take = Decimal.min(avail, remaining);
    if (take.lte(0)) continue;
    plan.push({ dyeLot: lot.dyeLot, take });
    remaining = remaining.minus(take);
    if (remaining.lte(0)) break;
  }
  if (remaining.gt(0)) {
    return { ok: false, error: `Only ${(input.qty - remaining.toNumber()).toFixed(3)} available in stock — short by ${remaining.toString()}.` };
  }

  try {
    await withTransaction(async (tx: TxClient) => {
      for (const step of plan) {
        await issueStock(tx, {
          organizationId: ctx.orgId,
          colourwayId:    line.colourwayId!,
          dyeLot:         step.dyeLot,
          quantity:       step.take,
          rate:           line.rate,
          type:           "ISSUE_TO_MAKE",
          refType:        "ORDER",
          refId:          line.id,
          createdById:    ctx.userId,
          occurredAt:     new Date(),
        });
      }
      await tx.orderLine.update({
        where: { id: line.id },
        data:  { procuredQty: { increment: new Decimal(input.qty.toString()) } },
      });
    }, { orgId: ctx.orgId });
  } catch (err) {
    console.error("issueMaterialFromStock failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to issue stock",
    };
  }

  const projectId = line.order.projectId;
  revalidatePath(`/projects/${projectId}/procurement`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/inventory");

  return { ok: true, data: { issued: input.qty.toFixed(3) } };
}

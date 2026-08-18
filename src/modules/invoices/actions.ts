"use server";

import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { allocateNumber, yymmFromDate } from "@/kernel/numbering/series";
import { devContext } from "@/lib/dev-context";
import { createInvoiceSchema } from "./schema";
import { zodError } from "./actions-part2-util";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}


export async function createInvoice(
  input: unknown,
): Promise<ActionResult<{ id: string; number: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "invoice.create");

  const parsed = createInvoiceSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);

  // Validate order exists and is not cancelled
  const order = await db.order.findUnique({
    where: { id: d.orderId },
    select: { id: true, projectId: true, clientId: true, status: true },
  });
  if (!order) return { ok: false, error: "Order not found." };
  if (order.status === "CANCELLED") return { ok: false, error: "Cannot invoice a cancelled order." };

  // Fetch branch for invoice prefix
  const branch = await db.branch.findUnique({
    where: { id: d.branchId },
    select: { invoicePrefix: true },
  });
  if (!branch) return { ok: false, error: "Branch not found." };

  // Compute totals from provided lines
  const lines = d.lines.map((l) => ({
    ...l,
    rateBig:    BigInt(l.rate),
    taxableBig: BigInt(l.taxable),
    cgstBig:    BigInt(l.cgst),
    sgstBig:    BigInt(l.sgst),
    igstBig:    BigInt(l.igst),
    amountBig:  BigInt(l.amount),
    quantityDec: new Decimal(l.quantity),
    gstRateDec:  new Decimal(l.gstRate),
  }));

  const taxableAmount = lines.reduce((s, l) => s + l.taxableBig, 0n);
  const cgstTotal     = lines.reduce((s, l) => s + l.cgstBig, 0n);
  const sgstTotal     = lines.reduce((s, l) => s + l.sgstBig, 0n);
  const igstTotal     = lines.reduce((s, l) => s + l.igstBig, 0n);
  const lineTotal     = lines.reduce((s, l) => s + l.amountBig, 0n);
  const computedTotal = taxableAmount + cgstTotal + sgstTotal + igstTotal;
  const roundOff      = lineTotal - computedTotal;  // typically ±50 paise

  const total = lineTotal;

  // Apply pending advances for this project (oldest first)
  let advanceAdjusted = 0n;
  if (order.projectId) {
    const advances = await db.advance.findMany({
      where: { organizationId: ctx.orgId, projectId: order.projectId },
      orderBy: { receivedAt: "asc" },
      select: { id: true, amount: true, adjusted: true },
    });
    let remaining = total;
    for (const adv of advances) {
      if (remaining <= 0n) break;
      const available = adv.amount - adv.adjusted;
      if (available <= 0n) continue;
      const apply = available < remaining ? available : remaining;
      advanceAdjusted += apply;
      remaining -= apply;
    }
  }

  const invoiceDate = new Date(d.date);
  const yymm        = yymmFromDate(invoiceDate);

  // Compute status: PAID if fully covered by advances, else ISSUED
  const outstanding0 = total - advanceAdjusted;
  const initialStatus = outstanding0 <= 0n ? "PAID" : "ISSUED";

  const created = await withTransaction(async (tx: TxClient) => {
    // Allocate number inside the transaction (gap-free)
    const number = await allocateNumber(tx, {
      orgId:  ctx.orgId,
      series: "INV",
      yymm,
      prefix: branch.invoicePrefix,
    });

    const inv = await tx.invoice.create({
      data: {
        organizationId:    ctx.orgId,
        branchId:          d.branchId,
        number,
        type:              d.type,
        clientId:          order.clientId,
        orderId:           d.orderId,
        projectId:         order.projectId,
        date:              invoiceDate,
        dueDate:           new Date(d.dueDate),
        placeOfSupplyCode: d.placeOfSupplyCode,
        taxableAmount,
        cgst:              cgstTotal,
        sgst:              sgstTotal,
        igst:              igstTotal,
        roundOff,
        total,
        advanceAdjusted,
        status:            initialStatus,
        irnStatus:         "NOT_REQUIRED",
      },
      select: { id: true, number: true },
    });

    await tx.invoiceLine.createMany({
      data: d.lines.map((l, i) => ({
        organizationId: ctx.orgId,
        invoiceId:      inv.id,
        lineNo:         i + 1,
        orderLineId:    l.orderLineId ?? null,
        description:    l.description,
        hsn:            l.hsn,
        quantity:       new Decimal(l.quantity),
        unit:           l.unit,
        rate:           BigInt(l.rate),
        taxable:        BigInt(l.taxable),
        gstRate:        new Decimal(l.gstRate),
        cgst:           BigInt(l.cgst),
        sgst:           BigInt(l.sgst),
        igst:           BigInt(l.igst),
        amount:         BigInt(l.amount),
      })),
    });

    // Distribute advance adjustments — update Advance.adjusted inside tx
    if (order.projectId && advanceAdjusted > 0n) {
      const advances = await tx.advance.findMany({
        where: { organizationId: ctx.orgId, projectId: order.projectId },
        orderBy: { receivedAt: "asc" },
        select: { id: true, amount: true, adjusted: true },
      });
      let toDistribute = advanceAdjusted;
      for (const adv of advances) {
        if (toDistribute <= 0n) break;
        const available = adv.amount - adv.adjusted;
        if (available <= 0n) continue;
        const apply = available < toDistribute ? available : toDistribute;
        await tx.advance.update({
          where: { id: adv.id },
          data:  { adjusted: adv.adjusted + apply },
        });
        toDistribute -= apply;
      }
    }

    return inv;
  }, { orgId: ctx.orgId });

  revalidatePath("/invoicing");
  if (order.projectId) revalidatePath(`/projects/${order.projectId}`);
  return { ok: true, data: created };
}

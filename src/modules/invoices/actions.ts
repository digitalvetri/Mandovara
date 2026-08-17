"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { allocateNumber, yymmFromDate } from "@/kernel/numbering/series";
import { computeLineTax } from "@/kernel/tax/gst";
import { devContext } from "@/lib/dev-context";
import { createInvoiceSchema, cancelInvoiceSchema } from "./schema";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

const CANCEL_WINDOW_HOURS = 24;

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

export async function cancelInvoice(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "invoice.cancel");

  const parsed = cancelInvoiceSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id, reason } = parsed.data;

  const db  = scoped(ctx);
  const inv = await db.invoice.findUnique({
    where: { id },
    select: { id: true, status: true, date: true, number: true, total: true, advanceAdjusted: true },
  });
  if (!inv) return { ok: false, error: "Invoice not found." };
  if (inv.status === "CANCELLED") return { ok: false, error: "Invoice is already cancelled." };

  const allocationSum = await db.receiptAllocation.aggregate({
    where: { invoiceId: id },
    _sum: { amount: true },
  });
  const paid = allocationSum._sum.amount ?? 0n;
  if (paid > 0n) {
    return { ok: false, error: "Payments have been received. Reverse the receipts before cancelling." };
  }

  // 24-hour cancellation window (from invoice date, not creation timestamp — no createdAt on Invoice)
  const ageHours = (Date.now() - inv.date.getTime()) / 3_600_000;
  if (ageHours > CANCEL_WINDOW_HOURS) {
    return {
      ok: false,
      error: `Cancellation window closed (${CANCEL_WINDOW_HOURS}h). Issue a credit note against ${inv.number} instead.`,
    };
  }

  await db.invoice.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason },
  });

  revalidatePath("/invoicing");
  revalidatePath(`/invoicing/${id}`);
  return { ok: true, data: { id } };
}

/** One-click "Create invoice from order" — auto-derives lines from order data. */
export async function createInvoiceFromOrder(
  input: { salesOrderId: string },
): Promise<ActionResult<{ id: string; number: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "invoice.create");
  const db = scoped(ctx);

  const order = await db.order.findUnique({
    where: { id: input.salesOrderId },
    select: {
      id: true, branchId: true, projectId: true, clientId: true,
      number: true, status: true, totalValue: true,
      lines: {
        orderBy: { lineNo: "asc" },
        select: {
          id: true, description: true,
          quantity: true, unit: true,
          rate: true, amount: true, colourwayId: true,
        },
      },
    },
  });
  if (!order) return { ok: false, error: "Order not found." };
  if (order.status === "CANCELLED") return { ok: false, error: "Cannot invoice a cancelled order." };

  // Determine supply codes for correct CGST/SGST vs IGST routing
  const [branch, client] = await Promise.all([
    db.branch.findUnique({ where: { id: order.branchId }, select: { stateCode: true } }),
    db.client.findUnique({ where: { id: order.clientId }, select: { billingAddress: true } }),
  ]);
  const supplierStateCode = branch?.stateCode ?? "33";
  const billingAddr       = client?.billingAddress as Record<string, string> | null | undefined;
  const placeOfSupplyCode = (billingAddr?.stateCode ?? supplierStateCode) as string;

  // Fetch HSN + gstRate from designs for each colourway
  const colourwayIds = order.lines.filter((l) => l.colourwayId).map((l) => l.colourwayId!);
  const hsnMap = new Map<string, { hsn: string; gstRate: string }>();
  if (colourwayIds.length > 0) {
    const cwRows = await db.colourway.findMany({
      where: { id: { in: colourwayIds } },
      select: { id: true, design: { select: { hsn: true, gstRate: true } } },
    });
    for (const cw of cwRows) {
      hsnMap.set(cw.id, { hsn: cw.design.hsn, gstRate: cw.design.gstRate.toString() });
    }
  }

  const now    = new Date();
  const due    = new Date(now.getTime() + 30 * 86_400_000);
  const toDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  type LineInput = {
    orderLineId?: string; description: string; hsn: string;
    quantity: string; unit: string; rate: string; taxable: string;
    gstRate: string; cgst: string; sgst: string; igst: string; amount: string;
  };

  const lines: LineInput[] = order.lines.map((l) => {
    const info       = l.colourwayId ? hsnMap.get(l.colourwayId) : undefined;
    const hsn        = info?.hsn ?? "9987";
    const gstRateStr = info?.gstRate ?? "18";
    const gstRate    = parseFloat(gstRateStr);
    const taxable    = l.amount;
    const tax        = computeLineTax({ taxable, gstRate, supplierStateCode, placeOfSupplyCode });
    return {
      orderLineId: l.id,
      description: l.description,
      hsn,
      quantity: l.quantity.toString(),
      unit:     l.unit as string,
      rate:     l.rate.toString(),
      taxable:  taxable.toString(),
      gstRate:  gstRateStr,
      cgst:     tax.cgst.toString(),
      sgst:     tax.sgst.toString(),
      igst:     tax.igst.toString(),
      amount:   (taxable + tax.cgst + tax.sgst + tax.igst).toString(),
    };
  });

  if (lines.length === 0) {
    const tax = computeLineTax({ taxable: order.totalValue, gstRate: 18, supplierStateCode, placeOfSupplyCode });
    lines.push({
      description: `As per Order ${order.number}`,
      hsn: "9987", quantity: "1.000", unit: "PIECE",
      rate: order.totalValue.toString(), taxable: order.totalValue.toString(),
      gstRate: "18",
      cgst: tax.cgst.toString(), sgst: tax.sgst.toString(), igst: tax.igst.toString(),
      amount: (order.totalValue + tax.cgst + tax.sgst + tax.igst).toString(),
    });
  }

  return createInvoice({
    orderId: order.id, branchId: order.branchId,
    type: "TAX", date: toDate(now), dueDate: toDate(due),
    placeOfSupplyCode, lines,
  });
}

// ── helpers ─────────────────────────────────────────────────────────────────

function zodError<T = unknown>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path
      .filter((s): s is string | number => typeof s === "string" || typeof s === "number")
      .join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}

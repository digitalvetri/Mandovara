"use server";

// Split out of actions.ts to stay under the §10 300-line limit.


import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { computeLineTax } from "@/kernel/tax/gst";
import { devContext } from "@/lib/dev-context";
import { cancelInvoiceSchema } from "./schema";
import { ActionResult, createInvoice } from "./actions";
import { CANCEL_WINDOW_HOURS } from "./actions-util";
import { zodError } from "./actions-part2-util";

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

  // One active TAX invoice per order — block the common case before the DB
  // constraint fires (better error message; DB index handles the race).
  const existingCount = await db.invoice.count({
    where: { orderId: order.id, status: { not: "CANCELLED" }, type: "TAX" },
  });
  if (existingCount > 0) {
    return { ok: false, error: "An invoice already exists for this order. View it in the Invoicing module." };
  }

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


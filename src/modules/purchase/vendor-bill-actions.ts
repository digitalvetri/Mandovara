"use server";

import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { allocateNumber, yymmFromDate } from "@/kernel/numbering/series";
import { devContext } from "@/lib/dev-context";
import { calcBillLine, calcBillTotals } from "@/lib/calc/vendor-bill";
import type { ActionResult } from "./actions";
import { GST_RATES, SELL_UNITS } from "./schema";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/);

const vbLineInput = z.object({
  colourwayId: z.string().optional(),
  description: z.string().min(1),
  quantity:    z.string(),    // Decimal string from GRN
  unit:        z.enum(SELL_UNITS),
  ratePaise:   z.string().regex(/^\d+$/, "Invalid rate"),  // BigInt paise string
  gstRate:     z.number().int().refine((v) => (GST_RATES as readonly number[]).includes(v), "Invalid GST rate"),
  lineNo:      z.number().int().positive(),
});

const createVendorBillSchema = z.object({
  purchaseOrderId:   z.string().min(1),
  grnId:             z.string().min(1),
  vendorInvoiceNo:   z.string().trim().max(80).optional().or(z.literal("")),
  vendorInvoiceDate: isoDate.optional().or(z.literal("")),
  billDate:          isoDate,
  lines:             z.array(vbLineInput).min(1),
});

const approveVendorBillSchema = z.object({ id: z.string().min(1) });

// ── Create ──────────────────────────────────────────────────────────────────

export async function createVendorBill(
  input: unknown,
): Promise<ActionResult<{ id: string; number: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "po.create");

  const parsed = createVendorBillSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);

  // Verify PO exists and has been at least partially received
  const po = await db.purchaseOrder.findUnique({
    where:  { id: d.purchaseOrderId },
    select: { status: true, vendorId: true },
  });
  if (!po) return { ok: false, error: "Purchase order not found" };
  const billableStatuses = ["PARTIAL", "RECEIVED", "CANCELLED"] as string[];
  if (!billableStatuses.includes(po.status)) {
    return { ok: false, error: "Can only raise a bill against received goods" };
  }

  // Guard: no active bill already exists for this GRN
  const existing = await db.vendorBill.findFirst({
    where:  { grnId: d.grnId, purchaseOrderId: d.purchaseOrderId, status: { not: "CANCELLED" } },
    select: { id: true },
  });
  if (existing) return { ok: false, error: "A bill already exists for this goods receipt" };

  // Get vendor details for GSTIN
  const vendor = await db.vendor.findUnique({
    where:  { id: po.vendorId },
    select: { gstin: true },
  });

  // Compute per-line amounts
  const lineCalcs = d.lines.map((l) => {
    const ratePaise      = BigInt(l.ratePaise);
    const quantityScaled = BigInt(Math.round(parseFloat(l.quantity) * 10_000));
    return calcBillLine(ratePaise, quantityScaled, l.gstRate);
  });
  const totals = calcBillTotals(lineCalcs);

  // Get prefix from branch
  const branch = await db.branch.findFirst({
    where:   { organizationId: ctx.orgId },
    orderBy: { name: "asc" },
    select:  { invoicePrefix: true },
  });
  const prefix = branch?.invoicePrefix ?? "MDV";

  const billDate = new Date(d.billDate);

  const created = await withTransaction(async (tx: TxClient) => {
    const number = await allocateNumber(tx, {
      orgId:  ctx.orgId,
      series: "VB",
      yymm:   yymmFromDate(billDate),
      prefix,
    });
    const bill = await tx.vendorBill.create({
      data: {
        organizationId:   ctx.orgId,
        number,
        vendorId:         po.vendorId,
        purchaseOrderId:  d.purchaseOrderId,
        grnId:            d.grnId,
        vendorInvoiceNo:  d.vendorInvoiceNo  || null,
        vendorInvoiceDate: d.vendorInvoiceDate ? new Date(d.vendorInvoiceDate) : null,
        billDate,
        status:           "DRAFT",
        taxableAmount:    totals.taxableAmount,
        cgst:             totals.cgst,
        sgst:             totals.sgst,
        igst:             totals.igst,
        roundOff:         totals.roundOff,
        total:            totals.total,
        vendorGstin:      vendor?.gstin ?? null,
      },
      select: { id: true, number: true },
    });

    const billLineData = d.lines.map((l, i) => {
      const calc = lineCalcs[i] ?? { taxable: 0n, cgst: 0n, sgst: 0n, lineTotal: 0n };
      return {
        organizationId: ctx.orgId,
        vendorBillId:   bill.id,
        lineNo:         l.lineNo,
        colourwayId:    l.colourwayId ?? null,
        description:    l.description,
        quantity:       new Decimal(l.quantity),
        unit:           l.unit,
        rate:           BigInt(l.ratePaise),
        gstRate:        new Decimal(l.gstRate),
        taxable:        calc.taxable,
        cgst:           calc.cgst,
        sgst:           calc.sgst,
        igst:           0n,
        amount:         calc.lineTotal,
      };
    });
    await tx.vendorBillLine.createMany({ data: billLineData });

    return bill;
  }, { orgId: ctx.orgId });

  revalidatePath(`/purchase/${d.purchaseOrderId}`);
  return { ok: true, data: created };
}

// ── Approve ─────────────────────────────────────────────────────────────────

export async function approveVendorBill(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "po.approve");

  const parsed = approveVendorBillSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id } = parsed.data;

  const db   = scoped(ctx);
  const bill = await db.vendorBill.findUnique({
    where:  { id },
    select: { status: true, purchaseOrderId: true },
  });
  if (!bill) return { ok: false, error: "Vendor bill not found" };
  if (bill.status !== "DRAFT") return { ok: false, error: "Only draft bills can be approved" };

  await db.vendorBill.update({ where: { id }, data: { status: "APPROVED" } });

  if (bill.purchaseOrderId) revalidatePath(`/purchase/${bill.purchaseOrderId}`);
  return { ok: true, data: { id } };
}

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

"use server";

// Invoice a project straight from its quotation.
//
// Owner, 2026-08-30: "i dont want to create another quotation, just
// rough estimation quoatation is enough and then i want to directly able
// to create the Invoice ... i dont want to follow a flow i just want to
// do anythings whenever i need".
//
// The chain being cut short here was: quotation → accepted → order →
// invoice. That sequence is correct for a studio that runs formal sales
// orders, and it is why "No projects ready to invoice" appeared on a
// project that plainly had a quotation on it. This studio does not work
// that way; it quotes roughly, gets paid, and bills.
//
// What is NOT given up:
//
//   · The invoice still carries real lines, taxed line by line through
//     the same computeLineTax the order path uses. It is a tax document,
//     not a total with a number on it.
//   · Advance consumption, gap-free numbering, place-of-supply routing
//     and the CGST/SGST-vs-IGST decision all still happen, because this
//     hands off to the same createInvoice as before.
//   · An order-derived invoice still behaves exactly as it did. This is
//     an additional door, not a replacement.
//
// Invoice.orderId was already nullable, so an order-less invoice has
// always been storable. Nothing could create one.

import { z } from "zod";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { computeLineTax } from "@/kernel/tax/gst";
import { createInvoice } from "./actions";

export interface ActionResult<T = unknown> {
  ok: boolean; data?: T; error?: string;
}

const schema = z.object({ quotationId: z.string().trim().min(1) });

function toDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function createInvoiceFromQuotation(
  input: unknown,
): Promise<ActionResult<{ id: string; number: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "invoice.create");

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const db = scoped(ctx);
  const q = await db.quotation.findUnique({
    where: { id: parsed.data.quotationId },
    select: {
      id: true, number: true, status: true, branchId: true,
      projectId: true, clientId: true,
      lines: {
        orderBy: { lineNo: "asc" },
        select: {
          description: true, quantity: true, unit: true, rate: true,
          discountPct: true, taxable: true, gstRate: true,
        },
      },
    },
  });
  if (!q) return { ok: false, error: "Quotation not found." };
  if (q.status === "REJECTED") {
    return { ok: false, error: "This quotation was rejected — revise it before invoicing." };
  }
  if (!q.clientId) {
    return {
      ok: false,
      error: "This quotation belongs to a lead. Convert the lead to a client first, then invoice.",
    };
  }
  if (q.lines.length === 0) {
    return { ok: false, error: "This quotation has no lines to invoice." };
  }

  // Same routing rule as the order path: the client's billing state
  // decides CGST+SGST versus IGST, falling back to the branch's own.
  const [branch, client] = await Promise.all([
    db.branch.findUnique({ where: { id: q.branchId }, select: { stateCode: true } }),
    db.client.findUnique({ where: { id: q.clientId }, select: { billingAddress: true } }),
  ]);
  const supplierStateCode = branch?.stateCode ?? "33";
  const billing = client?.billingAddress as Record<string, string> | null | undefined;
  const placeOfSupplyCode = billing?.["stateCode"] ?? supplierStateCode;

  const lines = q.lines.map((l) => {
    // QuotationLine.taxable is already net of its discount, which is the
    // figure the client agreed to. Recomputing from rate × qty here would
    // quietly bill more than the quotation said.
    const taxable = l.taxable;
    const gstRate = parseFloat(l.gstRate.toString());
    const tax = computeLineTax({ taxable, gstRate, supplierStateCode, placeOfSupplyCode });
    return {
      description: l.description,
      hsn:      "9987",
      quantity: l.quantity.toString(),
      unit:     l.unit as string,
      rate:     l.rate.toString(),
      taxable:  taxable.toString(),
      gstRate:  l.gstRate.toString(),
      cgst:     tax.cgst.toString(),
      sgst:     tax.sgst.toString(),
      igst:     tax.igst.toString(),
      amount:   (taxable + tax.cgst + tax.sgst + tax.igst).toString(),
    };
  });

  const now = new Date();
  const due = new Date(now.getTime() + 30 * 86_400_000);

  return createInvoice({
    // No orderId: this invoice descends from the quotation directly.
    ...(q.projectId ? { projectId: q.projectId } : {}),
    clientId: q.clientId,
    branchId: q.branchId,
    type: "TAX",
    date: toDate(now),
    dueDate: toDate(due),
    placeOfSupplyCode,
    lines,
  });
}

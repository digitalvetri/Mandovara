"use server";

// Writing an invoice by hand.
//
// Owner, 2026-08-30: "i create invoice based on the Quotation i want to
// create invoice by myself".
//
// The quotation route stays — it is the fast path when the quote is
// right — but it decided the lines for you, and an invoice is not always
// the quotation. Work gets added, a rate is agreed on site, a deposit is
// billed on its own. This takes whatever lines the owner types.
//
// Everything downstream is unchanged: tax per line through the same
// computeLineTax, the same place-of-supply routing, the same advance
// consumption and gap-free numbering, because it hands off to the same
// createInvoice.

import { z } from "zod";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { computeLineTax } from "@/kernel/tax/gst";
import { SELL_UNITS } from "@/modules/quotations/schema";
import { createInvoice } from "./actions";

export interface ActionResult<T = unknown> {
  ok: boolean; data?: T; error?: string;
}

const lineSchema = z.object({
  description: z.string().trim().min(1, "Every line needs an item name.").max(300),
  unit:        z.enum(SELL_UNITS),
  /** Free text so "2.5" and "0.75" work; parsed below. */
  quantity:    z.string().trim().min(1),
  /** Rupees as typed. Converted to paise here — the one conversion point. */
  rate:        z.string().trim().min(1),
  gstRate:     z.number().min(0).max(28),
});

const schema = z.object({
  projectId: z.string().trim().min(1),
  date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lines:     z.array(lineSchema).min(1, "Add at least one line."),
});

/** Rupees typed by a human → paise, without floating-point drift. */
function toPaise(rupees: string): bigint {
  const cleaned = rupees.replace(/[,\s₹]/g, "");
  const [whole = "0", frac = ""] = cleaned.split(".");
  const paise = (frac + "00").slice(0, 2);
  const sign = whole.startsWith("-") ? -1n : 1n;
  const w = BigInt(whole.replace("-", "") || "0");
  return sign * (w * 100n + BigInt(paise || "0"));
}

export async function createManualInvoice(
  input: unknown,
): Promise<ActionResult<{ id: string; number: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "invoice.create");

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the invoice lines." };
  }
  const d = parsed.data;

  const db = scoped(ctx);
  const project = await db.project.findUnique({
    where:  { id: d.projectId },
    select: { id: true, branchId: true, clientId: true },
  });
  if (!project) return { ok: false, error: "Project not found." };

  const [branch, client] = await Promise.all([
    db.branch.findUnique({ where: { id: project.branchId }, select: { stateCode: true } }),
    db.client.findUnique({ where: { id: project.clientId }, select: { billingAddress: true } }),
  ]);
  const supplierStateCode = branch?.stateCode ?? "33";
  const billing = client?.billingAddress as Record<string, string> | null | undefined;
  const placeOfSupplyCode = billing?.["stateCode"] ?? supplierStateCode;

  const lines = [];
  for (const l of d.lines) {
    const qty = parseFloat(l.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return { ok: false, error: `"${l.description}" needs a quantity greater than zero.` };
    }
    const ratePaise = toPaise(l.rate);
    if (ratePaise <= 0n) {
      return { ok: false, error: `"${l.description}" needs a rate greater than zero.` };
    }

    // Fixed-point: quantity to 4 decimals, so 2.5 × ₹1,099 is exact
    // rather than a float that lands a paisa out.
    const qtyFixed = BigInt(Math.round(qty * 10_000));
    const taxable  = (ratePaise * qtyFixed) / 10_000n;
    const tax = computeLineTax({
      taxable, gstRate: l.gstRate, supplierStateCode, placeOfSupplyCode,
    });

    lines.push({
      description: l.description,
      hsn:      "9987",
      quantity: qty.toFixed(3),
      unit:     l.unit as string,
      rate:     ratePaise.toString(),
      taxable:  taxable.toString(),
      gstRate:  String(l.gstRate),
      cgst:     tax.cgst.toString(),
      sgst:     tax.sgst.toString(),
      igst:     tax.igst.toString(),
      amount:   (taxable + tax.cgst + tax.sgst + tax.igst).toString(),
    });
  }

  return createInvoice({
    projectId: project.id,
    clientId:  project.clientId,
    branchId:  project.branchId,
    type: "TAX",
    date: d.date,
    dueDate: d.dueDate,
    placeOfSupplyCode,
    lines,
  });
}

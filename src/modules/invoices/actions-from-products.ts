"use server";

// Invoice-first flow (2026-08-26 owner redesign): compose the existing
// quotation → order → invoice pipeline into a single server action so
// the project page can offer a "Create invoice" wizard without ever
// surfacing the word "quotation" to the owner.
//
// This does NOT bypass the existing chain — under the hood a firm quote
// and order are still created (preserving stock reservations, GST
// calculation, numbering, milestone auto-completion). The wrapper just
// runs them back-to-back and returns the resulting invoice id.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { createQuotation } from "@/modules/quotations/actions";
import { setQuotationStatus } from "@/modules/quotations/actions-part2";
import { createInvoiceFromOrder } from "@/modules/invoices/actions-part2";
import type { ActionResult } from "@/modules/quotations/actions";

const lineSchema = z.object({
  colourwayId:       z.string().min(1).optional(),
  serviceRateId:     z.string().min(1).optional(),
  measurementItemId: z.string().min(1).optional(),
  description:       z.string().trim().min(1).max(500),
  quantity:          z.number().positive(),
  unit:              z.string().min(1),
  rate:              z.string().trim().min(1),
  gstRate:           z.number().min(0).max(28),
}).refine((l) => l.colourwayId || l.serviceRateId, {
  message: "Each line needs a colourway or a service",
  path: ["colourwayId"],
});

const inputSchema = z.object({
  projectId: z.string().min(1),
  lines:     z.array(lineSchema).min(1, "Add at least one product"),
});

export async function createInvoiceFromProducts(
  input: unknown,
): Promise<ActionResult<{ invoiceId: string; invoiceNumber: string }>> {
  const ctx = await devContext();
  // The wrapper composes four permission-gated sub-actions. Assert the
  // caller can perform each up-front — a role with only some of the
  // perms would otherwise fail mid-saga leaving a stranded DRAFT quote
  // in the DB, invisible to the owner (QuotationPanel is hidden).
  requirePermission(ctx, "quotation.create");
  requirePermission(ctx, "quotation.send");
  requirePermission(ctx, "quotation.update");
  requirePermission(ctx, "invoice.create");

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return { ok: false, error: firstIssue?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const db = scoped(ctx);
  const project = await db.project.findUnique({
    where:  { id: d.projectId },
    select: { id: true, branchId: true, clientId: true },
  });
  if (!project) return { ok: false, error: "Project not found" };

  const [branch, client] = await Promise.all([
    db.branch.findUnique({ where: { id: project.branchId }, select: { stateCode: true } }),
    db.client.findUnique({ where: { id: project.clientId }, select: { billingAddress: true } }),
  ]);
  const supplierStateCode = branch?.stateCode ?? "33";
  const billingAddr       = client?.billingAddress as Record<string, string> | null | undefined;
  const placeOfSupplyCode = billingAddr?.stateCode ?? supplierStateCode;

  const today = new Date();
  const validUntil = new Date(today);
  validUntil.setDate(validUntil.getDate() + 30);

  // Step 1: create the firm quote as DRAFT. Bypass the measurement
  // gate — the owner entered quantity directly in the wizard and
  // doesn't want site-measurement forced as a prerequisite here.
  const quoteRes = await createQuotation({
    projectId:         project.id,
    branchId:          project.branchId,
    date:              today.toISOString().slice(0, 10),
    validUntil:        validUntil.toISOString().slice(0, 10),
    placeOfSupplyCode,
    bypassMeasurementGate: true,
    lines: d.lines.map((l) => ({
      colourwayId:       l.colourwayId,
      serviceRateId:     l.serviceRateId,
      measurementItemId: l.measurementItemId,
      description:       l.description,
      quantity:          l.quantity,
      unit:              l.unit,
      rate:              l.rate,
      gstRate:           l.gstRate,
    })),
  });
  if (!quoteRes.ok || !quoteRes.data) {
    return {
      ok:         false,
      error:      quoteRes.error ?? "Could not create the invoice",
      errorCode:  quoteRes.errorCode,
      fieldErrors: quoteRes.fieldErrors,
    };
  }
  const quoteId = quoteRes.data.id;

  // Step 2: accept the quote. setQuotationStatus rejects DRAFT →
  // ACCEPTED in one hop (see VALID_TRANSITIONS in actions-part2.ts).
  // The shortest legal walk is DRAFT → SENT → ACCEPTED. Each hop only
  // writes the bookkeeping fields for that state; sending to ACCEPTED
  // fires the listener that auto-creates the Order row.
  for (const step of ["SENT", "ACCEPTED"] as const) {
    const r = await setQuotationStatus({ id: quoteId, status: step });
    if (!r.ok) {
      return {
        ok:    false,
        error: `Created quote but couldn't accept it (${step}): ${r.error ?? "unknown"}`,
      };
    }
  }

  // Step 3: the accepted-status listener best-efforts createOrderFromQuotation,
  // so the Order row should already exist. Fetch it and invoice against it.
  const order = await db.order.findFirst({
    where:  { quotationId: quoteId },
    select: { id: true },
  });
  if (!order) {
    return { ok: false, error: "Quote was accepted but the order didn't materialize — check server logs." };
  }

  const invoiceRes = await createInvoiceFromOrder({ salesOrderId: order.id });
  if (!invoiceRes.ok || !invoiceRes.data) {
    return { ok: false, error: invoiceRes.error ?? "Could not raise the invoice from the order" };
  }

  revalidatePath(`/projects/${project.id}`);
  return {
    ok:   true,
    data: { invoiceId: invoiceRes.data.id, invoiceNumber: invoiceRes.data.number },
  };
}

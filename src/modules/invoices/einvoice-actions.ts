"use server";

// e-Invoice (IRN) server actions — the thin DB-facing layer over
// src/kernel/einvoice, which holds all the policy and is 100% branch covered.
//
// §14 Phase 6: async, retryable, and billing keeps working with the GSP down.
// Nothing here can prevent an invoice being issued — the worst outcome is that
// the invoice is left PENDING for the retry worker.

import { revalidatePath } from "next/cache";
import { devContext } from "@/lib/dev-context";
import { requirePermission } from "@/kernel/rbac/guard";
import { orgPrisma } from "@/kernel/db/rls";
import { getGspClient, isEInvoicingConfigured } from "@/kernel/einvoice/gsp";
import { submitForIrn, canCancelIrn } from "@/kernel/einvoice/submit";
import type { EInvoiceSource } from "@/kernel/einvoice/types";

export interface ActionResult<T = unknown> {
  ok: boolean; data?: T; error?: string;
}

function addr(json: unknown): { line: string; city: string; pincode: string } {
  const o = (json ?? {}) as Record<string, unknown>;
  return {
    line:    typeof o["line"] === "string" ? o["line"] : String(o["addressLine"] ?? ""),
    city:    typeof o["city"] === "string" ? o["city"] : "Coimbatore",
    pincode: typeof o["pincode"] === "string" ? o["pincode"] : "641002",
  };
}

/** Register an invoice for an IRN. Safe to call repeatedly. */
export async function generateIrn(invoiceId: string): Promise<ActionResult<{ status: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "invoice.create");
  const db = orgPrisma(ctx.orgId);

  const inv = await db.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true, number: true, date: true, placeOfSupplyCode: true,
      taxableAmount: true, cgst: true, sgst: true, igst: true,
      roundOff: true, total: true, irnStatus: true, clientId: true,
      lines: {
        select: {
          description: true, hsn: true, quantity: true, unit: true, rate: true,
          taxable: true, gstRate: true, cgst: true, sgst: true, igst: true, amount: true,
        },
      },
    },
  });
  if (!inv) return { ok: false, error: "Invoice not found" };
  if (inv.irnStatus === "GENERATED") return { ok: true, data: { status: "GENERATED" } };

  // Invoice has no `client` relation in the schema — only clientId.
  const client = await db.client.findUnique({
    where: { id: inv.clientId },
    select: { name: true, gstin: true, billingAddress: true, stateCode: true },
  });
  if (!client) return { ok: false, error: "Client not found" };

  const org = await db.organization.findUnique({
    where: { id: ctx.orgId },
    select: { legalName: true, name: true, gstin: true, addressLine: true, city: true, pincode: true, stateCode: true },
  });
  if (!org) return { ok: false, error: "Organisation not found" };

  const clientAddr = addr(client.billingAddress);
  const src: EInvoiceSource = {
    number: inv.number, date: inv.date, placeOfSupplyCode: inv.placeOfSupplyCode,
    taxableAmount: inv.taxableAmount, cgst: inv.cgst, sgst: inv.sgst, igst: inv.igst,
    roundOff: inv.roundOff, total: inv.total,
    seller: {
      gstin: org.gstin, legalName: org.legalName ?? org.name,
      address: org.addressLine ?? "", city: org.city ?? "Coimbatore",
      pincode: org.pincode ?? "641002", stateCode: org.stateCode,
    },
    buyer: {
      gstin: client.gstin, name: client.name,
      address: clientAddr.line, city: clientAddr.city,
      pincode: clientAddr.pincode, stateCode: client.stateCode,
    },
    lines: inv.lines.map((l) => ({
      description: l.description, hsn: l.hsn, quantity: Number(l.quantity),
      unit: l.unit, rate: l.rate, taxable: l.taxable, gstRate: Number(l.gstRate),
      cgst: l.cgst, sgst: l.sgst, igst: l.igst, amount: l.amount,
    })),
  };

  const outcome = await submitForIrn(src, getGspClient());

  await db.invoice.update({
    where: { id: invoiceId },
    data: {
      irnStatus: outcome.status,
      irnError:  outcome.error ?? null,
      ...(outcome.result && {
        irn:     outcome.result.irn,
        ackNo:   outcome.result.ackNo,
        ackDate: outcome.result.ackDate,
        qrCode:  outcome.result.qrCode,
        ewbNumber:     outcome.result.ewbNumber ?? null,
        ewbValidUntil: outcome.result.ewbValidUntil ?? null,
      }),
    },
  });

  revalidatePath(`/invoicing/${invoiceId}`);
  return outcome.status === "FAILED"
    ? { ok: false, error: outcome.error ?? "e-invoice registration failed" }
    : { ok: true, data: { status: outcome.status } };
}

/** Cancel an IRN, subject to the portal's 24-hour rule. */
export async function cancelIrn(
  invoiceId: string, reason: string, remark: string,
): Promise<ActionResult<null>> {
  const ctx = await devContext();
  requirePermission(ctx, "invoice.cancel");
  const db = orgPrisma(ctx.orgId);

  const inv = await db.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, irn: true, irnStatus: true, ackDate: true },
  });
  if (!inv) return { ok: false, error: "Invoice not found" };

  const check = canCancelIrn(
    { irnStatus: inv.irnStatus as "GENERATED", ackDate: inv.ackDate }, new Date(),
  );
  if (!check.allowed) return { ok: false, error: check.reason ?? "Cannot cancel this e-invoice." };

  try {
    await getGspClient().cancel(inv.irn!, reason, remark);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  await db.invoice.update({
    where: { id: invoiceId },
    data: { irnStatus: "CANCELLED", cancelledAt: new Date(), cancelReason: remark },
  });
  revalidatePath(`/invoicing/${invoiceId}`);
  return { ok: true, data: null };
}

/** Whether the UI should offer e-invoicing at all. */
export async function eInvoicingEnabled(): Promise<boolean> {
  return isEInvoicingConfigured();
}

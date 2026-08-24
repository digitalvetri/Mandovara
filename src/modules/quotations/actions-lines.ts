"use server";

// Quotation line editing and colourway append. Split out of actions.ts,
// which had grown to 708 lines (§10 limit is 300).

import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { computeLineTax, applyLineDiscount, computeDocumentTotals } from "@/kernel/tax/gst";
import { devContext } from "@/lib/dev-context";
import "@/kernel/events/register";
import { zodError } from "./lib";
import type { ActionResult } from "./actions";

// ── helpers ──────────────────────────────────────────────────────────────────


// FIXES-01 §7.3 — one-shot "add this SKU to an existing draft quote"
// action for the PDP's Add-to-Quote modal. Recomputes the quote's
// totals in the same transaction as the line insert.
export async function appendColourwayToQuotation(
  input: unknown,
): Promise<ActionResult<{ quotationId: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "quotation.update");

  const parsed = z.object({
    quotationId: z.string().min(1),
    colourwayId: z.string().min(1),
    quantity:    z.number().positive().max(999).optional(),
  }).safeParse(input);
  if (!parsed.success) return zodError<{ quotationId: string }>(parsed.error);
  const { quotationId, colourwayId, quantity = 1 } = parsed.data;

  const db = scoped(ctx);
  const q = await db.quotation.findUnique({
    where:  { id: quotationId },
    select: {
      id: true, status: true, branchId: true, clientId: true,
      lines: { select: { lineNo: true, taxable: true, gstRate: true } },
    },
  });
  if (!q) return { ok: false, error: "Quotation not found" };
  if (!["DRAFT", "REVISED"].includes(q.status)) {
    return { ok: false, error: `Only DRAFT quotations can be appended to (this one is ${q.status}).` };
  }

  const cw = await db.colourway.findUnique({
    where:  { id: colourwayId },
    select: {
      id: true, code: true, colourName: true, sellUnit: true,
      design: { select: { name: true, family: true, gstRate: true } },
      prices: {
        where:   { tier: "MRP" },
        orderBy: { effectiveFrom: "desc" },
        take:    1,
        select:  { amount: true },
      },
    },
  });
  if (!cw) return { ok: false, error: "Colourway not found" };

  const [branch, client] = await Promise.all([
    db.branch.findUniqueOrThrow({ where: { id: q.branchId }, select: { stateCode: true } }),
    q.clientId
      ? db.client.findUnique({ where: { id: q.clientId }, select: { stateCode: true } })
      : Promise.resolve(null),
  ]);

  const ratePaise = cw.prices[0]?.amount ?? 0n;
  const qtyFixed  = BigInt(Math.round(quantity * 10_000));
  const grossPaise = (ratePaise * qtyFixed) / 10_000n;
  const { taxable } = applyLineDiscount(grossPaise, 0);
  const gstRate = Number(cw.design.gstRate);
  // Use the client's stateCode as place of supply — correctly splits CGST/SGST
  // for intra-state vs IGST for inter-state quotes.
  const supplyState = client?.stateCode ?? branch.stateCode;
  const tax = computeLineTax({
    taxable,
    gstRate,
    supplierStateCode: branch.stateCode,
    placeOfSupplyCode: supplyState,
  });
  const nextLineNo = (q.lines.reduce((m, l) => Math.max(m, l.lineNo), 0)) + 1;

  try {
    await withTransaction(async (tx: TxClient) => {
      await tx.quotationLine.create({
        data: {
          organizationId: ctx.orgId,
          quotationId,
          lineNo:         nextLineNo,
          colourwayId,
          description:    `${cw.design.name} — ${cw.colourName}`,
          quantity:       new Decimal(quantity),
          unit:           cw.sellUnit,
          rate:           ratePaise,
          discountPct:    new Decimal(0),
          taxable,
          gstRate:        new Decimal(gstRate),
          cgst:           tax.cgst,
          sgst:           tax.sgst,
          igst:           tax.igst,
          amount:         taxable + tax.cgst + tax.sgst + tax.igst,
          isOptional:     false,
        },
      });
      // Rebuild document totals from every line (existing + new).
      const allLines = [
        ...q.lines.map((l) => ({ taxable: l.taxable, gstRate: Number(l.gstRate) })),
        { taxable, gstRate },
      ];
      const totals = computeDocumentTotals(allLines, {
        supplierStateCode: branch.stateCode,
        placeOfSupplyCode: supplyState,
      });
      await tx.quotation.update({
        where: { id: quotationId },
        data:  {
          taxableAmount: totals.taxableAmount,
          cgst:          totals.cgst,
          sgst:          totals.sgst,
          igst:          totals.igst,
          roundOff:      totals.roundOff,
          total:         totals.total,
        },
      });
    }, { orgId: ctx.orgId });

    revalidatePath(`/quotations/${quotationId}`);
    return { ok: true, data: { quotationId } };
  } catch (e: unknown) {
    console.error("appendColourwayToQuotation failed:", e);
    return {
      ok:    false,
      error: e instanceof Error ? `Could not add to quote: ${e.message}` : "Could not add to quote",
    };
  }
}

// FIXES-01 §5.1 — owner sign-off to convert a lead-scoped quotation
// into a real Client + Project. Gate 2 of the two-approval flow (gate 1
// is `Quotation.status = ACCEPTED`, i.e. client acceptance recorded).
// Toggleable — passing `revoke: true` clears the approval if the owner
// changes their mind before conversion runs.
export async function approveQuotationForConversion(
  input: unknown,
): Promise<ActionResult<{ id: string; approved: boolean }>> {
  const ctx = await devContext();
  requirePermission(ctx, "lead.convert");

  const parsed = z.object({
    id:     z.string().min(1),
    revoke: z.boolean().optional(),
  }).safeParse(input);
  if (!parsed.success) return zodError<{ id: string; approved: boolean }>(parsed.error);
  const { id, revoke } = parsed.data;

  const db = scoped(ctx);
  const q = await db.quotation.findUnique({
    where:  { id },
    select: { id: true, status: true, leadId: true, ownerConvertApprovedAt: true },
  });
  if (!q) return { ok: false, error: "Quotation not found" };
  if (!q.leadId) {
    return { ok: false, error: "Only lead-scoped quotations need conversion approval." };
  }
  if (!revoke && q.status !== "ACCEPTED") {
    return { ok: false, error: `Quote must be ACCEPTED before owner approval (currently ${q.status}).` };
  }

  await db.quotation.update({
    where: { id },
    data:  revoke
      ? { ownerConvertApprovedAt: null, ownerConvertApprovedById: null }
      : { ownerConvertApprovedAt: new Date(), ownerConvertApprovedById: ctx.userId },
  });

  revalidatePath(`/quotations/${id}`);
  if (q.leadId) revalidatePath(`/leads/${q.leadId}`);
  return { ok: true, data: { id, approved: !revoke } };
}

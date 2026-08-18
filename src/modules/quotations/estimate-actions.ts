"use server";

// Free-text estimate builder.
//
// Why this exists: every existing path forced a catalog pick. /quotations/new
// needs a project, and the quick builder requires a colourway plus width and
// height on every line. Neither fits "someone enquired through the website and
// I want to send them a formal price today".
//
// The server already supported this — quotationLineInput has an optional
// colourwayId — so this is the missing surface, not a new capability. GST,
// numbering and totals reuse the same kernels as a full quotation, so an
// estimate is a real Quotation row and can be revised into a measured quote
// later without re-keying.
//
// §15.1 is untouched: the gate blocks a CATALOG made-to-measure line with no
// MeasurementItem. A line written in words carries no family to gate on, so it
// is instead marked ESTIMATE on screen and on the PDF (see isEstimate).

import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { parseINR } from "@/kernel/money/format";
import { computeLineTax, applyLineDiscount, computeDocumentTotals } from "@/kernel/tax/gst";
import { allocateNumber, yymmFromDate } from "@/kernel/numbering/series";
import { devContext } from "@/lib/dev-context";
import { createEstimateSchema } from "./estimate-schemas";
import { zodError } from "./lib";
import type { ActionResult } from "./actions";

export async function createEstimate(
  input: unknown,
): Promise<ActionResult<{ quotationId: string; number: string; leadId: string | null }>> {
  const ctx = await devContext();
  requirePermission(ctx, "quotation.create");

  const parsed = createEstimateSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const branch = await db.branch.findUnique({
    where:  { id: d.branchId },
    select: { id: true, invoicePrefix: true, stateCode: true },
  });
  if (!branch) return { ok: false, error: "Branch not found" };

  // An estimate is intra-state unless the recipient says otherwise; a website
  // enquiry has no GSTIN yet, so place of supply defaults to the branch.
  const supplierStateCode = branch.stateCode;
  const placeOfSupplyCode = supplierStateCode;

  const computed = d.lines.map((line, i) => {
    const ratePaise = parseINR(line.rate);
    const qtyFixed  = BigInt(Math.round(line.quantity * 10_000));
    const gross     = (ratePaise * qtyFixed) / 10_000n;
    const { taxable } = applyLineDiscount(gross, line.discountPct);
    const tax = computeLineTax({ taxable, gstRate: line.gstRate, supplierStateCode, placeOfSupplyCode });
    return {
      input: line, lineNo: i + 1, ratePaise, taxable,
      cgst: tax.cgst, sgst: tax.sgst, igst: tax.igst,
      amount: taxable + tax.cgst + tax.sgst + tax.igst,
    };
  });

  const totals = computeDocumentTotals(
    computed.map((l) => ({ taxable: l.taxable, gstRate: l.input.gstRate })),
    { supplierStateCode, placeOfSupplyCode },
  );

  const now = new Date();
  const validUntil = new Date(now);
  validUntil.setDate(now.getDate() + d.validForDays);

  try {
    const result = await withTransaction(async (tx: TxClient) => {
      // A brand-new enquirer becomes a Lead — the Quotation table requires a
      // lead XOR a client, so there is no anonymous recipient.
      let leadId = d.leadId ?? null;
      if (d.newLead) {
        const enqNumber = await allocateNumber(tx, {
          orgId: ctx.orgId, series: "ENQ", yymm: yymmFromDate(now), prefix: branch.invoicePrefix,
        });
        const lead = await tx.lead.create({
          data: {
            organizationId: ctx.orgId,
            number:  enqNumber,
            name:    d.newLead.name,
            mobile:  d.newLead.mobile,
            email:   d.newLead.email?.trim() || null,
            source:  "WEBSITE",
            stage:   "QUOTED",
            requirement: d.newLead.requirement?.trim() || null,
            familiesInterested: [],
            ownerId: ctx.userId,
          },
          select: { id: true },
        });
        leadId = lead.id;
      }

      const number = await allocateNumber(tx, {
        orgId: ctx.orgId, series: "QT", yymm: yymmFromDate(now), prefix: branch.invoicePrefix,
      });

      const q = await tx.quotation.create({
        data: {
          organizationId: ctx.orgId,
          branchId:       branch.id,
          number,
          revision:       0,
          leadId,
          clientId:       d.clientId ?? null,
          projectId:      null,
          date:           now,
          validUntil,
          status:         "DRAFT",
          taxableAmount:  totals.taxableAmount,
          cgst:           totals.cgst,
          sgst:           totals.sgst,
          igst:           totals.igst,
          roundOff:       totals.roundOff,
          total:          totals.total,
          ownerId:        ctx.userId,
          termsText:      (d.termsText ?? "").trim() || null,
        },
        select: { id: true, number: true },
      });

      await tx.quotationLine.createMany({
        data: computed.map((l) => ({
          organizationId:    ctx.orgId,
          quotationId:       q.id,
          lineNo:            l.lineNo,
          // No colourway, no measurement — this is what makes it an estimate.
          measurementItemId: null,
          colourwayId:       null,
          serviceRateId:     null,
          description:       l.input.description,
          quantity:          new Decimal(l.input.quantity),
          unit:              l.input.unit,
          rate:              l.ratePaise,
          discountPct:       new Decimal(l.input.discountPct),
          taxable:           l.taxable,
          gstRate:           new Decimal(l.input.gstRate),
          cgst:              l.cgst,
          sgst:              l.sgst,
          igst:              l.igst,
          amount:            l.amount,
        })),
      });

      return { quotationId: q.id, number: q.number, leadId };
    }, { orgId: ctx.orgId });

    revalidatePath("/quotations");
    if (result.leadId) revalidatePath(`/leads/${result.leadId}`);
    return { ok: true, data: result };
  } catch (e) {
    console.error("[quotations] createEstimate failed:", e);
    return { ok: false, error: "Could not create the estimate. Please try again." };
  }
}

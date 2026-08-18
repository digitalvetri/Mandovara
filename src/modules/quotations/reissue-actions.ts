"use server";

// Reissue an ESTIMATE as a firm, measured quotation.
//
// The loop this closes: a website enquiry gets a same-day ballpark
// (/quotations/estimate), the lead converts — which already re-links the
// estimate onto the new client and project — you measure the site, and then
// this turns the ballpark into a real quotation without re-keying anything.
//
// The new document is revision N+1 of the SAME quotation number, so the
// client sees a continuous history rather than an unrelated second quote, and
// the estimate is marked REVISED rather than deleted.
//
// Every generated line carries a measurementItemId, which is what makes it
// firm: it satisfies §15.1 by construction and drops the ESTIMATE badge,
// because isEstimate() is derived from exactly that field.

import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { computeLineTax, applyLineDiscount, computeDocumentTotals } from "@/kernel/tax/gst";
import { devContext } from "@/lib/dev-context";
import { reissueSchema, canReissue, measuredLineDescription } from "./reissue-schemas";
import { isEstimate, zodError } from "./lib";
import type { ActionResult } from "./actions";

/** revalidatePath throws outside a request scope (tests, scripts). The write
 *  has already committed by then, so never let that surface as a failure. */
function revalidate(paths: string[]): void {
  for (const p of paths) {
    try { revalidatePath(p); } catch { /* not in a request scope */ }
  }
}

export async function reissueAsFirmQuotation(
  input: unknown,
): Promise<ActionResult<{ quotationId: string; revision: number; lines: number }>> {
  const ctx = await devContext();
  requirePermission(ctx, "quotation.create");

  const parsed = reissueSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const db = scoped(ctx);
  const src = await db.quotation.findUnique({
    where: { id: parsed.data.quotationId },
    select: {
      id: true, number: true, revision: true, branchId: true, clientId: true, status: true,
      projectId: true, termsText: true, validUntil: true, discountPct: true,
      lines: { select: { measurementItemId: true, rate: true, gstRate: true } },
    },
  });
  if (!src) return { ok: false, error: "Quotation not found" };

  const branch = await db.branch.findUnique({
    where: { id: src.branchId }, select: { stateCode: true, id: true },
  });
  if (!branch) return { ok: false, error: "Branch not found" };

  // Approved rounds only — an unapproved measurement is not something to
  // price against (§5 MeasurementStatus).
  const items = src.projectId
    ? await db.measurementItem.findMany({
        where: {
          room: { projectId: src.projectId },
          measurement: { status: "APPROVED" },
        },
        select: {
          id: true, label: true, family: true, quantity: true,
          room: { select: { name: true } },
          calc: { select: { materialQty: true, materialUnit: true, colourwayId: true } },
        },
        orderBy: { id: "asc" },
      })
    : [];

  const pre = canReissue({
    isEstimate: isEstimate(src.lines),
    projectId: src.projectId,
    approvedMeasurementItems: items.length,
    status: src.status,
  });
  if (!pre.ok) return { ok: false, error: pre.reason ?? "Cannot reissue this quotation." };

  // Rate per line: the colourway's price at the client's tier when the item
  // has one, otherwise carry the estimate's own rate forward so the figure the
  // client already saw is preserved rather than silently zeroed.
  const client = src.clientId
    ? await db.client.findUnique({ where: { id: src.clientId }, select: { priceTier: true, stateCode: true } })
    : null;
  const tier = client?.priceTier ?? "RETAIL";
  const fallbackRate    = src.lines[0]?.rate ?? 0n;
  const fallbackGstRate = Number(src.lines[0]?.gstRate ?? 18);

  const colourwayIds = [...new Set(items.map((i) => i.calc?.colourwayId).filter(Boolean))] as string[];
  const prices = colourwayIds.length
    ? await db.price.findMany({
        where: { colourwayId: { in: colourwayIds }, tier },
        select: { colourwayId: true, amount: true },
        orderBy: { effectiveFrom: "desc" },
      })
    : [];
  const priceBy = new Map<string, bigint>();
  for (const p of prices) if (!priceBy.has(p.colourwayId)) priceBy.set(p.colourwayId, p.amount);

  const designs = colourwayIds.length
    ? await db.colourway.findMany({
        where: { id: { in: colourwayIds } },
        select: { id: true, design: { select: { gstRate: true } } },
      })
    : [];
  const gstBy = new Map(designs.map((c) => [c.id, Number(c.design.gstRate)]));

  const supplierStateCode = branch.stateCode;
  const placeOfSupplyCode = client?.stateCode ?? supplierStateCode;

  const computed = items.map((item, i) => {
    const cwId    = item.calc?.colourwayId ?? null;
    const rate    = (cwId ? priceBy.get(cwId) : undefined) ?? fallbackRate;
    const gstRate = (cwId ? gstBy.get(cwId) : undefined) ?? fallbackGstRate;
    // Quantity comes from CalcResult — the engine's number, not a guess.
    const qty     = item.calc ? Number(item.calc.materialQty) : item.quantity;
    const unit    = item.calc?.materialUnit ?? "PIECE";

    const qtyFixed = BigInt(Math.round(qty * 10_000));
    const gross    = (rate * qtyFixed) / 10_000n;
    const { taxable } = applyLineDiscount(gross, 0);
    const tax = computeLineTax({ taxable, gstRate, supplierStateCode, placeOfSupplyCode });
    return {
      lineNo: i + 1,
      measurementItemId: item.id,
      colourwayId: cwId,
      description: measuredLineDescription(item.room.name, item.label, item.family),
      quantity: qty, unit, rate, gstRate,
      taxable, cgst: tax.cgst, sgst: tax.sgst, igst: tax.igst,
      amount: taxable + tax.cgst + tax.sgst + tax.igst,
    };
  });

  const totals = computeDocumentTotals(
    computed.map((l) => ({ taxable: l.taxable, gstRate: l.gstRate })),
    { supplierStateCode, placeOfSupplyCode },
  );

  try {
    const created = await withTransaction(async (tx: TxClient) => {
      const q = await tx.quotation.create({
        data: {
          organizationId: ctx.orgId,
          branchId:       src.branchId,
          // Same number, next revision — one continuous document to the client.
          number:         src.number,
          revision:       src.revision + 1,
          parentId:       src.id,
          clientId:       src.clientId,
          projectId:      src.projectId,
          date:           new Date(),
          validUntil:     src.validUntil,
          status:         "DRAFT",
          taxableAmount:  totals.taxableAmount,
          cgst:           totals.cgst,
          sgst:           totals.sgst,
          igst:           totals.igst,
          roundOff:       totals.roundOff,
          total:          totals.total,
          discountPct:    src.discountPct,
          ownerId:        ctx.userId,
          termsText:      src.termsText,
        },
        select: { id: true, revision: true },
      });

      await tx.quotationLine.createMany({
        data: computed.map((l) => ({
          organizationId:    ctx.orgId,
          quotationId:       q.id,
          lineNo:            l.lineNo,
          measurementItemId: l.measurementItemId,   // ← makes it firm
          colourwayId:       l.colourwayId,
          serviceRateId:     null,
          description:       l.description,
          quantity:          new Decimal(l.quantity),
          unit:              l.unit,
          rate:              l.rate,
          discountPct:       new Decimal(0),
          taxable:           l.taxable,
          gstRate:           new Decimal(l.gstRate),
          cgst:              l.cgst,
          sgst:              l.sgst,
          igst:              l.igst,
          amount:            l.amount,
        })),
      });

      // The estimate is superseded, not deleted — the history is the point.
      await tx.quotation.update({ where: { id: src.id }, data: { status: "REVISED" } });

      return { quotationId: q.id, revision: q.revision, lines: computed.length };
    }, { orgId: ctx.orgId });

    // Cache invalidation happens AFTER the transaction has committed and is
    // deliberately outside the catch: a revalidate failure is not a write
    // failure, and reporting one as the other tells the user their quotation
    // was not created when it was.
    revalidate([
      "/quotations",
      `/quotations/${src.id}`,
      ...(src.projectId ? [`/projects/${src.projectId}`] : []),
    ]);
    return { ok: true, data: created };
  } catch (e) {
    console.error("[quotations] reissueAsFirmQuotation failed:", e);
    return { ok: false, error: "Could not reissue the quotation. Please try again." };
  }
}

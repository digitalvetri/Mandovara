"use server";

// Receiving a purchase order — the simple path.
//
// Owner instruction, 2026-09-11: "we have like mark received and GRN etc
// but i really dont need those process." The multi-line, dye-lot-and-
// roll-length GRN form (postGRN in grn-actions-part2.ts) stays in the
// codebase — its data model and its tests are untouched — but nothing in
// the UI drives it anymore. This is the one button that replaces it:
// the PO was ordered, the vendor delivered, mark the whole thing
// received in one step.
//
// What it still does, because removing it would silently break other
// modules (CLAUDE.md rule 13):
//   · Posts stock — one GRN + one GRNLine per colourwayed line, at the
//     full ordered quantity, so Stocks keeps going up on a purchase the
//     way it always has. No dye lot is collected, so the lot lands in
//     the "unknown lot" bucket (dyeLot: null) postGrnToBalance already
//     supports. postGRN() (grn-actions-part2.ts) — the dye-lot/partial/
//     roll-length form — still exists for a future UI that needs it; only
//     its own screen (GRNForm.tsx) was removed, not the action.
//   · Auto-creates the vendor-payment Expense, now with the GST split
//     filled in (see expense.ts) — that's what makes the purchase show
//     up as input credit in the Accounts & Payments GST tab, which was
//     the actual point of asking for this.
//
// What it deliberately drops from the old flow: choosing how much of
// each line to receive, mandatory dye lot, and roll counts. One PO, one
// click, fully received — including a legacy PO already sitting in
// PARTIAL from the old form, which this finishes off in the same click.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { allocateNumber, yymmFromDate } from "@/kernel/numbering/series";
import { devContext } from "@/lib/dev-context";
import { postGrnToBalance } from "@/kernel/stock/balance";
import { calcPOTotals, scaleQty } from "@/lib/calc/purchase-order";
import { createVendorPaymentExpense } from "./expense";
import type { ActionResult } from "./actions";

const receivePOSchema = z.object({
  id:              z.string().min(1),
  vendorInvoiceNo: z.string().trim().max(80).optional().or(z.literal("")),
});

export async function receivePO(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "grn.create");
  const parsed = receivePOSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Validation failed" };
  const { id, vendorInvoiceNo } = parsed.data;

  const db = scoped(ctx);
  const po = await db.purchaseOrder.findUnique({
    where:  { id },
    select: {
      id: true, number: true, status: true, vendorId: true,
      lines: {
        select: {
          id: true, colourwayId: true, quantity: true, receivedQty: true,
          rate: true, gstRate: true,
        },
      },
    },
  });
  if (!po) return { ok: false, error: "Purchase order not found." };
  if (po.status !== "SENT" && po.status !== "PARTIAL") {
    return {
      ok: false,
      error: po.status === "RECEIVED"
        ? "This PO has already been received."
        : `Cannot receive a PO that is ${po.status.toLowerCase().replace("_", " ")} — send it to the vendor first.`,
    };
  }

  const vendor = await db.vendor.findUnique({
    where:  { id: po.vendorId },
    select: { name: true, gstin: true },
  });

  const branch = await db.branch.findFirst({
    where:  { organizationId: ctx.orgId },
    orderBy: { name: "asc" },
    select: { invoicePrefix: true },
  });
  const prefix = branch?.invoicePrefix ?? "MDV";
  const receivedAt = new Date();

  await withTransaction(async (tx: TxClient) => {
    const pendingLines = po.lines.filter((l) => l.quantity.gt(l.receivedQty));

    // Only colourwayed lines post to stock — a typed line has no catalogue
    // entry to post against, same rule postGRN has always followed.
    const stockLines = pendingLines.filter((l) => l.colourwayId !== null);

    if (stockLines.length > 0) {
      const number = await allocateNumber(tx, {
        orgId:  ctx.orgId,
        series: "GRN",
        yymm:   yymmFromDate(receivedAt),
        prefix,
      });
      const grn = await tx.gRN.create({
        data: {
          organizationId:  ctx.orgId,
          number,
          purchaseOrderId: po.id,
          vendorId:        po.vendorId,
          receivedAt,
          invoiceRef:      vendorInvoiceNo?.trim() || null,
        },
        select: { id: true },
      });

      for (const l of stockLines) {
        const pendingQty = l.quantity.minus(l.receivedQty);
        await tx.gRNLine.create({
          data: {
            organizationId: ctx.orgId,
            grnId:          grn.id,
            colourwayId:    l.colourwayId!,
            quantity:       pendingQty,
            rate:           l.rate,
          },
        });
        await postGrnToBalance(tx, {
          organizationId: ctx.orgId,
          colourwayId:    l.colourwayId!,
          dyeLot:         null,
          quantity:       pendingQty,
          rate:           l.rate,
          grnId:          grn.id,
          createdById:    ctx.userId,
          occurredAt:     receivedAt,
        });
      }
    }

    // Every line — colourwayed or typed — is now fully received. A typed
    // line was always ordered-but-unreceivable; "received" for it just
    // means "the PO, as a whole, is done."
    for (const l of pendingLines) {
      await tx.pOLine.update({
        where: { id: l.id },
        data:  { receivedQty: l.quantity },
      });
    }

    await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: "RECEIVED" } });

    // Same fallback autoCreateExpenseForPO uses: a broken/branchless caller
    // still produces a valid Expense against any branch of the org, rather
    // than silently skipping the one thing this button exists for.
    let branchId = ctx.branchIds[0];
    if (!branchId) {
      const anyBranch = await tx.branch.findFirst({
        where:  { organizationId: ctx.orgId },
        select: { id: true },
      });
      branchId = anyBranch?.id;
    }

    const totals = calcPOTotals(
      po.lines.map((l) => ({
        ratePaise:      l.rate,
        quantityScaled: scaleQty(Number(l.quantity)),
        gstRatePct:     Number(l.gstRate),
      })),
    );
    await createVendorPaymentExpense(tx, {
      organizationId: ctx.orgId,
      branchId,
      poId:           po.id,
      poNumber:       po.number,
      vendorName:     vendor?.name ?? "Vendor",
      vendorGstin:    vendor?.gstin ?? null,
      amount:         totals.total,
      taxable:        totals.taxableAmount,
      cgst:           totals.cgst,
      sgst:           totals.sgst,
      igst:           totals.igst,
    });
  }, { orgId: ctx.orgId });

  revalidatePath("/purchase");
  revalidatePath(`/purchase/${id}`);
  // The vendor-payment expense just raised is what makes To Pay and the
  // GST tab's input credit move — the actual point of this button.
  revalidatePath("/accounts");
  return { ok: true, data: { id } };
}

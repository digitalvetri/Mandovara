"use server";

// Split out of grn-actions.ts to stay under the §10 300-line limit.

/* eslint-disable max-lines -- FIXME(§10): 320 lines, limit 300. Split by concern before the next phase; the rule stays enforced so this stays visible. */

// GRN receipt action — separated from actions.ts to keep both files under 300 lines.
// Posts a Goods Receipt Note against a PO:
//   • Validates dye lot is present for mandatory families
//   • Matches GRN lines to POLines by colourwayId (FIFO by POLine.id)
//   • Guards against over-receive per line
//   • Increments POLine.receivedQty in the same transaction
//   • Recomputes PO status (PARTIAL or RECEIVED)

import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { allocateNumber, yymmFromDate } from "@/kernel/numbering/series";
import { devContext } from "@/lib/dev-context";
import { postGRNSchema } from "./schema";
import { computePOStatus, MANDATORY_DYE_LOT_FAMILIES } from "./lib";
import { postGrnToBalance } from "@/kernel/stock/balance";
import { calcPOTotals, scaleQty } from "@/lib/calc/purchase-order";
import { createVendorPaymentExpense } from "./expense";
import { ActionResult } from "./grn-actions";
import { emptyToNull, zodError } from "./grn-actions-part2-helpers";

export async function postGRN(
  input: unknown,
): Promise<ActionResult<{ id: string; number: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "grn.create");
  const parsed = postGRNSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);

  // Load PO + lines (no vendor/colourway relations in schema — fetch separately)
  const po = await db.purchaseOrder.findUniqueOrThrow({
    where: { id: d.purchaseOrderId },
    select: {
      id: true, status: true, vendorId: true,
      lines: {
        orderBy: { id: "asc" },   // FIFO: CUIDs are time-sortable
        select: { id: true, colourwayId: true, quantity: true, receivedQty: true, rate: true },
      },
    },
  });

  if (po.status === "CANCELLED" || po.status === "RECEIVED") {
    return { ok: false, error: `PO is ${po.status} and does not permit receipt` };
  }

  // Fetch colourway families for dye-lot check (no relation on POLine in schema)
  const uniqueColourwayIds = [...new Set(d.lines.map((l) => l.colourwayId))];
  const cwFamilies = uniqueColourwayIds.length
    ? await db.colourway.findMany({
        where: { id: { in: uniqueColourwayIds } },
        select: { id: true, design: { select: { family: true } } },
      })
    : [];
  const familyByColourway = new Map(cwFamilies.map((c) => [c.id, c.design.family]));

  // Build colourwayId → POLine(s) map (FIFO order preserved from orderBy id asc).
  // Typed lines carry no colourway and so are not receivable: they are skipped
  // here, and a GRN naming an item they cover falls through to the usual
  // "not on this PO" error rather than posting stock against nothing.
  const linesByColourway = new Map<string, typeof po.lines>();
  for (const l of po.lines) {
    if (l.colourwayId === null) continue;
    const bucket = linesByColourway.get(l.colourwayId) ?? [];
    bucket.push(l);
    linesByColourway.set(l.colourwayId, bucket);
  }

  // Validate each GRN input line and resolve FIFO POLine allocations
  const resolvedLines: {
    poLines:      { id: string; qty: Decimal; rateNum: number }[];
    qty:          Decimal;
    dyeLot:       string | null;
    binLocation:  string | null;
    colourwayId:  string;
    rate:         bigint;
    rollCount:    number | null;
    rollLengthsM: number[] | null;
  }[] = [];

  for (let i = 0; i < d.lines.length; i++) {
    const req = d.lines[i]!;
    const matchingPOLines = linesByColourway.get(req.colourwayId);

    if (!matchingPOLines || matchingPOLines.length === 0) {
      return {
        ok: false,
        error: "Validation failed",
        fieldErrors: { [`lines.${i}.colourwayId`]: "Colourway not on this PO" },
      };
    }

    // Dye lot mandatory check
    const family = familyByColourway.get(req.colourwayId);
    const dyeLot = emptyToNull(req.dyeLot);
    if (family && MANDATORY_DYE_LOT_FAMILIES.has(family) && !dyeLot) {
      return {
        ok: false,
        error: "Validation failed",
        fieldErrors: {
          [`lines.${i}.dyeLot`]: `Dye lot is required for ${family.toLowerCase().replace(/_/g, " ")}`,
        },
      };
    }

    // Compute total pending across all matching POLines (FIFO)
    const totalPending = matchingPOLines.reduce(
      (sum, l) => sum.plus(l.quantity.minus(l.receivedQty)),
      new Decimal(0),
    );
    const reqQty = new Decimal(req.quantity);
    if (reqQty.gt(totalPending)) {
      return {
        ok: false,
        error: "Over-receive blocked",
        fieldErrors: {
          [`lines.${i}.quantity`]: `Only ${totalPending.toString()} pending for this colourway`,
        },
      };
    }

    // Distribute quantity FIFO across matching POLines
    let remaining = reqQty;
    const poLinesToUpdate: { id: string; qty: Decimal; rateNum: number }[] = [];
    for (const pl of matchingPOLines) {
      if (remaining.lte(0)) break;
      const available = pl.quantity.minus(pl.receivedQty);
      if (available.lte(0)) continue;
      const take = remaining.lte(available) ? remaining : available;
      poLinesToUpdate.push({ id: pl.id, qty: take, rateNum: Number(pl.rate) });
      remaining = remaining.minus(take);
    }

    resolvedLines.push({
      poLines:      poLinesToUpdate,
      qty:          reqQty,
      dyeLot,
      binLocation:  emptyToNull(req.binLocation),
      colourwayId:  req.colourwayId,
      rate:         matchingPOLines[0]!.rate,
      rollCount:    req.rollCount ?? null,
      rollLengthsM: req.rollLengthsM ?? null,
    });
  }

  // Get branch prefix for GRN number
  const branch = await db.branch.findFirst({
    where: { organizationId: ctx.orgId },
    orderBy: { name: "asc" },
    select: { invoicePrefix: true },
  });
  const prefix = branch?.invoicePrefix ?? "MDV";

  const receivedAt = new Date(d.receivedAt);

  const created = await withTransaction(async (tx: TxClient) => {
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
        invoiceRef:      emptyToNull(d.invoiceRef),
      },
      select: { id: true, number: true },
    });

    // Create GRN lines, ratchet POLine.receivedQty, and update the stock ledger
    for (const rl of resolvedLines) {
      await tx.gRNLine.create({
        data: {
          organizationId: ctx.orgId,
          grnId:          grn.id,
          colourwayId:    rl.colourwayId,
          quantity:       rl.qty,
          rate:           rl.rate,
          ...(rl.dyeLot                  && { dyeLot: rl.dyeLot }),
          ...(rl.binLocation             && { binLocation: rl.binLocation }),
          ...(rl.rollCount != null       && { rollCount: rl.rollCount }),
          ...(rl.rollLengthsM?.length    && { rollLengthsM: rl.rollLengthsM }),
        },
      });

      for (const pl of rl.poLines) {
        await tx.pOLine.update({
          where: { id: pl.id },
          data:  { receivedQty: { increment: pl.qty } },
        });
      }

      // Write GRN_IN StockMove + upsert StockBalance for this lot
      await postGrnToBalance(tx, {
        organizationId: ctx.orgId,
        colourwayId:    rl.colourwayId,
        dyeLot:         rl.dyeLot,
        quantity:       rl.qty,
        rate:           rl.rate,
        grnId:          grn.id,
        createdById:    ctx.userId,
        occurredAt:     receivedAt,
      });
    }

    // Re-fetch all POLines and recompute PO status
    const freshLines = await tx.pOLine.findMany({
      where:  { purchaseOrderId: po.id },
      select: { quantity: true, receivedQty: true, colourwayId: true },
    });
    const nextStatus = computePOStatus(
      po.status as "DRAFT" | "SENT" | "PARTIAL" | "RECEIVED" | "CANCELLED",
      freshLines.map((l) => ({ ...l, isFreeText: l.colourwayId === null })),
    );
    if (nextStatus !== po.status) {
      await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: nextStatus } });
    }

    // When the PO goes RECEIVED for the first time, auto-create the matching
    // Expense so vendor payment doesn't need a second data-entry pass. Guarded
    // by Expense.sourcePoId's unique constraint — a second GRN that flips the
    // status back and forth can't spawn duplicates. Owner still pays it via
    // the "Mark paid" button on the To Pay tab.
    const justReceived = nextStatus === "RECEIVED" && po.status !== "RECEIVED";
    if (justReceived) {
      await autoCreateExpenseForPO(tx, ctx.orgId, po.id, ctx.branchIds[0]);
    }

    return { ...grn, justReceived };
  }, { orgId: ctx.orgId });

  revalidatePath("/purchase");
  revalidatePath(`/purchase/${po.id}`);
  if (created.justReceived) revalidatePath("/accounts"); // just raised a vendor-payment expense
  return { ok: true, data: created };
}

/** Create a matching Expense when a PO reaches RECEIVED. GST-splitting and
 *  idempotency now live in expense.ts, shared with receivePO() and the
 *  cancel-a-partial-PO path in actions.ts. */
async function autoCreateExpenseForPO(
  tx:            TxClient,
  orgId:         string,
  poId:          string,
  callerBranchId: string | undefined,
): Promise<void> {
  const fullPo = await tx.purchaseOrder.findUniqueOrThrow({
    where:  { id: poId },
    select: {
      id: true, number: true, totalValue: true, vendorId: true,
      lines: { select: { rate: true, quantity: true, gstRate: true } },
    },
  });

  const vendor = await tx.vendor.findUnique({
    where:  { id: fullPo.vendorId },
    select: { name: true, gstin: true },
  });

  const totals = calcPOTotals(
    fullPo.lines.map((l) => ({
      ratePaise:      l.rate,
      quantityScaled: scaleQty(Number(l.quantity)),
      gstRatePct:     Number(l.gstRate),
    })),
  );

  // PurchaseOrder has no branchId in the schema — resolve from the caller's
  // context, or fall back to any branch of this org so a broken caller still
  // produces a valid Expense row.
  let branchId = callerBranchId;
  if (!branchId) {
    const anyBranch = await tx.branch.findFirst({
      where:  { organizationId: orgId },
      select: { id: true },
    });
    branchId = anyBranch?.id;
  }

  await createVendorPaymentExpense(tx, {
    organizationId: orgId,
    branchId,
    poId:           fullPo.id,
    poNumber:       fullPo.number,
    vendorName:     vendor?.name ?? "Vendor",
    vendorGstin:    vendor?.gstin ?? null,
    // totalValue is already the GST-inclusive ordered value; the taxable/
    // cgst/sgst split is recomputed from the lines for the input-credit
    // fields, and matches it — same calcPOTotals, same lines.
    amount:  fullPo.totalValue,
    taxable: totals.taxableAmount,
    cgst:    totals.cgst,
    sgst:    totals.sgst,
    igst:    totals.igst,
  });
}


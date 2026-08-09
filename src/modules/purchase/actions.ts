"use server";

// Purchase server actions.
//
// createPO: inside tx, allocate PO number, compute per-line GST via kernel/tax
// (vendor stateCode for supplier, branch.stateCode for place-of-supply of the
// PURCHASE side — from the buyer's perspective, own branch is destination).
// Actually simpler: PO totals just aggregate rate×qty×(1+gstRate); we don't
// have to compute intra/inter split at PO stage since we're the buyer — GST
// simply becomes part of what we owe the vendor. Stored per-line for reporting.
//
// postGRN: inside tx, allocate GRN number, insert GRN + GRNLine rows,
// ratchet POLine.receivedQty, over-receive guard, and — critically —
// insert StockLedgerEntry + upsert StockBalance for each line. Same
// append-only ledger path used by Inventory adjustments.

import type { z } from "zod";
import { revalidatePath } from "next/cache";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { parseINR } from "@/kernel/money/format";
import { applyLineDiscount, computeLineTax, computeDocumentTotals } from "@/kernel/tax/gst";
import { allocateNumber, Prisma } from "@/kernel/numbering/series";
import { financialYear } from "@/kernel/datetime";
import { devContext } from "@/lib/dev-context";
import {
  createPOSchema, postGRNSchema, setPOStatusSchema,
} from "./schema";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createPO(input: unknown): Promise<ActionResult<{ id: string; number: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "po.create");
  const parsed = createPOSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const [branch, vendor, products] = await Promise.all([
    db.branch.findUniqueOrThrow({
      where: { id: d.branchId },
      select: { id: true, invoicePrefix: true, stateCode: true },
    }),
    db.vendor.findUniqueOrThrow({
      where: { id: d.vendorId },
      select: { id: true, stateCode: true },
    }),
    db.product.findMany({
      where: { id: { in: d.lines.map((l) => l.productId) } },
      select: { id: true, gstRate: true, name: true },
    }),
  ]);
  const productMap = new Map(products.map((p) => [p.id, p]));

  const built: {
    input: (typeof d.lines)[number]; ratePaise: bigint;
    taxable: bigint; cgst: bigint; sgst: bigint; igst: bigint; amount: bigint;
    gstRate: number; lineNo: number; description: string;
  }[] = [];

  for (let i = 0; i < d.lines.length; i++) {
    const line = d.lines[i]!;
    const product = productMap.get(line.productId);
    if (!product) {
      return { ok: false, error: "Validation failed",
               fieldErrors: { [`lines.${i}.productId`]: "Product not found" } };
    }
    const ratePaise = parseINR(line.rate);
    const qtyPaise = BigInt(Math.round(line.quantity * 10_000));
    const gross = (ratePaise * qtyPaise) / 10_000n;
    const { taxable } = applyLineDiscount(gross, 0);
    const gstRateNum = Number(product.gstRate);
    // Supplier = vendor stateCode; place-of-supply = branch stateCode.
    const tax = computeLineTax({
      taxable, gstRate: gstRateNum,
      supplierStateCode: vendor.stateCode,
      placeOfSupplyCode: branch.stateCode,
    });
    built.push({
      input: line, ratePaise, taxable,
      cgst: tax.cgst, sgst: tax.sgst, igst: tax.igst,
      amount: taxable + tax.cgst + tax.sgst + tax.igst,
      gstRate: gstRateNum, lineNo: i + 1,
      description: (line.description ?? "").trim() !== "" ? line.description!.trim() : product.name,
    });
  }
  const totals = computeDocumentTotals(
    built.map((l) => ({ taxable: l.taxable, gstRate: l.gstRate })),
    { supplierStateCode: vendor.stateCode, placeOfSupplyCode: branch.stateCode },
  );

  const now = new Date(d.date);
  const created = await withTransaction(async (tx: TxClient) => {
    const number = await allocateNumber(tx, {
      orgId:         ctx.orgId,
      branchId:      branch.id,
      docType:       "PURCHASE_ORDER",
      financialYear: financialYear(now),
      prefix:        `${branch.invoicePrefix}/PO`,
    });
    const po = await tx.purchaseOrder.create({
      data: {
        orgId:         ctx.orgId,
        branchId:      branch.id,
        number,
        vendorId:      vendor.id,
        date:          now,
        ...(d.expectedDate && { expectedDate: new Date(d.expectedDate) }),
        status:        "ISSUED",
        taxableAmount: totals.taxableAmount,
        cgst:          totals.cgst,
        sgst:          totals.sgst,
        igst:          totals.igst,
        total:         totals.total,
        createdById:   ctx.userId,
      },
      select: { id: true, number: true },
    });
    await tx.pOLine.createMany({
      data: built.map((l) => ({
        purchaseOrderId: po.id,
        lineNo:          l.lineNo,
        productId:       l.input.productId,
        description:     l.description,
        quantity:        new Prisma.Decimal(l.input.quantity),
        rate:            l.ratePaise,
        taxable:         l.taxable,
        gstRate:         new Prisma.Decimal(l.gstRate),
        amount:          l.amount,
      })),
    });
    return po;
  });

  revalidatePath("/purchase");
  return { ok: true, data: created };
}

export async function postGRN(
  input: unknown,
): Promise<ActionResult<{ id: string; number: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "grn.create");
  const parsed = postGRNSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const po = await db.purchaseOrder.findUniqueOrThrow({
    where: { id: d.purchaseOrderId },
    select: {
      id: true, branchId: true, vendorId: true, status: true,
      lines: {
        select: {
          id: true, productId: true, lineNo: true,
          quantity: true, receivedQty: true, rate: true,
          product: { select: { trackBatch: true, name: true } },
        },
      },
    },
  });
  if (po.status === "CANCELLED" || po.status === "RECEIVED") {
    return { ok: false, error: `PO status ${po.status} does not permit receipt` };
  }
  const branch = await db.branch.findUniqueOrThrow({
    where: { id: po.branchId }, select: { invoicePrefix: true },
  });
  const warehouse = await db.warehouse.findUniqueOrThrow({
    where: { id: d.warehouseId }, select: { id: true },
  });

  const linesByLineId = new Map(po.lines.map((l) => [l.id, l]));

  // §0.6: for batch-tracked products, dye-lot is mandatory at GRN.
  // For non-batch products (hardware, fittings, accessories) it stays optional.
  for (const req of d.lines) {
    const line = linesByLineId.get(req.poLineId);
    if (!line) continue;
    if (line.product.trackBatch && (req.dyeLot == null || req.dyeLot.trim() === "")) {
      return {
        ok: false, error: "Dye-lot required",
        fieldErrors: {
          [`lines.${req.poLineId}.dyeLot`]:
            `${line.product.name} is batch-tracked — capture the dye-lot code from the roll label`,
        },
      };
    }
  }

  // Over-receive guard
  for (const req of d.lines) {
    const line = linesByLineId.get(req.poLineId);
    if (!line) {
      return { ok: false, error: "Validation failed",
               fieldErrors: { [`lines.${req.poLineId}`]: "PO line not found" } };
    }
    const remaining = line.quantity.minus(line.receivedQty);
    if (new Prisma.Decimal(req.quantity).gt(remaining)) {
      return {
        ok: false,
        error: "Over-receive blocked",
        fieldErrors: {
          [`lines.${req.poLineId}`]:
            `Only ${remaining.toString()} pending on line ${line.lineNo}`,
        },
      };
    }
  }

  const receivedAt = new Date(d.receivedAt);
  const totalValue = d.lines.reduce((s, l) => {
    const line = linesByLineId.get(l.poLineId)!;
    const rateNum = Number(line.rate);
    return s + BigInt(Math.round(l.quantity * rateNum));
  }, 0n);

  const created = await withTransaction(async (tx: TxClient) => {
    const number = await allocateNumber(tx, {
      orgId:         ctx.orgId,
      branchId:      po.branchId,
      docType:       "GRN",
      financialYear: financialYear(receivedAt),
      prefix:        `${branch.invoicePrefix}/GRN`,
    });
    const grn = await tx.gRN.create({
      data: {
        orgId:          ctx.orgId,
        branchId:       po.branchId,
        number,
        purchaseOrderId: po.id,
        vendorId:       po.vendorId,
        receivedAt,
        status:         "POSTED",
        totalValue,
        vehicleNumber:  (d.vehicleNumber ?? "").trim() || null,
        invoiceRef:     (d.invoiceRef ?? "").trim() || null,
        createdById:    ctx.userId,
      },
      select: { id: true, number: true },
    });

    // Build GRN lines + ratchet + append to stock ledger + upsert balance
    for (let i = 0; i < d.lines.length; i++) {
      const req = d.lines[i]!;
      const line = linesByLineId.get(req.poLineId)!;
      const qty = new Prisma.Decimal(req.quantity);
      const amount = BigInt(Math.round(req.quantity * Number(line.rate)));
      const dyeLot = req.dyeLot?.trim();
      const binLocation = (req.binLocation ?? "").trim() || null;
      const rollLengthsM = req.rollLengthsM && req.rollLengthsM.length > 0
        ? req.rollLengthsM
        : null;

      // Upsert the dye-lot Batch row and pull its id for the ledger.
      // Non-batch products skip this — no dyeLot means no Batch record.
      let batchId: string | null = null;
      if (dyeLot != null) {
        const batch = await tx.batch.upsert({
          where: {
            orgId_productId_batchNumber: {
              orgId: ctx.orgId, productId: line.productId, batchNumber: dyeLot,
            },
          },
          create: {
            orgId:        ctx.orgId,
            productId:    line.productId,
            warehouseId:  warehouse.id,
            batchNumber:  dyeLot,
            quantity:     qty,
            ...(req.rollCount != null && { rollCount: req.rollCount }),
            ...(rollLengthsM != null && { rollLengthsM }),
            ...(binLocation != null && { binLocation }),
          },
          update: {
            quantity: { increment: qty },
            // Additional rolls: append to the list, sum the count.
            ...(req.rollCount != null && { rollCount: { increment: req.rollCount } }),
            ...(binLocation != null && { binLocation }),
          },
          select: { id: true },
        });
        batchId = batch.id;
      }

      await tx.gRNLine.create({
        data: {
          grnId:       grn.id,
          lineNo:      i + 1,
          productId:   line.productId,
          quantity:    qty,
          rate:        line.rate,
          amount,
          warehouseId: warehouse.id,
          ...(dyeLot != null && { batchNumber: dyeLot }),
          ...(req.rollCount != null && { rollCount: req.rollCount }),
          ...(rollLengthsM != null && { rollLengthsM }),
          ...(binLocation != null && { binLocation }),
        },
      });
      await tx.pOLine.update({
        where: { id: line.id },
        data:  { receivedQty: { increment: qty } },
      });
      // Append to stock ledger — same path as Inventory adjustments (Rule 3).
      // batchId threads dye-lot through the ledger so per-lot balances
      // aggregate correctly downstream.
      await tx.stockLedgerEntry.create({
        data: {
          orgId:       ctx.orgId,
          warehouseId: warehouse.id,
          productId:   line.productId,
          ...(batchId != null && { batchId }),
          direction:   "IN",
          quantity:    qty,
          rate:        line.rate,
          refType:     "GRN",
          refId:       grn.id,
          occurredAt:  receivedAt,
        },
      });
      // Upsert StockBalance (materialised aggregate).
      const existing = await tx.stockBalance.findUnique({
        where: { warehouseId_productId: { warehouseId: warehouse.id, productId: line.productId } },
        select: { quantity: true, value: true },
      });
      const currentQty = new Prisma.Decimal(existing?.quantity ?? 0);
      const currentValue = existing?.value ?? 0n;
      const newQty = currentQty.plus(qty);
      const newValue = currentValue + amount;
      await tx.stockBalance.upsert({
        where: { warehouseId_productId: { warehouseId: warehouse.id, productId: line.productId } },
        create: {
          orgId: ctx.orgId, warehouseId: warehouse.id, productId: line.productId,
          quantity: newQty, value: newValue,
        },
        update: { quantity: newQty, value: newValue },
      });
    }

    // Recompute PO status from ratcheted receivedQty
    const fresh = await tx.pOLine.findMany({
      where: { purchaseOrderId: po.id },
      select: { quantity: true, receivedQty: true },
    });
    const allComplete = fresh.every((l) => l.receivedQty.gte(l.quantity));
    const anyReceived = fresh.some((l) => l.receivedQty.gt(0));
    const nextStatus = allComplete ? "RECEIVED"
                     : anyReceived ? "PARTIAL_RECEIVED"
                     : po.status;
    if (nextStatus !== po.status) {
      await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: nextStatus } });
    }
    return grn;
  });

  revalidatePath("/purchase");
  revalidatePath(`/purchase/${po.id}`);
  revalidatePath("/inventory");
  return { ok: true, data: created };
}

export async function setPOStatus(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  const parsed = setPOStatusSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id, status } = parsed.data;
  requirePermission(ctx, status === "CANCELLED" ? "po.cancel" : "po.approve");
  const db = scoped(ctx);
  await db.purchaseOrder.update({ where: { id }, data: { status } });
  revalidatePath("/purchase");
  revalidatePath(`/purchase/${id}`);
  return { ok: true, data: { id } };
}

function zodError<T = unknown>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path.filter((s): s is string | number => typeof s === "string" || typeof s === "number").join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}

"use server";

import type { z } from "zod";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { parseINR } from "@/kernel/money/format";
import { allocateNumber, yymmFromDate } from "@/kernel/numbering/series";
import { devContext } from "@/lib/dev-context";
import { calcPOTotals, scaleQty } from "@/lib/calc/purchase-order";
import { createVendorPaymentExpense } from "./expense";
import { createPOSchema, setPOStatusSchema, rejectPOSchema } from "./schema";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createPO(
  input: unknown,
): Promise<ActionResult<{ id: string; number: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "po.create");
  const parsed = createPOSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);

  // Validate vendor belongs to org
  const vendor = await db.vendor.findUniqueOrThrow({
    where: { id: d.vendorId },
    select: { id: true },
  });

  // Validate all colourways belong to org and are active. Typed lines carry
  // no colourway, so they are simply not part of this check — the schema has
  // already insisted each line has one or the other.
  const colourwayIds = d.lines
    .map((l) => l.colourwayId)
    .filter((id): id is string => !!id);
  if (colourwayIds.length > 0) {
    const colourways = await db.colourway.findMany({
      where: { id: { in: colourwayIds }, organizationId: ctx.orgId, isActive: true },
      select: { id: true },
    });
    if (colourways.length !== new Set(colourwayIds).size) {
      return { ok: false, error: "One or more colourways not found or inactive" };
    }
  }

  // Ordered value is GST-inclusive — it is what the vendor will be paid, and
  // what the To-Pay list and the vendor ledger read off this column.
  const { total: totalValue } = calcPOTotals(
    d.lines.map((l) => ({
      ratePaise:      parseINR(l.rate),
      quantityScaled: scaleQty(l.quantity),
      gstRatePct:     l.gstRate ?? 0,
    })),
  );

  // Get branch prefix for number generation
  const branch = await db.branch.findFirst({
    where: { organizationId: ctx.orgId },
    orderBy: { name: "asc" },
    select: { invoicePrefix: true },
  });
  const prefix = branch?.invoicePrefix ?? "MDV";

  const now = new Date(d.date);
  const created = await withTransaction(async (tx: TxClient) => {
    const number = await allocateNumber(tx, {
      orgId:  ctx.orgId,
      series: "PO",
      yymm:   yymmFromDate(now),
      prefix,
    });
    const po = await tx.purchaseOrder.create({
      data: {
        organizationId: ctx.orgId,
        number,
        vendorId:   vendor.id,
        date:       now,
        ...(d.expectedAt && { expectedAt: new Date(d.expectedAt) }),
        ...(d.projectId  && { projectId: d.projectId }),
        status:     "DRAFT",
        totalValue,
      },
      select: { id: true, number: true },
    });
    await tx.pOLine.createMany({
      data: d.lines.map((l) => ({
        organizationId:  ctx.orgId,
        purchaseOrderId: po.id,
        colourwayId:     l.colourwayId ?? null,
        freeTextItem:    l.colourwayId ? null : (l.freeTextItem ?? null),
        unit:            l.unit,
        quantity:        new Decimal(l.quantity),
        rate:            parseINR(l.rate),
        gstRate:         new Decimal(l.gstRate ?? 0),
      })),
    });
    return po;
  }, { orgId: ctx.orgId });

  revalidatePath("/purchase");
  return { ok: true, data: created };
}

export async function setPOStatus(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  const parsed = setPOStatusSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id, status } = parsed.data;

  if (status === "CANCELLED") {
    requirePermission(ctx, "po.cancel");
  } else if (status === "APPROVED") {
    requirePermission(ctx, "po.approve");
  } else {
    requirePermission(ctx, "po.create");
  }

  const db = scoped(ctx);
  const po = await db.purchaseOrder.findUniqueOrThrow({
    where: { id },
    select: {
      status: true,
      number: true,
      vendorId: true,
      lines: { select: { receivedQty: true, rate: true, gstRate: true } },
    },
  });

  // Prevent marking RECEIVED without any GRN having been posted.
  if (status === "RECEIVED") {
    const totalReceived = po.lines.reduce(
      (sum, l) => sum + parseFloat(l.receivedQty.toString()),
      0,
    );
    if (totalReceived === 0) {
      return { ok: false, error: "Cannot mark as received — no GRN has been posted for this PO. Post a GRN first." };
    }
  }

  const VALID_TRANSITIONS: Record<string, string[]> = {
    DRAFT:            ["PENDING_APPROVAL", "SENT"],
    PENDING_APPROVAL: ["APPROVED"],
    APPROVED:         ["SENT"],
    SENT:             ["PARTIAL", "RECEIVED", "CANCELLED"],
    PARTIAL:          ["RECEIVED", "CANCELLED"],
    RECEIVED:         [],
    CANCELLED:        [],
  };
  const allowed = VALID_TRANSITIONS[po.status] ?? [];
  if (!allowed.includes(status)) {
    return { ok: false, error: `Cannot move PO from ${po.status} to ${status}` };
  }

  await withTransaction(async (tx: TxClient) => {
    await tx.purchaseOrder.update({
      where: { id },
      data: {
        status,
        ...(status === "APPROVED" ? { approvedById: ctx.userId, approvedAt: new Date() } : {}),
      },
    });

    // A PARTIAL PO that gets cancelled still owes the vendor for goods already
    // received. Auto-create an Expense for the received value — GST-inclusive,
    // same as a normal receipt — so it surfaces in accounts payable and in the
    // GST tab's input credit. createVendorPaymentExpense() is idempotent via
    // Expense.sourcePoId.
    if (status === "CANCELLED" && po.status === "PARTIAL") {
      const receivedTotals = calcPOTotals(
        po.lines.map((l) => ({
          ratePaise:      l.rate,
          quantityScaled: scaleQty(parseFloat(l.receivedQty.toString())),
          gstRatePct:     Number(l.gstRate),
        })),
      );
      if (receivedTotals.total > 0n) {
        const vendor = await tx.vendor.findUnique({
          where: { id: po.vendorId },
          select: { name: true, gstin: true },
        });
        let branchId = ctx.branchIds[0];
        if (!branchId) {
          const anyBranch = await tx.branch.findFirst({
            where: { organizationId: ctx.orgId },
            select: { id: true },
          });
          branchId = anyBranch?.id;
        }
        await createVendorPaymentExpense(tx, {
          organizationId:    ctx.orgId,
          branchId,
          poId:              id,
          poNumber:          po.number,
          vendorName:        vendor?.name ?? "Vendor",
          vendorGstin:       vendor?.gstin ?? null,
          descriptionSuffix: "partial receipt, PO cancelled",
          amount:            receivedTotals.total,
          taxable:           receivedTotals.taxableAmount,
          cgst:              receivedTotals.cgst,
          sgst:              receivedTotals.sgst,
          igst:              receivedTotals.igst,
        });
      }
    }
  }, { orgId: ctx.orgId });

  revalidatePath("/purchase");
  revalidatePath(`/purchase/${id}`);
  if (status === "CANCELLED") revalidatePath("/accounts"); // may have just raised a vendor-payment expense
  return { ok: true, data: { id } };
}

export async function rejectPO(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "po.approve");
  const parsed = rejectPOSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id } = parsed.data;

  const db = scoped(ctx);
  const po = await db.purchaseOrder.findUniqueOrThrow({ where: { id }, select: { status: true } });
  if (po.status !== "PENDING_APPROVAL") {
    return { ok: false, error: "Only pending-approval POs can be rejected" };
  }

  await db.purchaseOrder.update({ where: { id }, data: { status: "DRAFT" } });
  revalidatePath("/purchase");
  revalidatePath(`/purchase/${id}`);
  return { ok: true, data: { id } };
}

function zodError<T = unknown>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path
      .filter((s): s is string | number => typeof s === "string" || typeof s === "number")
      .join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}

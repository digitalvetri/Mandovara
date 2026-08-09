"use server";

// Sales orders + dispatch server actions.
//
// createFromQuotation:
//   - Reads an ACCEPTED quotation, mints an order copying header + lines,
//     allocates order number inside the tx, flips the quotation to CONVERTED.
//   - Everything in one transaction so a failure doesn't leave a converted
//     quote without an order.
//
// createDispatch:
//   - Increments dispatchedQty on each affected OrderLine.
//   - Guards: dispatched can never exceed ordered (§11 acceptance).
//   - Updates order status: DRAFT/CONFIRMED → PARTIAL_DISPATCH → DISPATCHED
//     based on whether all lines are fully dispatched.
//   - Numbering allocated inside the same tx.

import type { z } from "zod";
import { revalidatePath } from "next/cache";

// revalidatePath throws "static generation store missing" when the
// action is invoked outside a Next request context (smoke scripts,
// integration tests). Swallowing it there keeps the same action
// callable from both surfaces. Mirrors the safeRevalidate in
// modules/quotations/actions.ts and modules/allocation/actions.ts.
function safeRevalidate(path: string): void {
  try { revalidatePath(path); } catch { /* not in a Next request */ }
}

import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { allocateNumber, Prisma } from "@/kernel/numbering/series";
import { financialYear } from "@/kernel/datetime";
import { devContext } from "@/lib/dev-context";
import {
  convertQuotationSchema, createDispatchSchema, setOrderStatusSchema,
} from "./schema";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createOrderFromQuotation(
  input: unknown,
): Promise<ActionResult<{ id: string; number: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "order.create");

  const parsed = convertQuotationSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { quotationId, deliveryBy } = parsed.data;

  // Pre-tx load
  const db = scoped(ctx);
  const q = await db.quotation.findUniqueOrThrow({
    where: { id: quotationId },
    select: {
      id: true, branchId: true, clientId: true, status: true,
      taxableAmount: true, cgst: true, sgst: true, igst: true, total: true,
      lines: {
        orderBy: { lineNo: "asc" },
        select: {
          lineNo: true, productId: true, description: true, quantity: true,
          rate: true, gstRate: true, amount: true,
          // §15 rule 6 (Phase 5): the frozen quote snapshot must ride
          // through order conversion so the make cut list can be
          // materialised from what the client agreed to, not from a
          // (possibly newer) live CalcResult.
          measurementItemId: true, calcSnapshot: true,
        },
      },
    },
  });
  if (q.status !== "ACCEPTED") {
    return { ok: false, error: `Quotation must be ACCEPTED to convert (currently ${q.status})` };
  }
  const branch = await db.branch.findUniqueOrThrow({
    where: { id: q.branchId },
    select: { invoicePrefix: true },
  });

  // §5.2 / Phase 6b — architect commission. If the client was
  // referred by an active architect with a non-zero rate, stamp a
  // commission row inside the same tx as the order. Rate captured
  // at stamp time so future rate edits don't retroactively re-price.
  const client = await db.client.findUniqueOrThrow({
    where: { id: q.clientId },
    select: { architectId: true },
  });
  const architect = client.architectId != null
    ? await db.architect.findUnique({
        where: { id: client.architectId },
        select: { id: true, commissionPct: true, isActive: true },
      })
    : null;

  const now = new Date();
  const created = await withTransaction(async (tx: TxClient) => {
    const number = await allocateNumber(tx, {
      orgId:         ctx.orgId,
      branchId:      q.branchId,
      docType:       "SALES_ORDER",
      financialYear: financialYear(now),
      prefix:        `${branch.invoicePrefix}/SO`,
    });
    const order = await tx.salesOrder.create({
      data: {
        orgId:         ctx.orgId,
        branchId:      q.branchId,
        number,
        clientId:      q.clientId,
        quotationId:   q.id,
        date:          now,
        ...(deliveryBy != null && deliveryBy !== "" && { deliveryBy: new Date(deliveryBy) }),
        status:        "CONFIRMED",
        taxableAmount: q.taxableAmount,
        cgst:          q.cgst,
        sgst:          q.sgst,
        igst:          q.igst,
        total:         q.total,
        createdById:   ctx.userId,
      },
      select: { id: true, number: true },
    });
    await tx.orderLine.createMany({
      data: q.lines.map((l) => ({
        salesOrderId:      order.id,
        lineNo:            l.lineNo,
        productId:         l.productId,
        description:       l.description,
        orderedQty:        l.quantity,
        rate:              l.rate,
        gstRate:           l.gstRate,
        amount:            l.amount,
        // Freeze propagation — see the pre-tx select comment. Null on
        // non-M2M lines and passes through unchanged; the Prisma type
        // for JSON columns needs an cast when reused from another row.
        measurementItemId: l.measurementItemId,
        ...(l.calcSnapshot != null && {
          calcSnapshot: l.calcSnapshot as Prisma.InputJsonValue,
        }),
      })),
    });
    await tx.quotation.update({
      where: { id: q.id },
      data: { status: "CONVERTED" },
    });

    // Stamp commission if the client was referred + architect active
    // + rate > 0. Skip silently otherwise — three legitimate reasons
    // to have no commission and none of them are errors.
    if (architect && architect.isActive) {
      const pctDec = new Prisma.Decimal(architect.commissionPct);
      if (pctDec.gt(0)) {
        // amount = baseAmount × pct / 100, rounded to the nearest paisa.
        // BigInt-safe math via Prisma.Decimal.
        const base = new Prisma.Decimal(q.taxableAmount.toString());
        const amount = BigInt(base.mul(pctDec).div(100).round().toString());
        const commission = await tx.architectCommission.create({
          data: {
            orgId:        ctx.orgId,
            architectId:  architect.id,
            salesOrderId: order.id,
            baseAmount:   q.taxableAmount,
            pct:          pctDec,
            amount,
            createdById:  ctx.userId,
          },
          select: { id: true },
        });
        await tx.auditLog.create({
          data: {
            orgId: ctx.orgId, actorId: ctx.userId,
            entityType: "ArchitectCommission", entityId: commission.id,
            action: "STAMP_ON_ORDER",
            after: {
              salesOrderId: order.id, orderNumber: order.number,
              architectId:  architect.id,
              baseAmount:   q.taxableAmount.toString(),
              pct:          pctDec.toString(),
              amount:       amount.toString(),
            },
          },
        });
      }
    }

    return order;
  });

  safeRevalidate("/orders");
  safeRevalidate("/quotations");
  safeRevalidate(`/quotations/${q.id}`);
  if (architect) safeRevalidate(`/architects/${architect.id}`);
  return { ok: true, data: created };
}

export async function createDispatch(
  input: unknown,
): Promise<ActionResult<{ id: string; number: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "dispatch.create");

  const parsed = createDispatchSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const order = await db.salesOrder.findUniqueOrThrow({
    where: { id: d.salesOrderId },
    select: {
      id: true, branchId: true, status: true,
      lines: {
        select: { id: true, orderedQty: true, dispatchedQty: true, productId: true, lineNo: true },
      },
    },
  });
  if (order.status === "CANCELLED" || order.status === "DISPATCHED") {
    return { ok: false, error: `Order status ${order.status} does not permit dispatch` };
  }
  const branch = await db.branch.findUniqueOrThrow({
    where: { id: order.branchId },
    select: { invoicePrefix: true },
  });

  // Over-dispatch guard — server-side, per line, using Decimal safe compare.
  const linesByOrderLineId = new Map(order.lines.map((l) => [l.id, l]));
  for (const req of d.lines) {
    const line = linesByOrderLineId.get(req.orderLineId);
    if (!line) {
      return { ok: false, error: "Validation failed",
               fieldErrors: { [`lines.${req.orderLineId}`]: "Order line not found" } };
    }
    const remaining = line.orderedQty.minus(line.dispatchedQty);
    if (new Prisma.Decimal(req.quantity).gt(remaining)) {
      return {
        ok: false,
        error: "Over-dispatch blocked",
        fieldErrors: {
          [`lines.${req.orderLineId}`]:
            `Only ${remaining.toString()} pending on line ${line.lineNo}`,
        },
      };
    }
  }

  const dispatchedAt = new Date(d.dispatchedAt);

  const created = await withTransaction(async (tx: TxClient) => {
    const number = await allocateNumber(tx, {
      orgId:         ctx.orgId,
      branchId:      order.branchId,
      docType:       "DISPATCH",
      financialYear: financialYear(dispatchedAt),
      prefix:        `${branch.invoicePrefix}/DC`,
    });
    const dispatch = await tx.dispatch.create({
      data: {
        orgId:        ctx.orgId,
        branchId:     order.branchId,
        number,
        salesOrderId: order.id,
        status:       "POSTED",
        dispatchedAt,
        vehicleNumber: (d.vehicleNumber ?? "").trim() || null,
        transporter:   (d.transporter   ?? "").trim() || null,
        createdById:  ctx.userId,
      },
      select: { id: true, number: true },
    });
    await tx.dispatchLine.createMany({
      data: d.lines.map((l, i) => {
        const orderLine = linesByOrderLineId.get(l.orderLineId)!;
        return {
          dispatchId: dispatch.id,
          lineNo:     i + 1,
          productId:  orderLine.productId,
          quantity:   new Prisma.Decimal(l.quantity),
        };
      }),
    });
    // Ratchet dispatchedQty on each OrderLine.
    for (const l of d.lines) {
      await tx.orderLine.update({
        where: { id: l.orderLineId },
        data:  { dispatchedQty: { increment: new Prisma.Decimal(l.quantity) } },
      });
    }
    // Recompute order status.
    const fresh = await tx.orderLine.findMany({
      where: { salesOrderId: order.id },
      select: { orderedQty: true, dispatchedQty: true },
    });
    const allComplete = fresh.every((l) => l.dispatchedQty.gte(l.orderedQty));
    const anyDispatched = fresh.some((l) => l.dispatchedQty.gt(0));
    const nextStatus = allComplete ? "DISPATCHED"
                     : anyDispatched ? "PARTIAL_DISPATCH"
                     : order.status;
    if (nextStatus !== order.status) {
      await tx.salesOrder.update({ where: { id: order.id }, data: { status: nextStatus } });
    }
    return dispatch;
  });

  safeRevalidate("/orders");
  safeRevalidate(`/orders/${order.id}`);
  return { ok: true, data: created };
}

export async function setOrderStatus(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  const parsed = setOrderStatusSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id, status } = parsed.data;

  requirePermission(ctx, status === "CANCELLED" ? "order.cancel" : "order.amend");
  const db = scoped(ctx);
  await db.salesOrder.update({ where: { id }, data: { status } });

  safeRevalidate("/orders");
  safeRevalidate(`/orders/${id}`);
  return { ok: true, data: { id } };
}

// ── helpers ──────────────────────────────────────────────────────

function zodError<T = unknown>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path
      .filter((seg): seg is string | number => typeof seg === "string" || typeof seg === "number")
      .join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}

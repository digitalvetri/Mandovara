"use server";

import type { z } from "zod";
import { revalidatePath } from "next/cache";
import { withTransaction } from "@/kernel/db/transaction";
import type { TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { parseINR } from "@/kernel/money/format";
import { allocateNumber, yymmFromDate } from "@/kernel/numbering/series";
import { devContext } from "@/lib/dev-context";
import { convertQuotationSchema, setOrderStatusSchema, scheduleDispatchSchema } from "./schema";

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
  const d = parsed.data;

  const db = scoped(ctx);
  const q = await db.quotation.findUniqueOrThrow({
    where: { id: d.quotationId },
    select: {
      id: true, branchId: true, projectId: true, clientId: true,
      status: true, total: true,
      lines: {
        orderBy: { lineNo: "asc" },
        select: {
          lineNo: true, measurementItemId: true, colourwayId: true, serviceRateId: true,
          description: true, quantity: true, unit: true, rate: true, amount: true,
        },
      },
    },
  });

  if (q.status !== "ACCEPTED") {
    return {
      ok: false,
      error: `Quotation must be ACCEPTED to convert (currently ${q.status})`,
    };
  }

  const branch = await db.branch.findUniqueOrThrow({
    where: { id: q.branchId },
    select: { invoicePrefix: true },
  });

  const now = new Date();
  const advanceRequired =
    d.advanceRequired && d.advanceRequired.trim() ? parseINR(d.advanceRequired) : 0n;
  const promisedInstallAt =
    d.promisedInstallAt && d.promisedInstallAt.trim()
      ? new Date(d.promisedInstallAt)
      : null;

  const created = await withTransaction(async (tx: TxClient) => {
    const number = await allocateNumber(tx, {
      orgId:  ctx.orgId,
      series: "SO",
      yymm:   yymmFromDate(now),
      prefix: branch.invoicePrefix,
    });
    const order = await tx.order.create({
      data: {
        organizationId:   ctx.orgId,
        branchId:         q.branchId,
        number,
        projectId:        q.projectId,
        clientId:         q.clientId,
        quotationId:      q.id,
        date:             now,
        status:           "CONFIRMED",
        totalValue:       q.total,
        advanceRequired,
        ...(promisedInstallAt && { promisedInstallAt }),
      },
      select: { id: true, number: true },
    });
    await tx.orderLine.createMany({
      data: q.lines.map((l) => ({
        organizationId:    ctx.orgId,
        orderId:           order.id,
        lineNo:            l.lineNo,
        measurementItemId: l.measurementItemId ?? null,
        colourwayId:       l.colourwayId ?? null,
        serviceRateId:     l.serviceRateId ?? null,
        description:       l.description,
        quantity:          l.quantity,
        unit:              l.unit,
        rate:              l.rate,
        amount:            l.amount,
      })),
    });
    return order;
  });

  revalidatePath("/orders");
  revalidatePath("/quotations");
  revalidatePath(`/quotations/${q.id}`);
  return { ok: true, data: created };
}

export async function setOrderStatus(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  const parsed = setOrderStatusSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id, status } = parsed.data;

  requirePermission(ctx, status === "CANCELLED" ? "order.cancel" : "order.amend");

  const db = scoped(ctx);
  await db.order.update({ where: { id }, data: { status } });

  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
  return { ok: true, data: { id } };
}

export async function scheduleDispatch(
  input: unknown,
): Promise<ActionResult<{ id: string; number: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "order.amend");

  const parsed = scheduleDispatchSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const order = await db.order.findUnique({
    where: { id: d.orderId },
    select: { id: true, projectId: true, branchId: true, status: true },
  });
  if (!order) return { ok: false, error: "Order not found." };
  if (order.status === "CANCELLED") return { ok: false, error: "Cannot dispatch a cancelled order." };

  // Guard: ensure requested quantities don't exceed what's still available to dispatch.
  // installedQty is only updated on install completion; the correct source for
  // "already dispatched" is the sum of InstallLine.plannedQty across non-cancelled visits.
  const reqLineIds = d.lines.map((l) => l.orderLineId);
  const [orderLines, existingDispatch] = await Promise.all([
    db.orderLine.findMany({
      where: { orderId: d.orderId, id: { in: reqLineIds } },
      select: { id: true, quantity: true },
    }),
    db.installLine.findMany({
      where: { orderLineId: { in: reqLineIds }, visit: { orderId: d.orderId, kind: "DISPATCH", status: { not: "CANCELLED" } } },
      select: { orderLineId: true, plannedQty: true },
    }),
  ]);
  const orderQtyMap = new Map(orderLines.map((l) => [l.id, Number(l.quantity)]));
  const dispatchedMap = new Map<string, number>();
  for (const el of existingDispatch) {
    dispatchedMap.set(el.orderLineId, (dispatchedMap.get(el.orderLineId) ?? 0) + Number(el.plannedQty));
  }
  for (const reqLine of d.lines) {
    const ordered    = orderQtyMap.get(reqLine.orderLineId) ?? 0;
    const dispatched = dispatchedMap.get(reqLine.orderLineId) ?? 0;
    const remaining  = ordered - dispatched;
    const requested  = parseFloat(reqLine.plannedQty);
    if (requested > remaining + 0.001) {
      return {
        ok: false,
        error: `Dispatch quantity (${requested}) exceeds remaining (${remaining.toFixed(2)}) for one or more lines.`,
      };
    }
  }

  const branch = await db.branch.findUniqueOrThrow({
    where: { id: order.branchId },
    select: { invoicePrefix: true },
  });

  const now               = new Date();
  const scheduledAt       = new Date(d.scheduledAt);
  const expectedDeliveryAt = d.expectedDeliveryAt ? new Date(d.expectedDeliveryAt) : null;

  const created = await withTransaction(async (tx: TxClient) => {
    const number = await allocateNumber(tx, {
      orgId:  ctx.orgId,
      series: "INS",
      yymm:   yymmFromDate(now),
      prefix: branch.invoicePrefix,
    });

    const checklistObj: Record<string, string> = {};
    if (d.vehicle)           checklistObj.vehicle            = d.vehicle;
    if (expectedDeliveryAt)  checklistObj.expectedDeliveryAt = expectedDeliveryAt.toISOString();

    const visit = await tx.installVisit.create({
      data: {
        organizationId: ctx.orgId,
        number,
        projectId:      order.projectId,
        orderId:        order.id,
        kind:           "DISPATCH",
        scheduledAt,
        status:         "SCHEDULED",
        photoKeys:      [],
        notes:          d.notes || null,
        ...(Object.keys(checklistObj).length > 0 && { checklist: checklistObj }),
      },
      select: { id: true, number: true },
    });

    await tx.installLine.createMany({
      data: d.lines.map((l) => ({
        organizationId: ctx.orgId,
        installVisitId: visit.id,
        orderLineId:    l.orderLineId,
        roomLabel:      l.roomLabel,
        plannedQty:     parseFloat(l.plannedQty),
        remoteSerials:  [],
        photoKeys:      [],
      })),
    });

    return visit;
  });

  revalidatePath(`/orders/${d.orderId}`);
  revalidatePath("/orders");
  return { ok: true, data: created };
}

// ── helpers ──────────────────────────────────────────────────────────────────

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

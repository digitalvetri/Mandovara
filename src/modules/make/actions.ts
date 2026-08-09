"use server";

// Make server actions.
//
// createMakeJobFromOrder mints one MakeJob per SalesOrder in QUEUED
// state, allocating a race-safe MDV/MJ number and inserting one
// MakeJobLine per order line that carries a cut-list-relevant
// snapshot. The cut list itself is built by the pure buildCutList()
// helper — this action owns the DB reads/writes and nothing more.
//
// §14 Phase 5 gate: the invariant is that MakeJobLine.panels and
// .cutLengthMm equal OrderLine.calcSnapshot.outputs.{panels, cutLengthMm}
// which in turn equal QuotationLine.calcSnapshot.outputs.{...} which
// in turn equal CalcResult.outputs.{...}. buildCutList is a pure map;
// createOrderFromQuotation copies the snapshot verbatim; freezing on
// SEND writes what the engine produced.

import type { z } from "zod";
import { revalidatePath } from "next/cache";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { allocateNumber, Prisma } from "@/kernel/numbering/series";
import { financialYear } from "@/kernel/datetime";
import { devContext } from "@/lib/dev-context";
import { createMakeJobFromOrderSchema } from "./schema";
import { buildCutList, type OrderLineForCutList } from "./cut-list";

// safeRevalidate — mirrors modules/quotations/actions.ts and
// modules/allocation/actions.ts. Lets the action run under both a
// Next request and a bare tsx smoke script.
function safeRevalidate(path: string): void {
  try { revalidatePath(path); } catch { /* not in a Next request */ }
}

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createMakeJobFromOrder(
  input: unknown,
): Promise<ActionResult<{ id: string; number: string; lineCount: number }>> {
  const ctx = await devContext();
  requirePermission(ctx, "make.create");

  const parsed = createMakeJobFromOrderSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { orderId } = parsed.data;

  // Pre-tx load — scoped so a foreign tenant can't touch our order.
  const db = scoped(ctx);
  const order = await db.salesOrder.findUnique({
    where:  { id: orderId },
    select: {
      id: true, branchId: true, status: true, date: true,
      lines: {
        orderBy: { lineNo: "asc" },
        select: {
          id: true, lineNo: true, measurementItemId: true, calcSnapshot: true,
          measurement: { select: { roomLabel: true } },
        },
      },
      makeJobs: { select: { id: true, number: true, status: true }, take: 1 },
    },
  });
  if (!order) return { ok: false, error: "Order not found" };
  if (order.status === "CANCELLED") {
    return { ok: false, error: "Order is CANCELLED — cannot create a make job" };
  }
  if (order.makeJobs.length > 0) {
    // No re-cutting. A second make job for the same order is a design
    // smell — split via order amendment, don't stack jobs.
    const existing = order.makeJobs[0]!;
    return {
      ok: false,
      error: `Order already has a make job (${existing.number}, ${existing.status})`,
    };
  }
  const branch = await db.branch.findUniqueOrThrow({
    where:  { id: order.branchId },
    select: { invoicePrefix: true },
  });

  const sourceLines: OrderLineForCutList[] = order.lines.map((l) => ({
    orderLineId:       l.id,
    measurementItemId: l.measurementItemId,
    calcSnapshot:      l.calcSnapshot,
    roomLabel:         l.measurement?.roomLabel ?? `Line ${l.lineNo}`,
  }));
  const cutList = buildCutList(sourceLines);
  if (cutList.length === 0) {
    return {
      ok: false,
      error: "Order has no made-to-measure lines to cut — nothing to make.",
    };
  }

  const created = await withTransaction(async (tx: TxClient) => {
    const number = await allocateNumber(tx, {
      orgId:         ctx.orgId,
      branchId:      order.branchId,
      docType:       "MAKE_JOB",
      financialYear: financialYear(order.date),
      prefix:        `${branch.invoicePrefix}/MJ`,
    });
    const job = await tx.makeJob.create({
      data: {
        orgId:        ctx.orgId,
        number,
        salesOrderId: order.id,
        status:       "QUEUED",
        createdById:  ctx.userId,
      },
      select: { id: true, number: true },
    });
    await tx.makeJobLine.createMany({
      data: cutList.map((entry) => ({
        makeJobId:         job.id,
        orderLineId:       entry.orderLineId,
        measurementItemId: entry.measurementItemId,
        roomLabel:         entry.roomLabel,
        ...(entry.panels      != null && { panels:      entry.panels }),
        ...(entry.cutLengthMm != null && {
          cutLengthMm: new Prisma.Decimal(entry.cutLengthMm),
        }),
        ...(entry.liningIssuedM != null && {
          liningIssuedM: new Prisma.Decimal(entry.liningIssuedM),
        }),
        ...(entry.eyeletCount != null && { eyeletCount: entry.eyeletCount }),
        ...(entry.headingType != null && { headingType: entry.headingType }),
      })),
    });
    return job;
  });

  safeRevalidate("/make");
  safeRevalidate(`/orders/${order.id}`);
  return {
    ok:   true,
    data: { id: created.id, number: created.number, lineCount: cutList.length },
  };
}

// ── helpers ──────────────────────────────────────────────────────

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

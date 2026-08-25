"use server";

import type { z } from "zod";
import { revalidatePath } from "next/cache";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { submitQCSchema } from "./schema";
import type { ActionResult } from "./actions";

export async function submitQC(
  input: unknown,
): Promise<ActionResult<{ id: string; status: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "make.update");

  const parsed = submitQCSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const job = await db.makeJob.findUnique({
    where: { id: d.makeJobId },
    select: {
      id: true, status: true, orderId: true,
      lines: { select: { orderLineId: true } },
    },
  });
  if (!job) return { ok: false, error: "Make job not found" };
  if (job.status !== "QC") {
    return { ok: false, error: `QC can only be submitted when job is in QC status (currently ${job.status})` };
  }

  const nextStatus = d.passed ? "READY" : "REWORK";
  const now = new Date();
  const qcDate = d.qcDate ? new Date(d.qcDate) : now;

  await withTransaction(async (tx: TxClient) => {
    await tx.makeJob.update({
      where: { id: d.makeJobId },
      data: {
        status: nextStatus,
        ...(nextStatus === "READY" ? { completedAt: now } : {}),
      },
    });

    await tx.makeJobEvent.create({
      data: {
        organizationId: ctx.orgId,
        makeJobId: d.makeJobId,
        actorId: ctx.userId,
        type: d.passed ? "QC_PASS" : "QC_FAIL",
        fromStatus: "QC",
        toStatus: nextStatus,
        payload: {
          ...(d.defects ? { defects: d.defects } : {}),
          ...(d.reworkNotes ? { reworkNotes: d.reworkNotes } : {}),
          ...(d.checkedById ? { checkedById: d.checkedById } : {}),
          qcDate: qcDate.toISOString(),
        },
      },
    });

    if (d.passed) {
      const orderLineIds = job.lines.map((l) => l.orderLineId);
      const orderLines = await tx.orderLine.findMany({
        where: { id: { in: orderLineIds } },
        select: { id: true, quantity: true },
      });
      for (const ol of orderLines) {
        await tx.orderLine.update({
          where: { id: ol.id },
          data: { madeQty: ol.quantity },
        });
      }

      // Advance order to COMPLETED when all jobs for this order are done.
      // (Was READY_TO_INSTALL before installation was removed as a stage.)
      const allJobsForOrder = await tx.makeJob.findMany({
        where: { orderId: job.orderId, organizationId: ctx.orgId },
        select: { id: true, status: true },
      });
      const allReady = allJobsForOrder.every(
        (j) => j.id === d.makeJobId || j.status === "READY" || j.status === "DELIVERED",
      );
      if (allReady) {
        await tx.order.updateMany({
          where: {
            id: job.orderId,
            organizationId: ctx.orgId,
            status: { in: ["CONFIRMED", "PROCUREMENT", "MAKE"] },
          },
          data: { status: "COMPLETED" },
        });

        // Auto-schedule of the HANDOVER visit was removed 25 Aug 2026
        // at the owner's request — the +3-day default was arbitrary and
        // forced a reschedule almost every time. The project page now
        // surfaces a "Book install visit" CTA once every make job is
        // done (see resolveNextAction for stage=MAKE with all-done).
      }
    }
  }, { orgId: ctx.orgId });

  revalidatePath("/make");
  revalidatePath(`/make/${d.makeJobId}`);
  revalidatePath("/orders");
  return { ok: true, data: { id: d.makeJobId, status: nextStatus } };
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

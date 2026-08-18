"use server";

// Split out of actions.ts to stay under the §10 300-line limit.


import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { bus } from "@/kernel/events/bus";
import "@/kernel/events/register";
import { zodError } from "./lib";
import { setStatusSchema } from "./schema";
import { ActionResult } from "./actions";

export async function setQuotationStatus(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  const parsed = setStatusSchema.safeParse(input);
  if (!parsed.success) return zodError<{ id: string }>(parsed.error);
  const { id, status } = parsed.data;

  // Permission depends on the target state
  if (status === "SENT") {
    requirePermission(ctx, "quotation.send");
  } else if (status === "APPROVED") {
    requirePermission(ctx, "quotation.approve");
  } else {
    requirePermission(ctx, "quotation.update");
  }

  const db = scoped(ctx);
  const q = await db.quotation.findUnique({
    where: { id },
    select: { id: true, status: true, clientId: true },
  });
  if (!q) return { ok: false, error: "Quotation not found" };

  // Valid from → to transitions
  const VALID_TRANSITIONS: Record<string, string[]> = {
    DRAFT:            ["PENDING_APPROVAL", "SENT"],
    PENDING_APPROVAL: ["APPROVED", "DRAFT"],
    APPROVED:         ["SENT"],
    SENT:             ["VIEWED", "ACCEPTED", "REJECTED"],
    VIEWED:           ["ACCEPTED", "REJECTED"],
    ACCEPTED:         [],
    REJECTED:         [],
    REVISED:          ["PENDING_APPROVAL", "SENT"],
    EXPIRED:          [],
  };
  const allowed = VALID_TRANSITIONS[q.status] ?? [];
  if (!allowed.includes(status)) {
    return { ok: false, error: `Cannot move from ${q.status} to ${status}` };
  }

  // When sending, freeze CalcResult snapshots onto each line (§7.7 rule 4 / §15.3)
  if (status === "SENT") {
    const lines = await db.quotationLine.findMany({
      where: { quotationId: id, measurementItemId: { not: null } },
      select: { id: true, measurementItemId: true },
    });
    if (lines.length > 0) {
      const calcResults = await db.calcResult.findMany({
        where: {
          measurementItemId: {
            in: lines.map((l) => l.measurementItemId!).filter(Boolean),
          },
        },
      });
      const calcMap = new Map(calcResults.map((c) => [c.measurementItemId, c]));
      for (const line of lines) {
        const calc = calcMap.get(line.measurementItemId!);
        if (!calc) continue;
        const snapshot = {
          id: calc.id,
          engineVersion: calc.engineVersion,
          materialQty: calc.materialQty.toString(),
          materialUnit: calc.materialUnit,
          widthsRequired: calc.widthsRequired,
          cutLengthMm: calc.cutLengthMm?.toString() ?? null,
          rollsRequired: calc.rollsRequired,
          boxesRequired: calc.boxesRequired,
          areaSqft: calc.areaSqft?.toString() ?? null,
          billableAreaSqft: calc.billableAreaSqft?.toString() ?? null,
          wastagePct: calc.wastagePct?.toString() ?? null,
          fabricRun: calc.fabricRun,
          seamCount: calc.seamCount,
          liningQty: calc.liningQty?.toString() ?? null,
          warnings: calc.warnings,
          computedAt: calc.computedAt.toISOString(),
        };
        await db.quotationLine.update({
          where: { id: line.id },
          data: { calcSnapshot: snapshot },
        });
      }
    }
  }

  await db.quotation.update({
    where: { id },
    data: {
      status,
      ...(status === "SENT"             ? { sentAt: new Date() }                                                  : {}),
      ...(status === "PENDING_APPROVAL" ? { submittedById: ctx.userId, submittedAt: new Date() }                 : {}),
      ...(status === "APPROVED"         ? { approvedById: ctx.userId, approvedAt: new Date(), rejectionReason: null } : {}),
      ...(status === "DRAFT" && q.status === "PENDING_APPROVAL"
                                        ? { rejectionReason: "Returned to draft by approver" }                   : {}),
    },
  });

  // Fire domain events after successful state transition. Listeners in
  // kernel/milestones handle milestone auto-completion and stage advance
  // (see onQuotationAccepted). clientId is nullable now for lead-scoped
  // quotes — the event's clientId falls back to empty string, and the
  // listener guards on projectId before doing anything project-specific.
  if (status === "ACCEPTED") {
    await bus.publish({
      type:        "quotation.accepted",
      orgId:       ctx.orgId,
      actorId:     ctx.userId,
      occurredAt:  new Date(),
      quotationId: id,
      clientId:    q.clientId ?? "",
    });
  }

  revalidatePath("/quotations");
  revalidatePath(`/quotations/${id}`);
  return { ok: true, data: { id } };
}

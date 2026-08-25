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
import { createOrderFromQuotation } from "@/modules/orders/actions";

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
    select: { id: true, status: true, clientId: true, leadId: true, rejectionReason: true },
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

    // Auto-create the Order — spec §5 says an accepted quote converts to
    // an order. The manual "Convert to order" button in StatusChanger
    // stays as a safety net for lead-scoped quotes (need lead conversion
    // first) or if this call fails for any reason. Best-effort — a
    // failure here does NOT roll back the ACCEPTED status.
    try {
      await createOrderFromQuotation({ quotationId: id });
      revalidatePath("/orders");
    } catch (err) {
      console.warn("auto-createOrderFromQuotation failed (owner can still click manually):", err);
    }
  }

  // Owner canonical flow (2026-08-25): "if the client approves the rough
  // estimate they convert; if not they're a lost lead." Fire that
  // transition automatically when the last active rough estimate on a
  // lead gets rejected. Guarded so a lead with another live quote in
  // negotiation stays NEW/QUOTED.
  if (status === "REJECTED" && q.leadId) {
    await maybeMarkLeadLost(db, q.leadId, id, q.rejectionReason);
  }

  revalidatePath("/quotations");
  revalidatePath(`/quotations/${id}`);
  return { ok: true, data: { id } };
}

/** If no other non-terminal quotation exists on this lead, mark it LOST.
 *  Skips leads already WON/LOST — those are terminal. Reason falls back
 *  to a generic "Quote rejected" when the quotation carries no
 *  free-form rejectionReason. Best-effort: failure here does NOT roll
 *  back the quotation transition. */
async function maybeMarkLeadLost(
  db:                  ReturnType<typeof scoped>,
  leadId:              string,
  justRejectedQuoteId: string,
  quoteReason:         string | null,
): Promise<void> {
  try {
    const lead = await db.lead.findUnique({
      where:  { id: leadId },
      select: { stage: true },
    });
    if (!lead) return;
    if (lead.stage === "WON" || lead.stage === "LOST") return;

    const activeOther = await db.quotation.count({
      where: {
        leadId,
        id:     { not: justRejectedQuoteId },
        status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT"] },
      },
    });
    if (activeOther > 0) return;

    const reason = quoteReason?.trim() || "Quotation rejected";
    await db.lead.update({
      where: { id: leadId },
      data:  { stage: "LOST", lostReason: reason },
    });
    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/leads");
  } catch (err) {
    console.warn("auto-mark lead LOST on quote reject failed:", err);
  }
}

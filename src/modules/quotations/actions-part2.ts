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
import { QUOTATION_TRANSITIONS } from "./transitions";
import { ActionResult } from "./actions";
import { createOrderFromQuotation } from "@/modules/orders/actions";

export async function setQuotationStatus(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  const parsed = setStatusSchema.safeParse(input);
  if (!parsed.success) return zodError<{ id: string }>(parsed.error);
  const { id, status } = parsed.data;

  // Permission depends on the target state. Unchanged by the 2026-09-04
  // widening below: a dropdown that lets an operator pick any status
  // must not become a way around quotation.approve, so the gate stays
  // on the TARGET, not on which UI asked for the move (CLAUDE.md #11).
  if (status === "SENT" || status === "ACCEPTED") {
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

  // Valid from → to transitions.
  //
  // Widened 2026-09-04 (owner). The 2026-08-26 map allowed exactly two
  // moves — DRAFT→SENT and SENT→ACCEPTED — because the UI only offered
  // Send and Convert. Real quotes do not stay on that rail: the client
  // agrees over the phone before anyone taps Send, an invoice is raised
  // and paid while the quote still reads "Draft", a quote is superseded
  // and should read Rejected. With nothing else reachable, a quotation
  // that was invoiced and settled sat in Draft forever, which is what
  // the owner reported.
  //
  // What is deliberately still NOT free-for-all:
  //   · every target keeps its own permission gate (see above)
  //   · a status may never move to itself (the UI hides the current one,
  //     and re-firing ACCEPTED would re-run the accept side-effects)
  //   · leaving ACCEPTED is blocked once an Order exists — see below.
  // The map itself lives in ./transitions.ts so the status picker in the
  // UI reads the same list this guard enforces.
  const allowed = QUOTATION_TRANSITIONS[q.status] ?? [];
  if (!allowed.includes(status)) {
    return { ok: false, error: `Cannot move from ${q.status} to ${status}` };
  }

  // Accepting a quotation raises an Order (below). Nothing un-raises one,
  // so moving back out of ACCEPTED once that has happened would leave a
  // live order priced against a quote the app says was rejected. The
  // order has to be cancelled first — the same rule deleteQuotation
  // enforces, worded the same way.
  if (q.status === "ACCEPTED") {
    const orderCount = await db.order.count({ where: { quotationId: id } });
    if (orderCount > 0) {
      return {
        ok: false,
        error: "An order was already raised from this quotation. Cancel the order before changing its status.",
      };
    }
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
      // createOrderFromQuotation is not idempotent — it allocates a new
      // SO number and inserts unconditionally. Now that ACCEPTED is
      // reachable from more than one state (and reachable again after
      // ACCEPTED→REJECTED→ACCEPTED), calling it blind would mint a
      // second order for the same quote. Check first.
      const existingOrders = await db.order.count({ where: { quotationId: id } });
      if (existingOrders === 0) {
        await createOrderFromQuotation({ quotationId: id });
        revalidatePath("/orders");
      }
    } catch (err) {
      console.warn("auto-createOrderFromQuotation failed (owner can still click manually):", err);
    }
  }

  revalidatePath("/quotations");
  revalidatePath(`/quotations/${id}`);
  return { ok: true, data: { id } };
}

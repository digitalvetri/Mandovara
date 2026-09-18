"use server";

// Assigning a client's quotation to one of that client's projects.
//
// Owner instruction, 2026-09-18: a client can have many quotations and
// many projects, and each quotation belongs to one of THAT client's
// projects. The Quotations card on Client 360 now lets it be put on the
// right one — a quote raised against a stub project, or against the
// client before the project existed, can be moved to where it belongs.
//
// Quotation.projectId is not cosmetic. A live quotation is the project's
// agreed value (modules/projects/receivable.ts), so moving one moves what
// each project is owed. That is the point when the quote was on the wrong
// job — but it must not strand money, so this refuses:
//
//   · a project belonging to another client, or a cancelled one;
//   · a quotation an order was raised from — the order, its materials and
//     its make jobs belong to the project already;
//   · an ACCEPTED/CONVERTED quotation whose current project has already
//     taken payments or raised bills — moving the agreement away would
//     leave that money on a job with nothing agreed. Move the payments
//     first (Accounts → the payment → What was this for?), then the quote.
//
// Every revision of the quotation (same number) moves together, so the
// v1 and v2 of one quote never sit on two different projects.
//
// Its own file, like actions-delete.ts, for the §10 line limit. Audit row
// written by hand for the same reason given there.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import type { ActionResult } from "./actions";

const assignSchema = z.object({
  quotationId: z.string().min(1),
  projectId:   z.string().min(1),
});

/** Statuses in which the quotation is the client's agreement. */
const AGREED = new Set(["ACCEPTED", "CONVERTED"]);

export async function assignQuotationToProject(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "quotation.update");

  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Validation failed" };
  const { quotationId, projectId } = parsed.data;

  const db = scoped(ctx);
  const quote = await db.quotation.findUnique({
    where:  { id: quotationId },
    select: { id: true, number: true, status: true, clientId: true, projectId: true },
  });
  if (!quote) return { ok: false, error: "Quotation not found." };
  if (!quote.clientId) {
    return { ok: false, error: "This quotation is still with a lead — it gets a project when the lead becomes a client." };
  }
  if (quote.projectId === projectId) return { ok: true, data: { id: quote.id } };

  const project = await db.project.findUnique({
    where:  { id: projectId },
    select: { id: true, name: true, clientId: true, stage: true },
  });
  if (!project) return { ok: false, error: "That project no longer exists." };
  if (project.clientId !== quote.clientId) {
    return { ok: false, error: "That project belongs to another client." };
  }
  if (project.stage === "CANCELLED") {
    return { ok: false, error: "That project was cancelled — pick another." };
  }

  // Every revision of this quote — they move as one.
  const family = await db.quotation.findMany({
    where:  { number: quote.number },
    select: { id: true, status: true, projectId: true },
  });
  const familyIds = family.map((q) => q.id);

  const orders = await db.order.count({ where: { quotationId: { in: familyIds } } });
  if (orders > 0) {
    return {
      ok: false,
      error: "An order has already been raised from this quotation, so it stays with its project.",
    };
  }

  const oldProjectId = quote.projectId;
  if (oldProjectId && family.some((q) => AGREED.has(q.status))) {
    const [receipts, invoices] = await Promise.all([
      db.receipt.count({
        where: { projectId: oldProjectId, OR: [{ chequeStatus: null }, { chequeStatus: { not: "BOUNCED" } }] },
      }),
      db.invoice.count({ where: { projectId: oldProjectId, status: { not: "CANCELLED" } } }),
    ]);
    if (receipts > 0 || invoices > 0) {
      return {
        ok: false,
        error:
          "The client has accepted this quotation and money has already been taken against its current project. " +
          "Move those payments to the right project first, then move the quotation.",
      };
    }
  }

  await withTransaction(async (tx: TxClient) => {
    await tx.quotation.updateMany({
      where: { id: { in: familyIds }, organizationId: ctx.orgId },
      data:  { projectId: project.id },
    });
    await tx.auditLog.create({
      data: {
        organizationId: ctx.orgId,
        actorId:        ctx.userId,
        entityType:     "Quotation",
        entityId:       quote.id,
        action:         "ASSIGN_PROJECT",
        before:         { number: quote.number, projectId: oldProjectId },
        after:          { number: quote.number, projectId: project.id, revisions: familyIds },
      },
    });
  }, { orgId: ctx.orgId });

  revalidatePath(`/clients/${quote.clientId}`);
  revalidatePath("/quotations");
  for (const id of familyIds) revalidatePath(`/quotations/${id}`);
  revalidatePath("/projects");
  revalidatePath(`/projects/${project.id}`);
  if (oldProjectId) revalidatePath(`/projects/${oldProjectId}`);
  revalidatePath("/accounts");
  return { ok: true, data: { id: quote.id } };
}

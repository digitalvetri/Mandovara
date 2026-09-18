"use server";

// Give — or take back — a settlement discount on a project.
//
// Owner instruction, 2026-09-18: "some times the client will close the
// money like getting discount after settling some amount … that should be
// only given by the admin". The client pays most of the quote and the
// studio lets the rest go; this records the amount let go so the job stops
// reading as money still to collect.
//
// Gated on project.discount, which no seeded role carries: the Owner has it
// through isOwnerRole, and it can be granted to anyone else from Admin &
// Roles. Enforced here, not only by hiding the button (CLAUDE.md #11).
//
// Only before the job is billed. The tax invoice raised afterwards bills
// the discounted amount (see /invoicing/create), which is how a discount
// agreed before invoicing is meant to reach GST. Once an invoice exists the
// same thing has to be a credit note against it, so this refuses and says so.
//
// The rules on the amount are a pure function, settlementDiscountProblem in
// kernel/money/settlement.ts, where they are tested. Every set and clear
// writes an AuditLog row by hand — scoped()'s audit extension does not see
// a raw transaction client (see quotations/actions-delete.ts).

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { parseINR } from "@/kernel/money/format";
import { settlementDiscountProblem } from "@/kernel/money/settlement";
import { devContext } from "@/lib/dev-context";
import { getProjectReceivable } from "./receivable";
import type { ActionResult } from "./actions";

const setSchema = z.object({
  projectId: z.string().min(1),
  /** Rupees as typed — "7410", "7,410.50". Parsed to paise, never a float. */
  amount:    z.string().trim().min(1, "Enter the discount amount").max(20),
  reason:    z.string().trim().min(3, "Say why the discount was given").max(300),
});

const clearSchema = z.object({
  projectId: z.string().min(1),
});

type Db = ReturnType<typeof scoped>;

/** The project, or the reason nothing can be changed on it. */
async function loadEditable(
  db: Db, projectId: string,
): Promise<
  | { ok: true; project: { id: string; clientId: string; settlementDiscount: bigint; settlementReason: string | null } }
  | { ok: false; error: string }
> {
  const project = await db.project.findUnique({
    where:  { id: projectId },
    select: { id: true, clientId: true, stage: true, settlementDiscount: true, settlementReason: true },
  });
  if (!project) return { ok: false, error: "Project not found." };
  if (project.stage === "CANCELLED") return { ok: false, error: "This project was cancelled." };

  const invoices = await db.invoice.count({ where: { projectId, status: { not: "CANCELLED" } } });
  if (invoices > 0) {
    return {
      ok: false,
      error: "This job has already been billed. Give the discount as a credit note on its invoice instead.",
    };
  }
  return { ok: true, project };
}

function revalidate(projectId: string, clientId: string): void {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/accounts");
}

export async function setProjectDiscount(
  input: unknown,
): Promise<ActionResult<{ discount: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "project.discount");

  const parsed = setSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue?.message ?? "Validation failed",
      fieldErrors: issue ? { [String(issue.path[0] ?? "")]: issue.message } : {},
    };
  }
  const d = parsed.data;

  let discount: bigint;
  try {
    discount = parseINR(d.amount);
  } catch {
    return { ok: false, error: "Could not read that amount", fieldErrors: { amount: "Could not read that amount" } };
  }

  const db = scoped(ctx);
  const loaded = await loadEditable(db, d.projectId);
  if (!loaded.ok) return loaded;
  const { project } = loaded;

  const receivable = await getProjectReceivable(db, project.id);
  const problem = settlementDiscountProblem(
    receivable?.agreedValue ?? 0n,
    receivable?.received    ?? 0n,
    discount,
  );
  if (problem) return { ok: false, error: problem, fieldErrors: { amount: problem } };

  await withTransaction(async (tx: TxClient) => {
    await tx.project.update({
      where: { id: project.id },
      data: {
        settlementDiscount: discount,
        settlementReason:   d.reason,
        settlementAt:       new Date(),
        settlementById:     ctx.userId,
      },
    });
    await tx.auditLog.create({
      data: {
        organizationId: ctx.orgId,
        actorId:        ctx.userId,
        entityType:     "Project",
        entityId:       project.id,
        action:         "SETTLEMENT_DISCOUNT_SET",
        before: {
          settlementDiscount: project.settlementDiscount.toString(),
          settlementReason:   project.settlementReason,
        },
        after: {
          settlementDiscount: discount.toString(),
          settlementReason:   d.reason,
          agreedValue:        (receivable?.agreedValue ?? 0n).toString(),
          received:           (receivable?.received ?? 0n).toString(),
        },
      },
    });
  }, { orgId: ctx.orgId });

  revalidate(project.id, project.clientId);
  return { ok: true, data: { discount: discount.toString() } };
}

/** Take a discount back — it was entered by mistake, or the client paid after all. */
export async function clearProjectDiscount(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "project.discount");

  const parsed = clearSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Validation failed" };

  const db = scoped(ctx);
  const loaded = await loadEditable(db, parsed.data.projectId);
  if (!loaded.ok) return loaded;
  const { project } = loaded;
  if (project.settlementDiscount === 0n) return { ok: true, data: { id: project.id } };

  await withTransaction(async (tx: TxClient) => {
    await tx.project.update({
      where: { id: project.id },
      data:  { settlementDiscount: 0n, settlementReason: null, settlementAt: null, settlementById: null },
    });
    await tx.auditLog.create({
      data: {
        organizationId: ctx.orgId,
        actorId:        ctx.userId,
        entityType:     "Project",
        entityId:       project.id,
        action:         "SETTLEMENT_DISCOUNT_CLEAR",
        before: {
          settlementDiscount: project.settlementDiscount.toString(),
          settlementReason:   project.settlementReason,
        },
      },
    });
  }, { orgId: ctx.orgId });

  revalidate(project.id, project.clientId);
  return { ok: true, data: { id: project.id } };
}

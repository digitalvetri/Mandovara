"use server";

// Attaching a payment to the job it was paid against, after the fact.
//
// Owner, 2026-09-11: money shows in Accounts → Received as "Not linked yet"
// and there was no way to say what it was for. The payment sheet asks the
// question at entry (PaymentSheetTarget), but a payment recorded before that
// existed — or entered in a hurry — had nothing behind it and no way to fix
// it afterwards. This is that fix.
//
// "Link to the quotation" in the owner's words is `Receipt.projectId` in the
// schema: the quotation is the agreement, the project carries it, and the
// project is what every money screen totals against (modules/projects/
// receivable.ts). Setting it makes the payment count towards that job's
// agreed value immediately, and sweepProjectReceiptsOntoInvoice moves it onto
// the tax invoice when one is finally raised — exactly as if the payment had
// been recorded against the job in the first place.
//
// Its own file rather than an addition to actions.ts, which is at the §10
// 300-line boundary — the same reason actions-cheque.ts exists.

import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { checkGateForReceipt } from "@/modules/projects/advance-gate";
import { linkReceiptSchema } from "./schema";
import type { ActionResult } from "./actions";

export async function linkReceiptToProject(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "receipt.allocate");

  const parsed = linkReceiptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Validation failed" };
  const { id, projectId } = parsed.data;

  const db = scoped(ctx);
  const receipt = await db.receipt.findUnique({
    where:  { id },
    select: { id: true, clientId: true, chequeStatus: true, projectId: true },
  });
  if (!receipt) return { ok: false, error: "Payment not found." };

  // A bounced cheque is money that never arrived. Attaching it to a job would
  // credit that job with a payment it never received — the same reason
  // getProjectReceivable excludes BOUNCED receipts outright.
  if (receipt.chequeStatus === "BOUNCED") {
    return {
      ok: false,
      error: "This cheque bounced — the money never arrived, so it cannot be put against a job.",
    };
  }

  // Same two checks createReceipt makes on the way in, for the same reasons:
  // the money must not land on another client's job, and a cancelled job is
  // not somewhere money should be placed.
  if (projectId) {
    const project = await db.project.findUnique({
      where:  { id: projectId },
      select: { id: true, clientId: true, stage: true },
    });
    if (!project) return { ok: false, error: "That job no longer exists." };
    if (project.clientId !== receipt.clientId) {
      return { ok: false, error: "That job belongs to another client." };
    }
    if (project.stage === "CANCELLED") {
      return { ok: false, error: "That job was cancelled — pick another." };
    }
  }

  await db.receipt.update({ where: { id }, data: { projectId } });

  // Linking money to a job can be what finally meets its required advance, so
  // the stage gate gets the same look-in createReceipt gives it. Best-effort.
  const gated = await checkGateForReceipt(db, {
    receiptProjectId: projectId,
    invoiceIds:       [],
  });

  revalidatePath("/accounts");
  revalidatePath(`/accounts/${id}`);
  revalidatePath("/projects");
  revalidatePath(`/clients/${receipt.clientId}`);
  for (const pid of new Set([...gated, projectId, receipt.projectId].filter((p): p is string => !!p))) {
    revalidatePath(`/projects/${pid}`);
  }
  return { ok: true, data: { id } };
}

"use server";

// Deleting an invoice.
//
// The owner asked for a Delete option in the invoice row menu
// (2026-08-29). What that can safely mean depends entirely on whether
// the invoice was ever issued:
//
//   DRAFT      → nothing has left the building. A genuine delete.
//   Everything → a tax invoice is a statutory record. Removing an
//   else         issued one breaks the number sequence, the GST return
//                that already reported it, and any receipt allocated
//                against it. The lawful correction is a cancellation or
//                a credit note, both of which this module already has.
//
// So the menu item is honest about which one you get, and the server
// refuses the dangerous case rather than trusting the UI to hide it.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";

export interface ActionResult<T = unknown> {
  ok: boolean; data?: T; error?: string;
}

const schema = z.object({ id: z.string().trim().min(1) });

export async function deleteInvoice(input: unknown): Promise<ActionResult> {
  const ctx = await devContext();
  // No `invoice.delete` key exists in the catalogue; cancel is the
  // nearest existing authority and covers the same blast radius.
  requirePermission(ctx, "invoice.cancel");

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { id } = parsed.data;

  const db = scoped(ctx);
  const inv = await db.invoice.findUnique({
    where:  { id },
    select: { id: true, status: true, number: true },
  });
  if (!inv) return { ok: false, error: "Invoice not found." };

  if (inv.status !== "DRAFT") {
    return {
      ok: false,
      error: `${inv.number} has been issued and cannot be deleted — a tax invoice is a statutory record. Cancel it, or raise a credit note.`,
    };
  }

  // A receipt should never be allocated to a draft, but check rather
  // than assume: an orphaned allocation would corrupt the ledger.
  const allocations = await db.receiptAllocation.count({ where: { invoiceId: id } });
  if (allocations > 0) {
    return { ok: false, error: "Money is already allocated to this invoice — cancel it instead." };
  }

  await db.$transaction([
    db.invoiceLine.deleteMany({ where: { invoiceId: id } }),
    db.invoice.delete({ where: { id } }),
  ]);

  revalidatePath("/invoicing");
  return { ok: true };
}

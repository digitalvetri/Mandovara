"use server";

// Ticking an item off the verification queue.
//
// A tick records WHAT THE LABEL SAID, not merely that someone looked.
// The brand and collection are the entire reason the trip to the
// showroom happens — without them nobody can create the catalogue entry
// afterwards, and the item comes straight back onto the list next month.
// Both are optional on the action so a partial answer is still better
// than none, but the form asks for them.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";

export interface ActionResult<T = unknown> {
  ok: boolean; data?: T; error?: string;
}

const verifySchema = z.object({
  id:         z.string().min(1),
  brand:      z.string().trim().max(120).optional(),
  collection: z.string().trim().max(120).optional(),
  note:       z.string().trim().max(500).optional(),
});

export async function verifyPendingItem(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  // Same permission as adjusting stock: confirming what a roll actually is
  // is the decision that lets it become stock.
  requirePermission(ctx, "inventory.adjust");

  const parsed = verifySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Could not read that — check the fields and try again." };
  const d = parsed.data;

  const db = scoped(ctx);
  const found = await db.pendingStockItem.findUnique({ where: { id: d.id }, select: { id: true } });
  if (!found) return { ok: false, error: "That item is no longer on the list." };

  await db.pendingStockItem.update({
    where: { id: d.id },
    data: {
      status:          "VERIFIED",
      foundBrand:      d.brand || null,
      foundCollection: d.collection || null,
      note:            d.note || null,
      verifiedById:    ctx.userId,
      verifiedAt:      new Date(),
    },
  });

  revalidatePath("/inventory/pending");
  return { ok: true, data: { id: d.id } };
}

const discardSchema = z.object({
  id:   z.string().min(1),
  note: z.string().trim().max(500).optional(),
});

/**
 * Close an item without importing it — the roll is not there, or nobody
 * can identify it. Kept as a distinct outcome from VERIFIED so "we
 * checked and it is a Faith wallpaper" and "we checked and it does not
 * exist" never read the same in a month's time.
 */
export async function discardPendingItem(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "inventory.adjust");

  const parsed = discardSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Could not read that." };

  const db = scoped(ctx);
  await db.pendingStockItem.updateMany({
    where: { id: parsed.data.id },
    data: {
      status:       "DISCARDED",
      note:         parsed.data.note || null,
      verifiedById: ctx.userId,
      verifiedAt:   new Date(),
    },
  });

  revalidatePath("/inventory/pending");
  return { ok: true, data: { id: parsed.data.id } };
}

/** Put an item back on the list — people tick the wrong row. */
export async function reopenPendingItem(id: string): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "inventory.adjust");

  const db = scoped(ctx);
  await db.pendingStockItem.updateMany({
    where: { id },
    data: {
      status: "PENDING",
      // Clear the answer too. Leaving a stale brand on a reopened row is
      // how someone later "confirms" something nobody actually checked.
      foundBrand: null, foundCollection: null, note: null,
      verifiedById: null, verifiedAt: null,
    },
  });

  revalidatePath("/inventory/pending");
  return { ok: true, data: { id } };
}

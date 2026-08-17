"use server";

// Server actions triggered by chase-list row buttons in /accounts.
//
// - recordPromise: client says "I'll pay Tuesday"; suppresses their row
//   from the chase list until that date. If the date passes without
//   payment the row resurfaces flagged "missed" (upstream).
// - logChaseContact: fired when Rohit taps WhatsApp or Call; bumps
//   Client.lastContactedAt so the contact-penalty tier updates.
// - cancelPromise: revoke a promise the owner made in error.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { orgPrisma } from "@/kernel/db/rls";
import { withTransaction } from "@/kernel/db/transaction";
import { devContext } from "@/lib/dev-context";
import { requirePermission } from "@/kernel/rbac/guard";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

// ── recordPromise ─────────────────────────────────────────────────

const recordPromiseSchema = z.object({
  clientId:     z.string().min(1),
  invoiceId:    z.string().min(1).optional(),
  promisedDate: z.string().min(10),   // ISO date (yyyy-mm-dd)
  note:         z.string().max(500).optional(),
});

export async function recordPromise(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = recordPromiseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const ctx = await devContext();
    requirePermission(ctx, "receipt.create");   // same permission that lets you take a payment

    const d = parsed.data;
    const promisedDate = new Date(`${d.promisedDate}T00:00:00Z`);
    if (Number.isNaN(promisedDate.getTime())) {
      return { ok: false, error: "Invalid date" };
    }

    // Cancel any existing ACTIVE promise for this client first — the new
    // one supersedes it. Keeps "one active promise per client" invariant.
    await withTransaction(async (tx) => {
      await tx.promiseToPay.updateMany({
        where: { organizationId: ctx.orgId, clientId: d.clientId, status: "ACTIVE" },
        data:  { status: "CANCELLED", resolvedAt: new Date(), resolvedById: ctx.userId },
      });
    }, { orgId: ctx.orgId });

    const promise = await orgPrisma(ctx.orgId).promiseToPay.create({
      data: {
        organizationId: ctx.orgId,
        clientId:       d.clientId,
        invoiceId:      d.invoiceId ?? null,
        promisedDate,
        note:           d.note ?? null,
        status:         "ACTIVE",
        createdById:    ctx.userId,
      },
      select: { id: true },
    });

    revalidatePath("/accounts");
    return { ok: true, data: { id: promise.id } };
  } catch (e) {
    console.error("[accounts] recordPromise failed:", e);
    return { ok: false, error: "Could not save promise. Please try again." };
  }
}

// ── logChaseContact ───────────────────────────────────────────────

const logContactSchema = z.object({
  clientId: z.string().min(1),
  channel:  z.enum(["WHATSAPP", "CALL"]),
});

export async function logChaseContact(input: unknown): Promise<ActionResult<null>> {
  const parsed = logContactSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    const ctx = await devContext();
    requirePermission(ctx, "receipt.view");

    const now = new Date();
    await orgPrisma(ctx.orgId).client.update({
      where: { id: parsed.data.clientId },
      data:  { lastContactedAt: now },
    });

    // TODO Phase 6: also write a CommunicationLog row so we have the
    // per-message history. For now the timestamp bump alone is enough
    // to drop the client off the chase list for today.

    revalidatePath("/accounts");
    return { ok: true, data: null };
  } catch (e) {
    console.error("[accounts] logChaseContact failed:", e);
    return { ok: false, error: "Could not log contact — the WhatsApp will still open." };
  }
}

// ── cancelPromise ─────────────────────────────────────────────────

export async function cancelPromise(promiseId: string): Promise<ActionResult<null>> {
  if (!promiseId) return { ok: false, error: "Missing promise id" };

  try {
    const ctx = await devContext();
    requirePermission(ctx, "receipt.create");

    await orgPrisma(ctx.orgId).promiseToPay.update({
      where: { id: promiseId },
      data:  {
        status:       "CANCELLED",
        resolvedAt:   new Date(),
        resolvedById: ctx.userId,
      },
    });
    revalidatePath("/accounts");
    return { ok: true, data: null };
  } catch (e) {
    console.error("[accounts] cancelPromise failed:", e);
    return { ok: false, error: "Could not cancel promise." };
  }
}

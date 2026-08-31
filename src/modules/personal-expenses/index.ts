"use server";

// My own spending — fuel, food, groceries, rent.
//
// A private notebook that happens to live in the same app. Every query and
// every write filters on ctx.userId as well as the org, so two owners in
// one organization never see each other's rows. There is no permission key
// and no approval flow, because this is nobody's business but the person
// who wrote it down.
//
// Money is BigInt paise like everything else here. Never a float — a
// grocery bill deserves the same arithmetic as an invoice.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { devContext } from "@/lib/dev-context";
import type { PersonalSummary } from "./shared";

export interface ActionResult<T = unknown> {
  ok: boolean; data?: T; error?: string; fieldErrors?: Record<string, string>;
}

const createSchema = z.object({
  category: z.string().trim().min(1, "Pick or type what it was for").max(40),
  note:     z.string().trim().max(200).optional(),
  /** Paise, as a string — BigInt does not survive a form post. */
  amount:   z.string().regex(/^\d+$/, "Enter an amount"),
  spentAt:  z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Pick a date"),
});

export async function listPersonalExpenses(
  months = 1,
): Promise<PersonalSummary> {
  const ctx = await devContext();
  const db  = scoped(ctx);

  const from = new Date();
  from.setMonth(from.getMonth() - months);
  from.setHours(0, 0, 0, 0);

  const rows = await db.personalExpense.findMany({
    where:   { userId: ctx.userId, spentAt: { gte: from } },
    orderBy: { spentAt: "desc" },
    take:    500,
    select:  { id: true, category: true, note: true, amount: true, spentAt: true },
  });

  let total = 0n;
  const buckets = new Map<string, bigint>();
  for (const r of rows) {
    total += r.amount;
    buckets.set(r.category, (buckets.get(r.category) ?? 0n) + r.amount);
  }

  const byCategory = [...buckets.entries()]
    .map(([category, t]) => ({ category, total: t }))
    .sort((a, b) => (b.total > a.total ? 1 : b.total < a.total ? -1 : 0));

  return { rows, total, byCategory };
}

export async function addPersonalExpense(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[i.path.join(".")] = i.message;
    return { ok: false, error: "Check the highlighted fields", fieldErrors };
  }
  const d = parsed.data;

  const amount = BigInt(d.amount);
  if (amount <= 0n) return { ok: false, error: "Enter an amount greater than zero." };

  const db  = scoped(ctx);
  const row = await db.personalExpense.create({
    data: {
      organizationId: ctx.orgId,
      userId:         ctx.userId,
      category:       d.category,
      amount,
      spentAt:        new Date(d.spentAt),
      ...(d.note ? { note: d.note } : {}),
    },
    select: { id: true },
  });

  revalidatePath("/my-expenses");
  return { ok: true, data: { id: row.id } };
}

export async function deletePersonalExpense(id: string): Promise<ActionResult> {
  const ctx = await devContext();
  const db  = scoped(ctx);

  // Scoped to the caller as well as the org: nobody deletes anyone else's
  // notebook entry, even inside the same organization.
  const { count } = await db.personalExpense.deleteMany({
    where: { id, userId: ctx.userId },
  });
  if (count === 0) return { ok: false, error: "That entry is already gone." };

  revalidatePath("/my-expenses");
  return { ok: true };
}

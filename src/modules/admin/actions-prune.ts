"use server";

// Removing the accounts that came with the install.
//
// Owner, 2026-08-30: "see all the users name are there in lead assigning
// place and also in site vist assignment page i dont want i need to remove
// them". The dropdowns are not wrong — listSalesUsers and
// listAssignableUsers both list whoever is ACTIVE, and the seeded demo
// staff are still ACTIVE. The names go when the accounts go.
//
// /api/admin/prune-users already did this, but it is gated by IMPORT_TOKEN
// and driven by curl, which is the wrong instrument for someone sitting in
// front of the app. This is the same operation for a signed-in owner:
// no token, no terminal, and the person to keep is not typed at all — it
// is whoever is running it, which removes the two ways the curl could go
// wrong (naming an address that does not exist yet, or naming the wrong
// one and deleting your own way in).
//
// Two calls on purpose. Nothing is destroyed by the one that shows you the
// list.

import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";

export interface ActionResult<T = unknown> {
  ok: boolean; data?: T; error?: string;
}

export interface CleanupPreview {
  /** The signed-in owner, who is never in the removal list. */
  keeping:  { name: string; email: string | null; role: string };
  /** Every other account. */
  accounts: { id: string; name: string; email: string | null; role: string }[];
  /** Staff records that would go with them, plus any with no login at all. */
  staff:    { id: string; code: string; name: string }[];
}

/** Who would be removed. Reads only — nothing is deleted here. */
export async function previewAccountCleanup(): Promise<ActionResult<CleanupPreview>> {
  const ctx = await devContext();
  requirePermission(ctx, "admin.users");
  const db = scoped(ctx);

  const me = await db.user.findUnique({
    where:  { id: ctx.userId },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!me) return { ok: false, error: "Could not identify your own account." };

  const accounts = await db.user.findMany({
    where:   { NOT: { id: ctx.userId } },
    select:  { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });

  // Staff records belonging to those accounts, and any that never had a
  // login — both are people the owner did not add.
  const staff = await db.employee.findMany({
    where:   { OR: [{ userId: null }, { userId: { in: accounts.map((a) => a.id) } }] },
    select:  { id: true, code: true, name: true },
    orderBy: { name: "asc" },
  });

  return {
    ok: true,
    data: {
      keeping:  { name: me.name, email: me.email, role: me.role },
      accounts,
      staff,
    },
  };
}

/**
 * Delete every account except the one running this, and the staff records
 * that belong to them.
 *
 * Your own account cannot be caught by it: the query excludes ctx.userId,
 * so there is no argument to get wrong and no way to remove your own way
 * back in.
 */
export async function removeOtherAccounts(): Promise<
  ActionResult<{ accountsRemoved: number; staffRemoved: number }>
> {
  const ctx = await devContext();
  requirePermission(ctx, "admin.users");
  const db = scoped(ctx);

  const others = await db.user.findMany({
    where:  { NOT: { id: ctx.userId } },
    select: { id: true },
  });
  const otherIds = others.map((u) => u.id);

  // Staff first: an Employee row pointing at a deleted user is a person who
  // cannot sign in and whom nobody added. Nothing holds a foreign key to
  // User, so ordering here is about leaving a sensible state rather than
  // satisfying the database.
  const staff = await db.employee.deleteMany({
    where: { OR: [{ userId: null }, { userId: { in: otherIds } }] },
  });
  const accounts = otherIds.length
    ? await db.user.deleteMany({ where: { id: { in: otherIds } } })
    : { count: 0 };

  revalidatePath("/admin");
  revalidatePath("/leads");
  revalidatePath("/site-visits");
  return { ok: true, data: { accountsRemoved: accounts.count, staffRemoved: staff.count } };
}

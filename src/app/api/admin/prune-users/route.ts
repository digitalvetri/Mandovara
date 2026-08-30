// Remove the leftover demo logins, keeping named accounts. Gated by IMPORT_TOKEN.
//
// The 2026-08-30 wipe cleared Employee but deliberately kept User, so the
// seeded demo staff survived as logins with no staff record. They still
// appear in every "assign to" picker, and there is no screen that can
// delete a user — the users table was removed from Admin & Roles on
// 2026-08-29, and the Employees list can only delete an Employee.
//
// Owner, 2026-08-30: "delete the 10 , keep Rohit and i will create all new
// employee".
//
// A keep-list rather than a delete-list on purpose: the accounts to remove
// include at least one whose address nobody has written down, and naming
// the two or three to keep is something the owner can verify by reading.
//
// Dry run unless you ask for the real thing, so the list can be checked
// before anything is destroyed:
//
//   curl -X POST https://<host>/api/admin/prune-users \
//     -H "X-Import-Token: $IMPORT_TOKEN" -H "Content-Type: application/json" \
//     -d '{"keepEmails":["mandovara22@gmail.com"]}'
//
//   ...then repeat with "confirm": true to actually delete.
//
// Safe to delete: no table declares a Prisma relation to User, so nothing
// holds a foreign key against these rows. Records that reference a removed
// person by id (an audit entry, an old lead) keep the id and simply resolve
// to no name, exactly as they already do for any missing user.

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { authBootstrapPrisma } from "@/kernel/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const provided = req.headers.get("x-import-token");
  const expected = process.env["IMPORT_TOKEN"];
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  interface Body {
    keepEmails?: string[];
    admin?: { email?: string; password?: string };
    confirm?: boolean;
  }
  let body: Body;
  try {
    body = await req.json() as Body;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const db = authBootstrapPrisma;
  let all = await db.user.findMany({
    select: { id: true, name: true, email: true, mobile: true, role: true, status: true },
    orderBy: { name: "asc" },
  });

  // ── "Leave exactly this one administrator" ──────────────────────────
  //
  // The two-step version of this (move the address with reset-password,
  // then prune by that address) has an ordering trap: run the prune first,
  // or name the new address before the move, and the keep-list matches
  // nothing. Naming the administrator you want to END UP with removes the
  // ordering entirely — it promotes whichever account is the owner today,
  // sets the address and password on it, and deletes the rest. Running it
  // twice changes nothing the second time.
  const wantAdmin = body.admin?.email?.trim().toLowerCase();
  const wantPassword = body.admin?.password;
  let promote: (typeof all)[number] | undefined;

  if (wantAdmin) {
    if (!wantPassword || wantPassword.length < 8) {
      return NextResponse.json(
        { error: "admin.password is required with admin.email (min 8 characters)." },
        { status: 400 },
      );
    }
    promote =
      all.find((u) => u.email?.toLowerCase() === wantAdmin) ??
      all.find((u) => u.role === "OWNER" && u.status === "ACTIVE");
    if (!promote) {
      return NextResponse.json(
        {
          error: "No account matches that address and no active OWNER exists to promote.",
          existingAccounts: all.map((u) => `${u.name} <${u.email ?? "no email"}> ${u.role}`),
        },
        { status: 400 },
      );
    }
  }

  const keep = wantAdmin
    ? [wantAdmin]
    : (body.keepEmails ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (keep.length === 0) {
    return NextResponse.json(
      { error: "Give either keepEmails, or admin: { email, password }." },
      { status: 400 },
    );
  }

  // With an admin named, the account being promoted counts as kept even
  // though it does not carry that address yet.
  if (promote) {
    all = all.map((u) => (u.id === promote!.id ? { ...u, email: wantAdmin!, role: "OWNER" as const, status: "ACTIVE" as const } : u));
  }

  const kept   = all.filter((u) => u.email && keep.includes(u.email.toLowerCase()));
  const doomed = all.filter((u) => !(u.email && keep.includes(u.email.toLowerCase())));

  // Every address in the keep-list has to match something, or a typo would
  // quietly promote itself into "delete everyone".
  const matched = new Set(kept.map((u) => u.email?.toLowerCase()));
  const unmatched = keep.filter((e) => !matched.has(e));
  if (unmatched.length > 0) {
    return NextResponse.json(
      {
        error: `No account matches: ${unmatched.join(", ")}. Nothing was deleted.`,
        existingEmails: all.map((u) => u.email ?? `(no email) ${u.name}`),
      },
      { status: 400 },
    );
  }

  // Never leave the org without a way in.
  if (!kept.some((u) => u.role === "OWNER" && u.status === "ACTIVE")) {
    return NextResponse.json(
      { error: "The keep-list has no active OWNER. Refusing — that would lock everyone out." },
      { status: 400 },
    );
  }

  // Staff records with no login of their own. In admin mode the intent is
  // "leave exactly this one person", so the roster goes too — otherwise the
  // Employees screen still lists people the owner never added and cannot
  // sign in as. Counted here so the dry run shows it before it happens.
  const keptUserIds = new Set(kept.map((u) => u.id));
  const strayEmployees = wantAdmin
    ? await db.employee.findMany({
        where:  { OR: [{ userId: null }, { userId: { notIn: [...keptUserIds] } }] },
        select: { id: true, code: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  const summary = {
    keeping:  kept.map((u) => `${u.name} <${u.email}> ${u.role}`),
    deleting: doomed.map((u) => `${u.name} <${u.email ?? "no email"}> ${u.role}`),
    ...(promote ? { promoting: `${promote.name} → ${wantAdmin} (OWNER, password reset)` } : {}),
    ...(strayEmployees.length
      ? { alsoRemovingStaffRecords: strayEmployees.map((e) => `${e.code} ${e.name}`) }
      : {}),
  };

  if (!body.confirm) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      ...summary,
      note: "Nothing deleted. Repeat with \"confirm\": true to apply.",
    });
  }

  // Promote first. If the delete ran first and the promote then failed, the
  // org would be left with one account nobody has the password to.
  if (promote && wantAdmin && wantPassword) {
    const clash = await db.user.findFirst({
      where:  { email: wantAdmin, NOT: { id: promote.id } },
      select: { id: true },
    });
    if (clash) {
      return NextResponse.json(
        { error: `Another account already uses ${wantAdmin}. Nothing was changed.` },
        { status: 409 },
      );
    }
    await db.user.update({
      where: { id: promote.id },
      data: {
        email:              wantAdmin,
        passwordHash:       await bcrypt.hash(wantPassword, 12),
        role:               "OWNER",
        status:             "ACTIVE",
        mustChangePassword: false,
      },
    });
  }

  const ids = doomed.map((u) => u.id);
  // Their staff records go with them: an Employee whose userId points at a
  // deleted login is a person who cannot sign in and whom nobody added.
  // In admin mode this also takes the roster-only records listed above.
  const employees = await db.employee.deleteMany({
    where: strayEmployees.length
      ? { id: { in: strayEmployees.map((e) => e.id) } }
      : { userId: { in: ids } },
  });
  const users = await db.user.deleteMany({ where: { id: { in: ids } } });

  return NextResponse.json({
    ok: true,
    dryRun: false,
    deletedUsers:     users.count,
    deletedEmployees: employees.count,
    ...summary,
  });
}

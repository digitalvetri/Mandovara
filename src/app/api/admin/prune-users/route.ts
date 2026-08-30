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
import { authBootstrapPrisma } from "@/kernel/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const provided = req.headers.get("x-import-token");
  const expected = process.env["IMPORT_TOKEN"];
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { keepEmails?: string[]; confirm?: boolean };
  try {
    body = await req.json() as { keepEmails?: string[]; confirm?: boolean };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const keep = (body.keepEmails ?? [])
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (keep.length === 0) {
    return NextResponse.json(
      { error: "keepEmails must list at least one address to keep." },
      { status: 400 },
    );
  }

  const db = authBootstrapPrisma;
  const all = await db.user.findMany({
    select: { id: true, name: true, email: true, mobile: true, role: true, status: true },
    orderBy: { name: "asc" },
  });

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

  const summary = {
    keeping:  kept.map((u) => `${u.name} <${u.email}> ${u.role}`),
    deleting: doomed.map((u) => `${u.name} <${u.email ?? "no email"}> ${u.role}`),
  };

  if (!body.confirm) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      ...summary,
      note: "Nothing deleted. Repeat with \"confirm\": true to apply.",
    });
  }

  const ids = doomed.map((u) => u.id);
  // Their staff records go with them: an Employee whose userId points at a
  // deleted login is a person who cannot sign in and whom nobody added.
  const employees = await db.employee.deleteMany({ where: { userId: { in: ids } } });
  const users     = await db.user.deleteMany({ where: { id: { in: ids } } });

  return NextResponse.json({
    ok: true,
    dryRun: false,
    deletedUsers:     users.count,
    deletedEmployees: employees.count,
    ...summary,
  });
}

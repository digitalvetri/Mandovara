// Reset a specific user's password by email — gated by IMPORT_TOKEN.
//
// Usage:
//   curl -X POST https://<host>/api/admin/reset-password \
//     -H "X-Import-Token: $IMPORT_TOKEN" \
//     -H "Content-Type: application/json" \
//     -d '{"email":"someone@example.com","newPassword":"YourNewPassword@2026"}'
//
// `newEmail` optionally moves the account to a different login address at
// the same time. That exists because changing the administrator's own
// address otherwise needed a database session: the in-app profile form
// can do it, but only once you are already signed in as that account,
// which is no help when the address itself is what you are changing.
//
//   -d '{"email":"old@example.com","newEmail":"new@example.com","newPassword":"..."}'

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

  let body: { email?: string; newEmail?: string; newPassword?: string };
  try {
    body = await req.json() as { email?: string; newEmail?: string; newPassword?: string };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { email, newEmail, newPassword } = body;
  if (!email || !newPassword || newPassword.length < 8) {
    return NextResponse.json(
      { error: "email and newPassword (min 8 chars) are required" },
      { status: 400 },
    );
  }

  const db           = authBootstrapPrisma;
  const passwordHash = await bcrypt.hash(newPassword, 12);
  const nextEmail    = newEmail?.trim().toLowerCase();

  // Moving the address onto one that another account already holds would
  // leave two rows answering the same login, so refuse rather than create
  // an ambiguous sign-in.
  if (nextEmail && nextEmail !== email.trim().toLowerCase()) {
    const clash = await db.user.findFirst({
      where:  { email: nextEmail },
      select: { id: true },
    });
    if (clash) {
      return NextResponse.json(
        { error: `Another account already uses ${nextEmail}.` },
        { status: 409 },
      );
    }
  }

  const result = await db.user.updateMany({
    where: { email },
    data:  nextEmail ? { passwordHash, email: nextEmail } : { passwordHash },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: `No user found with email: ${email}` }, { status: 404 });
  }

  return NextResponse.json({
    ok:    true,
    email: nextEmail ?? email,
    note:  nextEmail
      ? `Updated ${result.count} account(s). Sign in with ${nextEmail}.`
      : `Password updated for ${result.count} account(s). You can now log in.`,
  });
}

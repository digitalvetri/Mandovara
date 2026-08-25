// Reset a specific user's password by email — gated by IMPORT_TOKEN.
//
// Usage:
//   curl -X POST https://<host>/api/admin/reset-password \
//     -H "X-Import-Token: $IMPORT_TOKEN" \
//     -H "Content-Type: application/json" \
//     -d '{"email":"rohit@mandovara.com","newPassword":"YourNewPassword@2026"}'

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

  let body: { email?: string; newPassword?: string };
  try {
    body = await req.json() as { email?: string; newPassword?: string };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { email, newPassword } = body;
  if (!email || !newPassword || newPassword.length < 8) {
    return NextResponse.json(
      { error: "email and newPassword (min 8 chars) are required" },
      { status: 400 },
    );
  }

  const db           = authBootstrapPrisma;
  const passwordHash = await bcrypt.hash(newPassword, 12);

  const result = await db.user.updateMany({
    where: { email },
    data:  { passwordHash },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: `No user found with email: ${email}` }, { status: 404 });
  }

  return NextResponse.json({
    ok:    true,
    email,
    note:  `Password updated for ${result.count} account(s). You can now log in.`,
  });
}

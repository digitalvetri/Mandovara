// Create / delete a disposable OWNER test user for QA. Gated by the same
// IMPORT_TOKEN as /api/admin/import-stock and /api/admin/bootstrap.
//
// Usage:
//   Create:  curl -X POST   https://<host>/api/admin/test-user -H "X-Import-Token: $IMPORT_TOKEN"
//   Delete:  curl -X DELETE https://<host>/api/admin/test-user -H "X-Import-Token: $IMPORT_TOKEN"
//
// POST returns { ok, credentials: { email, password }, userId }. Safe to
// re-run — upserts on (org, mobile), always resets the password hash so
// the returned credentials always work.

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { authBootstrapPrisma } from "@/kernel/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEST_EMAIL    = "tester@mandovara.com";
const TEST_MOBILE   = "+91 9999900001";
const TEST_NAME     = "Test User";
const TEST_PASSWORD = "Tester@2026";

interface CreateResult {
  ok:          boolean;
  userId:      string;
  credentials: { email: string; mobile: string; password: string };
  note:        string;
}

interface DeleteResult {
  ok:      boolean;
  deleted: number;
  note:    string;
}

function unauthorized(req: Request): NextResponse<{ error: string }> | null {
  const provided = req.headers.get("x-import-token");
  const expected = process.env["IMPORT_TOKEN"];
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(req: Request): Promise<NextResponse<CreateResult | { error: string }>> {
  const gate = unauthorized(req);
  if (gate) return gate;

  const db = authBootstrapPrisma;
  const org = await db.organization.findFirst({ where: { name: "Mandovara" }, select: { id: true } });
  if (!org) {
    return NextResponse.json({ error: "Mandovara org not found — run /api/admin/bootstrap first." }, { status: 500 });
  }
  const branch = await db.branch.findFirst({ where: { organizationId: org.id }, select: { id: true } });

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);

  const user = await db.user.upsert({
    where:  { organizationId_mobile: { organizationId: org.id, mobile: TEST_MOBILE } },
    update: { passwordHash, role: "OWNER", status: "ACTIVE" },
    create: {
      organizationId: org.id,
      mobile:         TEST_MOBILE,
      email:          TEST_EMAIL,
      name:           TEST_NAME,
      role:           "OWNER",
      passwordHash,
      branchIds:      branch ? [branch.id] : [],
      status:         "ACTIVE",
    },
    select: { id: true },
  });

  return NextResponse.json({
    ok:          true,
    userId:      user.id,
    credentials: { email: TEST_EMAIL, mobile: TEST_MOBILE, password: TEST_PASSWORD },
    note:        "Log in with either email or mobile + the password. Role = OWNER (all modules).",
  });
}

export async function DELETE(req: Request): Promise<NextResponse<DeleteResult | { error: string }>> {
  const gate = unauthorized(req);
  if (gate) return gate;

  const db = authBootstrapPrisma;
  const org = await db.organization.findFirst({ where: { name: "Mandovara" }, select: { id: true } });
  if (!org) {
    return NextResponse.json({ error: "Mandovara org not found." }, { status: 500 });
  }

  const res = await db.user.deleteMany({
    where: { organizationId: org.id, mobile: TEST_MOBILE },
  });

  return NextResponse.json({
    ok:      true,
    deleted: res.count,
    note:    res.count > 0 ? "Test user removed." : "No test user found (already gone).",
  });
}

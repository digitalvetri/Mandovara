// Link an Employee record to a User account by email + employee code.
// Gated by IMPORT_TOKEN (same secret used by reset-password and bootstrap).
//
// Usage:
//   curl -X POST https://<host>/api/admin/link-employee \
//     -H "X-Import-Token: $IMPORT_TOKEN" \
//     -H "Content-Type: application/json" \
//     -d '{"email":"aishwarya@mandovara.com","employeeCode":"EMP-002"}'

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

  let body: { email?: string; employeeCode?: string };
  try {
    body = await req.json() as { email?: string; employeeCode?: string };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { email, employeeCode } = body;
  if (!email || !employeeCode) {
    return NextResponse.json({ error: "email and employeeCode are required" }, { status: 400 });
  }

  const user = await authBootstrapPrisma.user.findFirst({
    where: { email },
    select: { id: true, organizationId: true, email: true },
  });
  if (!user) {
    return NextResponse.json({ error: `No user found with email: ${email}` }, { status: 404 });
  }

  const employee = await authBootstrapPrisma.employee.findFirst({
    where: { code: employeeCode, organizationId: user.organizationId },
    select: { id: true, name: true, code: true, userId: true },
  });
  if (!employee) {
    return NextResponse.json({ error: `No employee found with code: ${employeeCode} in org ${user.organizationId}` }, { status: 404 });
  }

  await authBootstrapPrisma.employee.update({
    where: { id: employee.id },
    data:  { userId: user.id },
  });

  return NextResponse.json({
    ok: true,
    linked: { userId: user.id, email: user.email, employeeId: employee.id, employeeName: employee.name, code: employee.code },
  });
}
